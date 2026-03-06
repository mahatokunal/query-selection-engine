"use client";

import { SelectedQuery } from "@/lib/types";

interface ExplanationPanelProps {
  selectedQueries: SelectedQuery[];
  hoveredQuery: number | null;
}

export default function ExplanationPanel({
  selectedQueries,
  hoveredQuery,
}: ExplanationPanelProps) {
  const focused =
    hoveredQuery !== null
      ? selectedQueries.find((q) => q.index === hoveredQuery)
      : null;

  if (!focused) {
    return (
      <div>
        <p className="text-sm text-[#555]">
          Hover over a query in the list or scatter plot to see why it was
          selected
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-mono font-bold text-[#00c277]">
            q{focused.index + 1}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded font-semibold ${
              focused.is_exploit
                ? "bg-[#00c277]/10 text-[#00c277]"
                : "bg-[#22d3ee]/10 text-[#22d3ee]"
            }`}
          >
            {focused.is_exploit ? "EXPLOIT" : "EXPLORE"}
          </span>
        </div>
        <p className="text-sm text-[#ccc]">{focused.query}</p>
        <p className="text-sm text-[#888] leading-relaxed">{focused.reason}</p>
        {focused.distance > 0 && (
          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-xs text-[#666]">Distance:</span>
            <div className="flex-1 h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22d3ee] rounded-full transition-all"
                style={{ width: `${Math.min(focused.distance * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-[#22d3ee]">
              {focused.distance.toFixed(3)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

