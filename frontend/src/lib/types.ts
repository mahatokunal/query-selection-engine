export interface LayerResult {
  name: string;
  queries: string[];
}

export interface Point2D {
  query: string;
  index: number;
  x: number;
  y: number;
}

export interface SelectedQuery {
  index: number;
  query: string;
  reason: string;
  nearest_tried_index: number | null;
  nearest_tried_query: string | null;
  distance: number;
  is_exploit: boolean;
}

export interface SelectResponse {
  selected: SelectedQuery[];
  exploit_count: number;
  explore_count: number;
}

export type QueryStatus = "untried" | "promising" | "failed" | "selected";

export interface QueryState {
  index: number;
  query: string;
  status: QueryStatus;
  layer: string;
  selectedInRound?: number;
}

export interface RoundResult {
  round: number;
  selected: SelectedQuery[];
  exploit_count: number;
  explore_count: number;
}

export interface MetricsData {
  intra_layer_distances: Record<string, number> | null;
  distance_to_nearest_tried: Record<string, number> | null;
}
