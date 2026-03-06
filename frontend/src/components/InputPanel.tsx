"use client";

import { useState } from "react";

const MODEL_OPTIONS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-5-mini-2025-08-07", label: "GPT-5 Mini" },
];

interface InputPanelProps {
  onGenerate: (query: string, poolSize: number, model: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function InputPanel({
  onGenerate,
  isLoading,
  disabled,
}: InputPanelProps) {
  const [query, setQuery] = useState("");
  const [poolSize, setPoolSize] = useState(50);
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-4">
        Target Input
      </h2>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[#888] mb-1.5">
            Biomedical Target Query
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., CDK12 inhibitors for Triple Negative Breast Cancer"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors"
            disabled={disabled}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs text-[#888] mb-1.5">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={disabled}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c277] transition-colors appearance-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
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
        <button
          onClick={() => onGenerate(query, poolSize, model)}
          disabled={!query.trim() || isLoading || disabled}
          className="px-5 py-2.5 bg-[#00c277] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#00ff99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isLoading ? "Generating..." : "Generate Queries"}
        </button>
      </div>
    </div>
  );
}
