"use client";

import dynamic from "next/dynamic";
import { useMemo, useCallback } from "react";
import type Plotly from "plotly.js";
import { Point2D, QueryState, SelectedQuery } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const PLOT_DIV_ID = "scatter-plot";

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

    const statusMap = new Map(queryStates.map((q) => [q.index, q.status]));
    const selectionMap = new Map(
      currentSelection.map((s) => [s.index, s])
    );

    const groups: Record<string, { x: number[]; y: number[]; text: string[]; indices: number[] }> = {
      untried: { x: [], y: [], text: [], indices: [] },
      selected_exploit: { x: [], y: [], text: [], indices: [] },
      selected_explore: { x: [], y: [], text: [], indices: [] },
      promising: { x: [], y: [], text: [], indices: [] },
      failed: { x: [], y: [], text: [], indices: [] },
    };

    for (const pt of points) {
      const status = statusMap.get(pt.index) || "untried";
      const sel = selectionMap.get(pt.index);

      let group: string = status;
      if (status === "selected" && sel) {
        group = sel.is_exploit ? "selected_exploit" : "selected_explore";
      }

      const g = groups[group] || groups.untried;
      g.x.push(pt.x);
      g.y.push(pt.y);
      g.text.push(`q${pt.index + 1}: ${pt.query}`);
      g.indices.push(pt.index);
    }

    const styleMap: Record<string, { color: string; size: number; symbol: string; name: string }> = {
      untried: { color: "#555555", size: 8, symbol: "circle", name: "Untried" },
      selected_exploit: { color: "#00c277", size: 16, symbol: "star", name: "Exploit" },
      selected_explore: { color: "#22d3ee", size: 16, symbol: "diamond", name: "Explore" },
      promising: { color: "#00ff99", size: 11, symbol: "circle", name: "Promising" },
      failed: { color: "#ef4444", size: 9, symbol: "x", name: "Failed" },
    };

    const traces = Object.entries(groups)
      .filter(([, g]) => g.x.length > 0)
      .map(([key, g]) => {
        const style = styleMap[key];
        const sizes = g.indices.map((idx) =>
          idx === hoveredQuery ? style.size * 2 : style.size
        );
        return {
          x: g.x,
          y: g.y,
          text: g.text,
          type: "scatter" as const,
          mode: "markers" as const,
          name: style.name,
          marker: {
            color: style.color,
            size: sizes,
            symbol: style.symbol,
            line: {
              color: "rgba(0,0,0,0)",
              width: 1,
            },
          },
          hovertemplate: "%{text}<extra></extra>",
        };
      });

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
  }, [points, queryStates, currentSelection, hoveredQuery, currentRound]);

  if (points.length === 0) {
    return (
      <div className="glass-card rounded-xl h-full flex items-center justify-center">
        <p className="text-[#555] text-base">
          Generate queries to see the vector space
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full relative">
      {/* Zoom controls */}
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

      <Plot
        divId={PLOT_DIV_ID}
        data={plotData.traces as Plotly.Data[]}
        layout={{
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(20,20,20,0.5)",
          font: { color: "#aaa", size: 13 },
          margin: { t: 40, r: 20, b: 30, l: 30 },
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
          showlegend: true,
          legend: {
            x: 1,
            y: 1,
            bgcolor: "rgba(0,0,0,0)",
            font: { size: 13, color: "#aaa" },
          },
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
