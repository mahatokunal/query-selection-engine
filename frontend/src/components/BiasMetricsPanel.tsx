"use client";

const LAYER_CONFIG: { key: string; label: string; color: string }[] = [
  { key: "Core (Deterministic)", label: "L1 Core", color: "#3b82f6" },
  { key: "Synonyms", label: "L2 Syn", color: "#f59e0b" },
  { key: "Translations", label: "L3 Trans", color: "#ec4899" },
  { key: "Controlled Random (Bounded)", label: "L4 Rand", color: "#a0522d" },
  { key: "Modality x Target Alias", label: "L5 Mod", color: "#a855f7" },
];

interface BiasMetricsPanelProps {
  layerDistribution: Record<string, number>;
  intraLayerDistances: Record<string, number> | null;
  distanceToNearestTried: Record<string, number> | null;
  horizontal?: boolean;
}

function MetricBar({
  label,
  value,
  maxValue,
  color,
  displayValue,
  warning,
  compact,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  displayValue: string;
  warning?: boolean;
  compact?: boolean;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className="shrink-0 text-[#888] truncate w-16"
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 h-2.5 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 text-right font-mono text-[#aaa]">
        {displayValue}
      </span>
      {warning && (
        <span
          className="text-[#f59e0b] text-xs font-bold"
          title="Low intra-layer distance — possible embedding collapse"
        >
          !
        </span>
      )}
    </div>
  );
}

function MetricSection({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex-1 min-w-0" : ""}>
      <h3
        className={`font-semibold text-[#aaa] uppercase tracking-wider ${compact ? "text-[11px] mb-1.5" : "text-xs mb-2"}`}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function BiasMetricsPanel({
  layerDistribution,
  intraLayerDistances,
  distanceToNearestTried,
  horizontal = false,
}: BiasMetricsPanelProps) {
  const totalSelections = Object.values(layerDistribution).reduce(
    (a, b) => a + b,
    0
  );
  const maxCount = Math.max(...Object.values(layerDistribution), 1);

  const distributionContent =
    totalSelections === 0 ? (
      <p className="text-[10px] text-[#555]">No selections yet</p>
    ) : (
      <div className="space-y-0.5">
        {LAYER_CONFIG.map((layer) => {
          const count = layerDistribution[layer.key] || 0;
          const pct =
            totalSelections > 0
              ? ((count / totalSelections) * 100).toFixed(0)
              : "0";
          return (
            <MetricBar
              key={layer.key}
              label={layer.label}
              value={count}
              maxValue={maxCount}
              color={layer.color}
              displayValue={`${count} (${pct}%)`}
              compact={horizontal}
            />
          );
        })}
      </div>
    );

  const intraContent =
    intraLayerDistances === null ? (
      <p className="text-[10px] text-[#555]">Computing...</p>
    ) : (
      <div className="space-y-0.5">
        {LAYER_CONFIG.map((layer) => {
          const dist = intraLayerDistances[layer.key];
          if (dist === undefined) return null;
          return (
            <MetricBar
              key={layer.key}
              label={layer.label}
              value={dist}
              maxValue={1.0}
              color={layer.color}
              displayValue={dist.toFixed(3)}
              warning={dist < 0.15}
              compact={horizontal}
            />
          );
        })}
      </div>
    );

  const distTriedContent =
    distanceToNearestTried === null ? (
      <p className="text-[10px] text-[#555]">Run a round first</p>
    ) : Object.keys(distanceToNearestTried).length === 0 ? (
      <p className="text-[10px] text-[#555]">No tried queries yet</p>
    ) : (
      <div className="space-y-0.5">
        {LAYER_CONFIG.map((layer) => {
          const dist = distanceToNearestTried[layer.key];
          if (dist === undefined) return null;
          return (
            <MetricBar
              key={layer.key}
              label={layer.label}
              value={dist}
              maxValue={1.0}
              color={layer.color}
              displayValue={dist.toFixed(3)}
              compact={horizontal}
            />
          );
        })}
      </div>
    );

  if (horizontal) {
    return (
      <div className="flex gap-6 w-full">
        <MetricSection title="Layer Distribution" compact>
          {distributionContent}
        </MetricSection>
        <MetricSection title="Intra-Layer Dist" compact>
          {intraContent}
        </MetricSection>
        <MetricSection title="Dist to Tried" compact>
          {distTriedContent}
        </MetricSection>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm overflow-y-auto max-h-full">
      <MetricSection title="Cumulative Layer Distribution">
        {distributionContent}
      </MetricSection>
      <MetricSection title="Avg Intra-Layer Distance">
        {intraContent}
      </MetricSection>
      <MetricSection title="Avg Distance to Nearest Tried">
        {distTriedContent}
      </MetricSection>
    </div>
  );
}
