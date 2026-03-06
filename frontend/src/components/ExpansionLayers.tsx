"use client";

import { LayerResult } from "@/lib/types";

interface ExpansionLayersProps {
  layers: LayerResult[];
  currentLayerIndex: number;
  totalPoolSize?: number;
}

const LAYER_LABELS: Record<string, string> = {
  "Core (Deterministic)": "L1",
  Synonyms: "L2",
  Translations: "L3",
  "Controlled Random (Bounded)": "L4",
  "Modality x Target Alias": "L5",
};

export default function ExpansionLayers({
  layers,
  currentLayerIndex,
  totalPoolSize,
}: ExpansionLayersProps) {
  const generatedCount = layers.reduce((sum, l) => sum + l.queries.length, 0);
  const progressPct = totalPoolSize ? Math.min((generatedCount / totalPoolSize) * 100, 100) : 0;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">
          Query Expansion Layers
        </h2>
        {totalPoolSize && (
          <span className="text-sm font-mono text-[#00c277]">
            {generatedCount} / {totalPoolSize} queries
          </span>
        )}
      </div>
      {totalPoolSize && (
        <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#00c277] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
      <div className="space-y-3">
        {layers.map((layer, i) => {
          const isActive = i === currentLayerIndex;
          const isDone = i < currentLayerIndex;
          const label = LAYER_LABELS[layer.name] || `L${i + 1}`;

          return (
            <div
              key={layer.name}
              className={`rounded-lg border p-3 transition-all duration-500 ${
                isActive
                  ? "border-[#00c277] bg-[#00c277]/5"
                  : isDone
                  ? "border-[#1e1e1e] bg-[#141414]"
                  : "border-[#1a1a1a] bg-[#0e0e0e] opacity-40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-mono font-bold ${
                    isActive
                      ? "text-[#00c277]"
                      : isDone
                      ? "text-[#888]"
                      : "text-[#555]"
                  }`}
                >
                  {label}
                </span>
                <span className="text-xs text-[#888]">{layer.name}</span>
                <span className="text-xs text-[#555] ml-auto">
                  {isDone || isActive ? `${layer.queries.length} queries` : ""}
                </span>
              </div>
              {(isDone || isActive) && layer.queries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {layer.queries.slice(0, 6).map((q, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#aaa] truncate max-w-[200px]"
                    >
                      {q}
                    </span>
                  ))}
                  {layer.queries.length > 6 && (
                    <span className="text-[10px] px-2 py-0.5 text-[#555]">
                      +{layer.queries.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
