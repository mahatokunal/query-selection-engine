import { QueryState } from "./types";

export interface MetricsSnapshot {
  round: number;
  layerDistribution: Record<string, number>;
  distanceToNearestTried: Record<string, number> | null;
}

/**
 * Generate a CSV string with all queries grouped by expansion layer.
 */
export function generateQueriesCSV(queryStates: QueryState[]): string {
  const headers = ["Layer", "Query Index", "Query", "Status", "Selected In Round"];
  const rows: string[] = [headers.join(",")];

  // Group by layer, preserving original order
  const layerOrder: string[] = [];
  for (const q of queryStates) {
    if (!layerOrder.includes(q.layer)) layerOrder.push(q.layer);
  }

  for (const layer of layerOrder) {
    const layerQueries = queryStates.filter((q) => q.layer === layer);
    for (const q of layerQueries) {
      const escapedQuery = `"${q.query.replace(/"/g, '""')}"`;
      const round = q.selectedInRound != null ? String(q.selectedInRound) : "";
      rows.push([layer, q.index + 1, escapedQuery, q.status, round].join(","));
    }
  }

  return rows.join("\n");
}

/**
 * Generate a plain-text bias metrics report.
 */
export function generateMetricsTXT(
  intraLayerDistances: Record<string, number> | null,
  metricsHistory: MetricsSnapshot[],
  totalQueries: number,
  triedCount: number,
  currentRound: number,
  queryStates: QueryState[]
): string {
  const lines: string[] = [];

  lines.push("=== BIAS DETECTION METRICS REPORT ===");
  lines.push(
    `Total queries: ${totalQueries} | Tried: ${triedCount} | Rounds: ${currentRound}`
  );
  lines.push("");

  // Queries generated per layer
  lines.push("--- Queries Generated per Layer ---");
  const layerCounts: Record<string, number> = {};
  const layerOrder: string[] = [];
  for (const q of queryStates) {
    if (!layerOrder.includes(q.layer)) layerOrder.push(q.layer);
    layerCounts[q.layer] = (layerCounts[q.layer] || 0) + 1;
  }
  if (layerOrder.length > 0) {
    const maxLayerLen = Math.max(...layerOrder.map((k) => k.length));
    for (const layer of layerOrder) {
      const label = layer.padEnd(maxLayerLen + 2);
      lines.push(`${label}${layerCounts[layer]}`);
    }
  } else {
    lines.push("(no queries)");
  }
  lines.push("");

  // Intra-layer distances (static, computed once after embedding)
  lines.push("--- Intra-Layer Distance (static) ---");
  if (intraLayerDistances) {
    const maxKeyLen = Math.max(...Object.keys(intraLayerDistances).map((k) => k.length));
    for (const [layer, dist] of Object.entries(intraLayerDistances)) {
      const label = layer.padEnd(maxKeyLen + 2);
      const flag = dist < 0.1 ? "  ⚠ LOW" : "";
      lines.push(`${label}${dist.toFixed(3)}${flag}`);
    }
  } else {
    lines.push("(not computed)");
  }
  lines.push("");

  // Per-round snapshots
  for (const snap of metricsHistory) {
    lines.push(`--- Round ${snap.round} ---`);

    // Layer distribution
    const distParts: string[] = [];
    const totalSelected = Object.values(snap.layerDistribution).reduce((a, b) => a + b, 0);
    for (const [layer, count] of Object.entries(snap.layerDistribution)) {
      const pct = totalSelected > 0 ? Math.round((count / totalSelected) * 100) : 0;
      distParts.push(`${layer}=${count}(${pct}%)`);
    }
    lines.push(`Layer Distribution: ${distParts.join(", ")}`);

    // Distance to nearest tried
    if (snap.distanceToNearestTried) {
      const dttParts: string[] = [];
      for (const [layer, dist] of Object.entries(snap.distanceToNearestTried)) {
        dttParts.push(`${layer}=${dist.toFixed(3)}`);
      }
      lines.push(`Dist to Tried:     ${dttParts.join(", ")}`);
    } else {
      lines.push("Dist to Tried:     (not available)");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Trigger a browser file download from a string content blob.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
