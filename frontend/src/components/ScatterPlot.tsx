"use client";

import dynamic from "next/dynamic";
import { useMemo, useCallback, useState } from "react";
import type Plotly from "plotly.js";
import { Point2D, QueryState, SelectedQuery } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const PLOT_DIV_ID = "scatter-plot";

const LAYER_CONFIG: { key: string; label: string; color: string }[] = [
  { key: "Core (Deterministic)", label: "L1 Core", color: "#3b82f6" },
  { key: "Synonyms", label: "L2 Synonyms", color: "#f59e0b" },
  { key: "Translations", label: "L3 Translations", color: "#ec4899" },
  { key: "Controlled Random (Bounded)", label: "L4 Random", color: "#a0522d" },
  { key: "Modality x Target Alias", label: "L5 Modality", color: "#a855f7" },
];

const LAYER_COLORS: Record<string, string> = Object.fromEntries(
  LAYER_CONFIG.map((l) => [l.key, l.color])
);

interface ScatterPlotProps {
  points: Point2D[];
  queryStates: QueryState[];
  currentSelection: SelectedQuery[];
  hoveredQuery: number | null;
  currentRound: number;
}

export default function ScatterPlot({
  points,
  queryStates,
  currentSelection,
  hoveredQuery,
  currentRound,
}: ScatterPlotProps) {
  // Per-layer highlight state: which layers are colored (vs gray)
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());

  const toggleLayer = useCallback((key: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setActiveLayers((prev) => {
      if (prev.size === LAYER_CONFIG.length) return new Set();
      return new Set(LAYER_CONFIG.map((l) => l.key));
    });
  }, []);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleZoom = useCallback((direction: "in" | "out" | "reset") => {
    const el = document.getElementById(PLOT_DIV_ID) as any;
    if (!el) return;

    const layout = el.layout;
    const xRange = layout.xaxis?.range;
    const yRange = layout.yaxis?.range;

    if (direction === "reset") {
      const PlotlyLib = (window as any).Plotly;
      if (PlotlyLib) {
        PlotlyLib.relayout(el, { "xaxis.autorange": true, "yaxis.autorange": true });
      }
      return;
    }

    if (!xRange || !yRange) return;

    const factor = direction === "in" ? 0.3 : -0.5;
    const xCenter = (xRange[0] + xRange[1]) / 2;
    const yCenter = (yRange[0] + yRange[1]) / 2;
    const xHalf = (xRange[1] - xRange[0]) / 2 * (1 - factor);
    const yHalf = (yRange[1] - yRange[0]) / 2 * (1 - factor);

    const PlotlyLib = (window as any).Plotly;
    if (PlotlyLib) {
      PlotlyLib.relayout(el, {
        "xaxis.range": [xCenter - xHalf, xCenter + xHalf],
        "yaxis.range": [yCenter - yHalf, yCenter + yHalf],
      });
    }
  }, []);

  const plotData = useMemo(() => {
    const empty: { traces: object[]; shapes: object[]; annotations: object[] } = {
      traces: [],
      shapes: [],
      annotations: [],
    };
    if (points.length === 0) return empty;

    const stateMap = new Map(queryStates.map((q) => [q.index, q]));
    const selectionMap = new Map(
      currentSelection.map((s) => [s.index, s])
    );

    type GroupData = { x: number[]; y: number[]; text: string[]; indices: number[] };

    // Status groups for selected/promising/failed
    const statusGroups: Record<string, GroupData> = {
      selected_exploit: { x: [], y: [], text: [], indices: [] },
      selected_explore: { x: [], y: [], text: [], indices: [] },
      promising: { x: [], y: [], text: [], indices: [] },
      failed: { x: [], y: [], text: [], indices: [] },
    };

    // Untried queries grouped by layer
    const layerGroups: Record<string, GroupData> = {};
    // Untried queries that are gray (not highlighted)
    const grayGroup: GroupData = { x: [], y: [], text: [], indices: [] };

    const anyLayerActive = activeLayers.size > 0;

    for (const pt of points) {
      const qs = stateMap.get(pt.index);
      const status = qs?.status || "untried";
      const sel = selectionMap.get(pt.index);
      const label = `q${pt.index + 1}: ${pt.query}`;

      if (status === "selected" && sel) {
        const group = sel.is_exploit ? "selected_exploit" : "selected_explore";
        statusGroups[group].x.push(pt.x);
        statusGroups[group].y.push(pt.y);
        statusGroups[group].text.push(label);
        statusGroups[group].indices.push(pt.index);
      } else if (status === "promising" || status === "failed") {
        statusGroups[status].x.push(pt.x);
        statusGroups[status].y.push(pt.y);
        statusGroups[status].text.push(label);
        statusGroups[status].indices.push(pt.index);
      } else {
        const layer = qs?.layer || "Unknown";
        if (anyLayerActive && activeLayers.has(layer)) {
          // This layer is highlighted
          if (!layerGroups[layer]) {
            layerGroups[layer] = { x: [], y: [], text: [], indices: [] };
          }
          layerGroups[layer].x.push(pt.x);
          layerGroups[layer].y.push(pt.y);
          layerGroups[layer].text.push(label);
          layerGroups[layer].indices.push(pt.index);
        } else {
          // Gray dot
          grayGroup.x.push(pt.x);
          grayGroup.y.push(pt.y);
          grayGroup.text.push(label);
          grayGroup.indices.push(pt.index);
        }
      }
    }

    const traces: object[] = [];

    // Gray untried dots first (background)
    if (grayGroup.x.length > 0) {
      const sizes = grayGroup.indices.map((idx) =>
        idx === hoveredQuery ? 16 : 7
      );
      traces.push({
        x: grayGroup.x,
        y: grayGroup.y,
        text: grayGroup.text,
        type: "scatter" as const,
        mode: "markers" as const,
        name: "Untried",
        showlegend: false,
        marker: {
          color: "#444444",
          size: sizes,
          symbol: "circle",
          opacity: 0.4,
          line: { color: "rgba(0,0,0,0)", width: 1 },
        },
        hovertemplate: "%{text}<extra></extra>",
      });
    }

    // Highlighted layer traces
    const layerShortNames: Record<string, string> = Object.fromEntries(
      LAYER_CONFIG.map((l) => [l.key, l.label])
    );

    for (const [layer, g] of Object.entries(layerGroups)) {
      if (g.x.length === 0) continue;
      const color = LAYER_COLORS[layer] || "#555555";
      const sizes = g.indices.map((idx) =>
        idx === hoveredQuery ? 16 : 8
      );
      traces.push({
        x: g.x,
        y: g.y,
        text: g.text,
        type: "scatter" as const,
        mode: "markers" as const,
        name: layerShortNames[layer] || layer,
        showlegend: false,
        marker: {
          color,
          size: sizes,
          symbol: "circle",
          opacity: 0.85,
          line: { color: "rgba(0,0,0,0)", width: 1 },
        },
        hovertemplate: "%{text}<extra></extra>",
      });
    }

    // Status traces on top
    const statusStyles: Record<string, { color: string; size: number; symbol: string; name: string }> = {
      selected_exploit: { color: "#00c277", size: 16, symbol: "star", name: "Exploit" },
      selected_explore: { color: "#22d3ee", size: 16, symbol: "diamond", name: "Explore" },
      promising: { color: "#00ff99", size: 11, symbol: "circle", name: "Promising" },
      failed: { color: "#ef4444", size: 9, symbol: "x", name: "Failed" },
    };

    for (const [key, g] of Object.entries(statusGroups)) {
      if (g.x.length === 0) continue;
      const style = statusStyles[key];
      const sizes = g.indices.map((idx) =>
        idx === hoveredQuery ? style.size * 2 : style.size
      );
      traces.push({
        x: g.x,
        y: g.y,
        text: g.text,
        type: "scatter" as const,
        mode: "markers" as const,
        name: style.name,
        showlegend: false,
        marker: {
          color: style.color,
          size: sizes,
          symbol: style.symbol,
          line: { color: "rgba(0,0,0,0)", width: 1 },
        },
        hovertemplate: "%{text}<extra></extra>",
      });
    }

    // Distance lines for explore selections
    const lineShapes: object[] = [];
    const lineAnnotations: object[] = [];
    for (const sel of currentSelection) {
      if (sel.is_exploit || sel.nearest_tried_index === null) continue;
      const fromPt = points.find((p) => p.index === sel.index);
      const toPt = points.find((p) => p.index === sel.nearest_tried_index);
      if (!fromPt || !toPt) continue;

      lineShapes.push({
        type: "line",
        x0: fromPt.x,
        y0: fromPt.y,
        x1: toPt.x,
        y1: toPt.y,
        line: { color: "rgba(34, 211, 238, 0.4)", width: 1.5, dash: "dash" },
      });

      lineAnnotations.push({
        x: (fromPt.x + toPt.x) / 2,
        y: (fromPt.y + toPt.y) / 2,
        text: sel.distance.toFixed(2),
        showarrow: false,
        font: { color: "#22d3ee", size: 12 },
        bgcolor: "rgba(10,10,10,0.8)",
      });
    }

    return { traces, shapes: lineShapes, annotations: lineAnnotations };
  }, [points, queryStates, currentSelection, hoveredQuery, currentRound, activeLayers]);

  if (points.length === 0) {
    return (
      <div className="glass-card rounded-xl h-full flex items-center justify-center">
        <p className="text-[#555] text-base">
          Generate queries to see the vector space
        </p>
      </div>
    );
  }

  const allActive = activeLayers.size === LAYER_CONFIG.length;

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full relative">
      {/* Zoom controls — top right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => handleZoom("in")}
          className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#ccc] text-lg font-bold hover:bg-[#252525] hover:border-[#00c277] transition-colors flex items-center justify-center"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => handleZoom("out")}
          className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#ccc] text-lg font-bold hover:bg-[#252525] hover:border-[#00c277] transition-colors flex items-center justify-center"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => handleZoom("reset")}
          className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#999] text-[10px] font-medium hover:bg-[#252525] hover:border-[#00c277] transition-colors flex items-center justify-center"
          title="Reset zoom"
        >
          FIT
        </button>
      </div>

      {/* Layer toggle buttons — bottom right */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-[#0a0a0a]/80 backdrop-blur-sm rounded-lg px-2 py-1.5">
        <button
          onClick={toggleAll}
          className={`h-6 px-2 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            allActive
              ? "bg-[#00c277]/20 text-[#00c277] border border-[#00c277]/50"
              : activeLayers.size === 0
              ? "bg-transparent text-[#666] border border-[#333] hover:border-[#555]"
              : "bg-transparent text-[#999] border border-[#555] hover:border-[#00c277]"
          }`}
          title={allActive ? "Clear all layer colors" : "Color all layers"}
        >
          All
        </button>
        <div className="w-px h-4 bg-[#333]" />
        {LAYER_CONFIG.map((layer) => {
          const isActive = activeLayers.has(layer.key);
          return (
            <button
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              className={`h-6 px-2 rounded text-[10px] font-semibold transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "border"
                  : "bg-transparent text-[#666] border border-[#333] hover:border-[#555] hover:text-[#999]"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `${layer.color}20`,
                      borderColor: `${layer.color}80`,
                      color: layer.color,
                    }
                  : undefined
              }
              title={`${isActive ? "Hide" : "Show"} ${layer.label}`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: isActive ? layer.color : "#555" }}
              />
              {layer.label}
            </button>
          );
        })}
      </div>

      <Plot
        divId={PLOT_DIV_ID}
        data={plotData.traces as Plotly.Data[]}
        layout={{
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(20,20,20,0.5)",
          font: { color: "#aaa", size: 13 },
          margin: { t: 40, r: 20, b: 50, l: 30 },
          xaxis: {
            showgrid: true,
            gridcolor: "rgba(255,255,255,0.04)",
            zeroline: false,
            showticklabels: false,
          },
          yaxis: {
            showgrid: true,
            gridcolor: "rgba(255,255,255,0.04)",
            zeroline: false,
            showticklabels: false,
          },
          showlegend: false,
          shapes: plotData.shapes as Plotly.Layout["shapes"],
          annotations: plotData.annotations as Plotly.Layout["annotations"],
          title: {
            text: currentRound > 0 ? `Round ${currentRound}` : "Query Space",
            font: { size: 15, color: "#aaa" },
          },
          dragmode: "pan",
        }}
        config={{
          displayModeBar: false,
          responsive: true,
          scrollZoom: true,
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
