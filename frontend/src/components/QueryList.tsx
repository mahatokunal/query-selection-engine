"use client";

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

export default function QueryList({
  queries,
  currentRound,
  onHoverQuery,
}: QueryListProps) {
  const tried = queries.filter(
    (q) => q.status === "promising" || q.status === "failed"
  );
  const selected = queries.filter((q) => q.status === "selected");
  const untried = queries.filter((q) => q.status === "untried");

  const sections = [
    { title: `Selected — Round ${currentRound}`, items: selected },
    { title: "Promising", items: tried.filter((q) => q.status === "promising") },
    { title: "Failed", items: tried.filter((q) => q.status === "failed") },
    { title: `Untried (${untried.length})`, items: untried },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="glass-card rounded-xl p-4 h-full overflow-hidden flex flex-col">
      <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-3">
        Query Pool
      </h2>
      <div className="overflow-y-auto flex-1 space-y-4 pr-1">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-[#666] uppercase tracking-widest mb-2">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((q) => {
                const style = STATUS_STYLES[q.status];
                return (
                  <div
                    key={q.index}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm hover:bg-[#1a1a1a] cursor-default transition-colors ${
                      q.status === "selected" ? "animate-pulse-glow rounded-md" : ""
                    }`}
                    onMouseEnter={() => onHoverQuery(q.index)}
                    onMouseLeave={() => onHoverQuery(null)}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <span className="text-[#666] font-mono w-8 shrink-0 text-xs">
                      q{q.index + 1}
                    </span>
                    <span className={`truncate ${style.text}`}>{q.query}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
