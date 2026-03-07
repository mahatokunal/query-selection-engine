import { LayerResult, MetricsData, StructuredQuery, ParseResponse } from "./types";

const API_BASE = "http://localhost:8000";

export async function parseQuery(rawQuery: string, model: string): Promise<ParseResponse> {
  const res = await fetch(`${API_BASE}/api/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_query: rawQuery, model }),
  });
  if (!res.ok) throw new Error(`Parse failed: ${res.statusText}`);
  return res.json();
}

export async function expandQuery(targetQuery: string, poolSize: number) {
  const res = await fetch(`${API_BASE}/api/expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_query: targetQuery, pool_size: poolSize }),
  });
  if (!res.ok) throw new Error(`Expand failed: ${res.statusText}`);
  return res.json();
}

export async function expandQueryStream(
  targetQuery: string,
  poolSize: number,
  model: string,
  onLayer: (layer: LayerResult) => void,
  structuredQuery?: StructuredQuery
): Promise<void> {
  const body: Record<string, unknown> = {
    target_query: targetQuery,
    pool_size: poolSize,
    model,
  };
  if (structuredQuery) {
    body.structured_query = structuredQuery;
  }

  const res = await fetch(`${API_BASE}/api/expand/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Expand failed: ${res.statusText}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.trim()) {
        onLayer(JSON.parse(line) as LayerResult);
      }
    }
  }
  // Process any remaining buffer
  if (buffer.trim()) {
    onLayer(JSON.parse(buffer) as LayerResult);
  }
}

export async function embedQueries(queries: string[]) {
  const res = await fetch(`${API_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.statusText}`);
  return res.json();
}

export async function selectQueries(
  queries: string[],
  embeddings2d: number[][],
  triedIndices: number[],
  promisingIndices: number[],
  k: number = 5,
  layers: string[] = [],
  currentRound: number = 1,
  layerSelectionCounts: Record<string, number> = {}
) {
  const res = await fetch(`${API_BASE}/api/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queries,
      embeddings_2d: embeddings2d,
      tried_indices: triedIndices,
      promising_indices: promisingIndices,
      k,
      layers,
      current_round: currentRound,
      layer_selection_counts: layerSelectionCounts,
    }),
  });
  if (!res.ok) throw new Error(`Select failed: ${res.statusText}`);
  return res.json();
}

export async function computeMetrics(
  layers: string[],
  triedIndices: number[],
  computeIntraLayer: boolean,
  computeDistanceToTried: boolean
): Promise<MetricsData> {
  const res = await fetch(`${API_BASE}/api/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layers,
      tried_indices: triedIndices,
      compute_intra_layer: computeIntraLayer,
      compute_distance_to_tried: computeDistanceToTried,
    }),
  });
  if (!res.ok) throw new Error(`Metrics failed: ${res.statusText}`);
  return res.json();
}
