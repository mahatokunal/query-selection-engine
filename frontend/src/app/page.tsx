"use client";

import { useState, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import InputPanel from "@/components/InputPanel";
import ParsedQueryForm from "@/components/ParsedQueryForm";
import ExpansionLayers from "@/components/ExpansionLayers";
import QueryList from "@/components/QueryList";
import ScatterPlot from "@/components/ScatterPlot";
import RoundControls from "@/components/RoundControls";
import ExplanationPanel from "@/components/ExplanationPanel";
import BiasMetricsPanel from "@/components/BiasMetricsPanel";
import { parseQuery, expandQueryStream, embedQueries, selectQueries, computeMetrics } from "@/lib/api";
import {
  LayerResult,
  Point2D,
  QueryState,
  SelectedQuery,
  StructuredQuery,
} from "@/lib/types";
import { MetricsSnapshot, generateQueriesCSV, generateMetricsTXT, downloadFile } from "@/lib/export";

type AppPhase = "input" | "parsing" | "parsed" | "expanding" | "ready" | "round" | "stopped";

const MAX_ROUNDS = 40;

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [layers, setLayers] = useState<LayerResult[]>([]);
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0);
  const [allQueries, setAllQueries] = useState<string[]>([]);
  const [points, setPoints] = useState<Point2D[]>([]);
  const [queryStates, setQueryStates] = useState<QueryState[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentSelection, setCurrentSelection] = useState<SelectedQuery[]>([]);
  const [markedPromising, setMarkedPromising] = useState<Set<number>>(new Set());
  const [triedIndices, setTriedIndices] = useState<number[]>([]);
  const [promisingIndices, setPromisingIndices] = useState<number[]>([]);
  const [hoveredQuery, setHoveredQuery] = useState<number | null>(null);
  const [requestedPoolSize, setRequestedPoolSize] = useState(50);
  const [isSelecting, setIsSelecting] = useState(false);
  const [roundHistory, setRoundHistory] = useState<
    { round: number; selected: SelectedQuery[]; promising: number[] }[]
  >([]);
  const [intraLayerDistances, setIntraLayerDistances] = useState<Record<string, number> | null>(null);
  const [distanceToNearestTried, setDistanceToNearestTried] = useState<Record<string, number> | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricsSnapshot[]>([]);

  // Parse-related state
  const [structuredQuery, setStructuredQuery] = useState<StructuredQuery | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [rawQuery, setRawQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");

  const layerDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    // Count from round history
    for (const rh of roundHistory) {
      for (const sel of rh.selected) {
        const state = queryStates.find((q) => q.index === sel.index);
        if (state) {
          dist[state.layer] = (dist[state.layer] || 0) + 1;
        }
      }
    }
    // Count from current selection
    for (const sel of currentSelection) {
      const state = queryStates.find((q) => q.index === sel.index);
      if (state) {
        dist[state.layer] = (dist[state.layer] || 0) + 1;
      }
    }
    return dist;
  }, [roundHistory, currentSelection, queryStates]);

  const runSelection = useCallback(
    async (
      queries: string[],
      pts: Point2D[],
      tried: number[],
      promising: number[],
      states: QueryState[],
      round: number,
      cumulativeLayerCounts: Record<string, number> = {}
    ) => {
      setIsSelecting(true);
      setCurrentRound(round);
      setMarkedPromising(new Set());

      try {
        const embeddings2d = pts.map((p) => [p.x, p.y]);
        const layerList = states.map((q) => q.layer);
        const data = await selectQueries(queries, embeddings2d, tried, promising, 5, layerList, round, cumulativeLayerCounts);
        const selected: SelectedQuery[] = data.selected;
        setCurrentSelection(selected);

        const selectedIndices = new Set(selected.map((s) => s.index));
        const newStates = states.map((q) => {
          if (selectedIndices.has(q.index)) {
            return { ...q, status: "selected" as const, selectedInRound: round };
          }
          return q;
        });
        setQueryStates(newStates);
        setPhase("round");

        // Compute distance-to-nearest-tried after each selection
        const allTriedNow = [...new Set([...tried, ...selected.map((s) => s.index)])];
        if (allTriedNow.length > 0) {
          const layerList = states.map((q) => q.layer);
          computeMetrics(layerList, allTriedNow, false, true)
            .then((m) => {
              if (m.distance_to_nearest_tried) {
                setDistanceToNearestTried(m.distance_to_nearest_tried);
                // Accumulate per-round snapshot for export
                const snapDist: Record<string, number> = {};
                for (const sel of selected) {
                  const state = states.find((q) => q.index === sel.index);
                  if (state) {
                    snapDist[state.layer] = (snapDist[state.layer] || 0) + 1;
                  }
                }
                setMetricsHistory((prev) => [
                  ...prev,
                  {
                    round,
                    layerDistribution: snapDist,
                    distanceToNearestTried: m.distance_to_nearest_tried,
                  },
                ]);
              }
            })
            .catch(console.error);
        }
      } catch (err) {
        console.error(err);
        alert(`Selection error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
      setIsSelecting(false);
    },
    []
  );

  const handleParse = useCallback(
    async (query: string, poolSize: number, model: string) => {
      setPhase("parsing");
      setRawQuery(query);
      setSelectedModel(model);
      setRequestedPoolSize(poolSize);

      try {
        const result = await parseQuery(query, model);
        setStructuredQuery(result.structured);
        setParseWarnings(result.warnings);
        setPhase("parsed");
      } catch (err) {
        console.error(err);
        alert(`Parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
        setPhase("input");
      }
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!structuredQuery) return;

    setPhase("expanding");
    setLayers([]);
    setCurrentLayerIndex(0);

    try {
      const expandedLayers: LayerResult[] = [];
      await expandQueryStream(rawQuery, requestedPoolSize, selectedModel, (layer) => {
        expandedLayers.push(layer);
        setLayers((prev) => [...prev, layer]);
        setCurrentLayerIndex(expandedLayers.length);
      }, structuredQuery);

      const queries: string[] = [];
      for (const layer of expandedLayers) {
        queries.push(...layer.queries);
      }
      setAllQueries(queries);

      const embedData = await embedQueries(queries);
      setPoints(embedData.points);

      // Build layer list for metrics
      const layerList: string[] = [];
      for (const layer of expandedLayers) {
        for (let j = 0; j < layer.queries.length; j++) {
          layerList.push(layer.name);
        }
      }

      // Compute intra-layer distances once after embedding
      computeMetrics(layerList, [], true, false)
        .then((m) => { if (m.intra_layer_distances) setIntraLayerDistances(m.intra_layer_distances); })
        .catch(console.error);

      const states: QueryState[] = queries.map((q: string, i: number) => {
        let layerName = "";
        let count = 0;
        for (const layer of expandedLayers) {
          if (i < count + layer.queries.length) {
            layerName = layer.name;
            break;
          }
          count += layer.queries.length;
        }
        return { index: i, query: q, status: "untried" as const, layer: layerName };
      });
      setQueryStates(states);

      setPhase("ready");
      await runSelection(queries, embedData.points, [], [], states, 1);
    } catch (err) {
      console.error(err);
      setPhase("parsed");
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [structuredQuery, rawQuery, requestedPoolSize, selectedModel, runSelection]);

  const handleBack = useCallback(() => {
    setPhase("input");
  }, []);

  const handleTogglePromising = useCallback((index: number) => {
    setMarkedPromising((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleNextRound = useCallback(async () => {
    setRoundHistory((prev) => [
      ...prev,
      {
        round: currentRound,
        selected: currentSelection,
        promising: Array.from(markedPromising),
      },
    ]);

    const selectedIndices = currentSelection.map((s) => s.index);
    const newTried = [...new Set([...triedIndices, ...selectedIndices])];
    const newPromising = Array.from(markedPromising);

    setTriedIndices(newTried);
    setPromisingIndices(newPromising);

    const newStates = queryStates.map((q) => {
      if (q.status === "selected") {
        return {
          ...q,
          status: markedPromising.has(q.index)
            ? ("promising" as const)
            : ("failed" as const),
        };
      }
      return q;
    });
    setQueryStates(newStates);

    // Build cumulative layer selection counts from all rounds so far
    const cumulativeCounts: Record<string, number> = { ...layerDistribution };
    // Also include current round's selections being finalized
    for (const sel of currentSelection) {
      const state = queryStates.find((q) => q.index === sel.index);
      if (state) {
        // layerDistribution already includes currentSelection, so no double-count
      }
    }

    await runSelection(
      allQueries,
      points,
      newTried,
      newPromising,
      newStates,
      currentRound + 1,
      cumulativeCounts
    );
  }, [
    currentRound,
    currentSelection,
    markedPromising,
    triedIndices,
    allQueries,
    points,
    queryStates,
    layerDistribution,
    runSelection,
  ]);

  const handleStop = useCallback(() => {
    setRoundHistory((prev) => [
      ...prev,
      {
        round: currentRound,
        selected: currentSelection,
        promising: Array.from(markedPromising),
      },
    ]);
    setPhase("stopped");
  }, [currentRound, currentSelection, markedPromising]);

  const handleDownload = useCallback(() => {
    const csv = generateQueriesCSV(queryStates);
    downloadFile(csv, "queries_export.csv", "text/csv");

    // Browsers block multiple synchronous programmatic downloads — stagger the second
    setTimeout(() => {
      const txt = generateMetricsTXT(
        intraLayerDistances,
        metricsHistory,
        allQueries.length,
        triedIndices.length,
        currentRound,
        queryStates
      );
      downloadFile(txt, "metrics_report.txt", "text/plain");
    }, 100);
  }, [queryStates, intraLayerDistances, metricsHistory, allQueries.length, triedIndices.length, currentRound]);

  const handleReset = useCallback(() => {
    setPhase("input");
    setLayers([]);
    setCurrentLayerIndex(0);
    setAllQueries([]);
    setPoints([]);
    setQueryStates([]);
    setCurrentRound(0);
    setCurrentSelection([]);
    setMarkedPromising(new Set());
    setTriedIndices([]);
    setPromisingIndices([]);
    setHoveredQuery(null);
    setRequestedPoolSize(50);
    setRoundHistory([]);
    setIntraLayerDistances(null);
    setDistanceToNearestTried(null);
    setMetricsHistory([]);
    setStructuredQuery(null);
    setParseWarnings([]);
    setRawQuery("");
    setSelectedModel("gpt-4.1-mini");
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      {(phase === "input" || phase === "parsing") && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            <InputPanel
              onParse={handleParse}
              isParsing={phase === "parsing"}
              disabled={phase === "parsing"}
              initialQuery={rawQuery}
            />
          </div>
        </div>
      )}

      {phase === "parsed" && structuredQuery && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-3xl mx-auto">
            <ParsedQueryForm
              structuredQuery={structuredQuery}
              warnings={parseWarnings}
              poolSize={requestedPoolSize}
              onUpdate={setStructuredQuery}
              onPoolSizeChange={setRequestedPoolSize}
              onGenerate={handleGenerate}
              onBack={handleBack}
              isLoading={false}
            />
          </div>
        </div>
      )}

      {phase === "expanding" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <ExpansionLayers
              layers={layers}
              currentLayerIndex={currentLayerIndex}
              totalPoolSize={requestedPoolSize}
            />
          </div>
        </div>
      )}

      {(phase === "ready" || phase === "round") && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          {/* Main area: left query list + right column (plot + bias strip) */}
          <div className="flex-1 flex gap-3 min-h-0">
            <div className="w-[260px] shrink-0">
              <QueryList
                queries={queryStates}
                currentRound={currentRound}
                onHoverQuery={setHoveredQuery}
              />
            </div>
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0">
                <ScatterPlot
                  points={points}
                  queryStates={queryStates}
                  currentSelection={currentSelection}
                  hoveredQuery={hoveredQuery}
                  currentRound={currentRound}
                />
              </div>
              {/* Bias metrics horizontal strip below scatter plot */}
              <div className="glass-card rounded-xl px-4 py-2.5 shrink-0">
                <div className="flex items-start gap-6">
                  <BiasMetricsPanel
                    layerDistribution={layerDistribution}
                    intraLayerDistances={intraLayerDistances}
                    distanceToNearestTried={distanceToNearestTried}
                    horizontal
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Bottom: compact round controls + explanation */}
          <div className="flex gap-3 shrink-0">
            <div className="flex-1">
              <RoundControls
                currentRound={currentRound}
                selectedQueries={currentSelection}
                markedPromising={markedPromising}
                onTogglePromising={handleTogglePromising}
                onNextRound={handleNextRound}
                onStop={handleStop}
                isSelecting={isSelecting}
                maxRounds={MAX_ROUNDS}
                onDownload={handleDownload}
              />
            </div>
            <div className="w-[260px] shrink-0 glass-card rounded-xl p-3 overflow-y-auto max-h-[80px]">
              <ExplanationPanel
                selectedQueries={currentSelection}
                hoveredQuery={hoveredQuery}
              />
            </div>
          </div>
        </div>
      )}

      {phase === "stopped" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="glass-card rounded-xl p-8 max-w-xl w-full text-center">
            <h2 className="text-xl font-semibold mb-4">Search Complete</h2>
            <div className="space-y-2 text-sm text-[#888] mb-6">
              <p>
                Completed {currentRound} round{currentRound !== 1 ? "s" : ""}
              </p>
              <p>
                {triedIndices.length} queries tried out of {allQueries.length}
              </p>
              <p>{promisingIndices.length} promising queries found</p>
            </div>
            {roundHistory.length > 0 && (
              <div className="text-left mb-6">
                <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-2">
                  Round History
                </h3>
                {roundHistory.map((rh) => (
                  <div
                    key={rh.round}
                    className="flex items-center gap-2 text-xs text-[#666] py-1"
                  >
                    <span className="font-mono">R{rh.round}</span>
                    <span>
                      {rh.selected.length} selected, {rh.promising.length}{" "}
                      promising
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-[#00c277] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#00ff99] transition-colors"
            >
              Start New Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
