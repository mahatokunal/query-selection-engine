"use client";

import { SelectedQuery } from "@/lib/types";

interface RoundControlsProps {
  currentRound: number;
  selectedQueries: SelectedQuery[];
  markedPromising: Set<number>;
  onTogglePromising: (index: number) => void;
  onNextRound: () => void;
  onStop: () => void;
  isSelecting: boolean;
  maxRounds: number;
  onDownload?: () => void;
}

export default function RoundControls({
  currentRound,
  selectedQueries,
  markedPromising,
  onTogglePromising,
  onNextRound,
  onStop,
  isSelecting,
  maxRounds,
  onDownload,
}: RoundControlsProps) {
  const exploitQueries = selectedQueries.filter((q) => q.is_exploit);
  const exploreQueries = selectedQueries.filter((q) => !q.is_exploit);

  return (
    <div className="glass-card rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider shrink-0">
          R{currentRound}
        </h2>
        {exploitQueries.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00c277]/10 text-[#00c277] border border-[#00c277]/20 font-medium shrink-0">
            {exploitQueries.length} exploit
          </span>
        )}
        {exploreQueries.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20 font-medium shrink-0">
            {exploreQueries.length} explore
          </span>
        )}

        <div className="h-5 w-px bg-[#222] shrink-0" />

        <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0">
          {selectedQueries.map((sq) => (
            <label
              key={sq.index}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e0e0e] border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors shrink-0"
              title={sq.query}
            >
              <input
                type="checkbox"
                checked={markedPromising.has(sq.index)}
                onChange={() => onTogglePromising(sq.index)}
                className="w-3.5 h-3.5 rounded accent-[#00c277]"
              />
              <span className="text-[11px] font-mono text-[#666]">
                q{sq.index + 1}
              </span>
              <span
                className={`text-[10px] px-1.5 py-px rounded font-semibold ${
                  sq.is_exploit
                    ? "bg-[#00c277]/10 text-[#00c277]"
                    : "bg-[#22d3ee]/10 text-[#22d3ee]"
                }`}
              >
                {sq.is_exploit ? "EXP" : "EXR"}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={onNextRound}
            disabled={isSelecting || currentRound >= maxRounds}
            className="px-4 py-1.5 bg-[#00c277] text-[#0a0a0a] font-semibold text-xs rounded-lg hover:bg-[#00ff99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSelecting ? "..." : currentRound >= maxRounds ? "Max" : "Next Round"}
          </button>
          <button
            onClick={onStop}
            className="px-3 py-1.5 border border-[#333] text-[#888] text-xs rounded-lg hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
          >
            Stop
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="px-3 py-1.5 border border-[#333] text-[#888] text-xs rounded-lg hover:border-[#00c277] hover:text-[#00c277] transition-colors"
              title="Export CSV + TXT"
            >
              ↓ Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
