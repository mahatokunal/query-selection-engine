"use client";

import { useState } from "react";

const MODEL_OPTIONS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-5-mini-2025-08-07", label: "GPT-5 Mini" },
];

interface InputPanelProps {
  onParse: (query: string, poolSize: number, model: string) => void;
  isParsing: boolean;
  disabled: boolean;
  initialQuery?: string;
}

export default function InputPanel({
  onParse,
  isParsing,
  disabled,
  initialQuery = "",
}: InputPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [poolSize, setPoolSize] = useState(50);
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-4">
        Target Input
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-[#888] mb-1.5">
            Biomedical Target Query
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., CDK12 inhibitors for Triple Negative Breast Cancer"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-base text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors"
            disabled={disabled}
          />
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-[#888] mb-1.5">
              Model
            </label>
            <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden">
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  disabled={disabled}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    model === m.id
                      ? "bg-[#00c277] text-[#0a0a0a]"
                      : "bg-[#0a0a0a] text-[#888] hover:text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs text-[#888] mb-1.5">
              Pool Size
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={20}
                max={5000}
                step={10}
                value={poolSize}
                onChange={(e) => setPoolSize(Number(e.target.value))}
                className="flex-1 accent-[#00c277]"
                disabled={disabled}
              />
              <input
                type="number"
                min={20}
                max={5000}
                step={10}
                value={poolSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 20 && v <= 5000) setPoolSize(v);
                }}
                className="w-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white text-center font-mono focus:outline-none focus:border-[#00c277]"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => onParse(query, poolSize, model)}
            disabled={!query.trim() || isParsing || disabled}
            className="px-5 py-2.5 bg-[#00c277] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#00ff99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isParsing ? "Parsing..." : "Parse Query"}
          </button>
        </div>
      </div>
    </div>
  );
}
