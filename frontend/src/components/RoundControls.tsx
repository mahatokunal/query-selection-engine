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
}: RoundControlsProps) {
  const exploitQueries = selectedQueries.filter((q) => q.is_exploit);
  const exploreQueries = selectedQueries.filter((q) => !q.is_exploit);

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[#aaa] uppercase tracking-wider">
            Round {currentRound}
          </h2>
          {exploitQueries.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#00c277]/10 text-[#00c277] border border-[#00c277]/20 font-medium">
              {exploitQueries.length} exploit
            </span>
          )}
          {exploreQueries.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20 font-medium">
              {exploreQueries.length} explore
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNextRound}
            disabled={isSelecting || currentRound >= maxRounds}
            className="px-5 py-2 bg-[#00c277] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#00ff99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSelecting ? "Selecting..." : currentRound >= maxRounds ? "Max Rounds" : "Next Round"}
          </button>
          <button
            onClick={onStop}
            className="px-5 py-2 border border-[#333] text-[#888] text-sm rounded-lg hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {selectedQueries.map((sq) => (
          <div
            key={sq.index}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0e0e0e] border border-[#1a1a1a]"
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markedPromising.has(sq.index)}
                onChange={() => onTogglePromising(sq.index)}
                className="w-4 h-4 rounded accent-[#00c277]"
              />
              <span className="text-xs font-mono text-[#666]">
                q{sq.index + 1}
              </span>
            </label>
            <span
              className={`text-xs px-2 py-0.5 rounded font-semibold ${
                sq.is_exploit
                  ? "bg-[#00c277]/10 text-[#00c277]"
                  : "bg-[#22d3ee]/10 text-[#22d3ee]"
              }`}
            >
              {sq.is_exploit ? "EXPLOIT" : "EXPLORE"}
            </span>
            <span className="text-sm text-[#ccc] truncate flex-1">
              {sq.query}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
