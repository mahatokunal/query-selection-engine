"use client";

import { useState } from "react";
import { QueryState } from "@/lib/types";

interface QueryListProps {
  queries: QueryState[];
  currentRound: number;
  onHoverQuery: (index: number | null) => void;
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  untried: { dot: "bg-[#444]", text: "text-[#888]" },
  selected: { dot: "bg-[#00c277]", text: "text-white" },
  promising: { dot: "bg-[#00ff99]", text: "text-[#00ff99]" },
  failed: { dot: "bg-[#ef4444]", text: "text-[#888] line-through" },
};

function QueryRow({
  q,
  onHoverQuery,
}: {
  q: QueryState;
  onHoverQuery: (index: number | null) => void;
}) {
  const style = STATUS_STYLES[q.status];
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-[#1a1a1a] cursor-default transition-colors ${
        q.status === "selected" ? "animate-pulse-glow rounded-md" : ""
      }`}
      onMouseEnter={() => onHoverQuery(q.index)}
      onMouseLeave={() => onHoverQuery(null)}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <span className="text-[#666] font-mono w-7 shrink-0 text-xs">
        q{q.index + 1}
      </span>
      <span className={`truncate ${style.text}`}>{q.query}</span>
    </div>
  );
}

export default function QueryList({
  queries,
  currentRound,
  onHoverQuery,
}: QueryListProps) {
  const [failedExpanded, setFailedExpanded] = useState(false);

  const selected = queries.filter((q) => q.status === "selected");
  const promising = queries.filter((q) => q.status === "promising");
  const failed = queries.filter((q) => q.status === "failed");
  const untried = queries.filter((q) => q.status === "untried");

  return (
    <div className="glass-card rounded-xl p-3 h-full overflow-hidden flex flex-col">
      <h2 className="text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-2">
        Query Pool
      </h2>
      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        {selected.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-widest mb-1">
              Selected — Round {currentRound}
            </h3>
            <div className="space-y-0.5">
              {selected.map((q) => (
                <QueryRow key={q.index} q={q} onHoverQuery={onHoverQuery} />
              ))}
            </div>
          </div>
        )}

        {promising.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-widest mb-1">
              Promising
            </h3>
            <div className="space-y-0.5">
              {promising.map((q) => (
                <QueryRow key={q.index} q={q} onHoverQuery={onHoverQuery} />
              ))}
            </div>
          </div>
        )}

        {failed.length > 0 && (
          <div>
            <button
              onClick={() => setFailedExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#666] uppercase tracking-widest mb-1 hover:text-[#888] transition-colors"
            >
              <span
                className="text-[10px] transition-transform inline-block"
                style={{ transform: failedExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ▶
              </span>
              Failed ({failed.length})
            </button>
            {failedExpanded && (
              <div className="space-y-0.5">
                {failed.map((q) => (
                  <QueryRow key={q.index} q={q} onHoverQuery={onHoverQuery} />
                ))}
              </div>
            )}
          </div>
        )}

        {untried.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-widest mb-1">
              Untried ({untried.length})
            </h3>
            <div className="space-y-0.5">
              {untried.map((q) => (
                <QueryRow key={q.index} q={q} onHoverQuery={onHoverQuery} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
