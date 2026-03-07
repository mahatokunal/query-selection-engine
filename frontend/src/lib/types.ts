export interface LayerResult {
  name: string;
  queries: string[];
}

// --- Structured Query types ---

export const MODALITY_OPTIONS = [
  "Small molecule",
  "PROTAC / Degrader",
  "Molecular glue",
  "Antibody (mAb)",
  "ADC (Antibody-Drug Conjugate)",
  "Bispecific antibody",
  "CAR-T / Cell therapy",
  "Gene therapy / RNA",
  "Peptide",
  "Vaccine",
] as const;

export const STAGE_OPTIONS = [
  "Discovery",
  "Preclinical",
  "IND-enabling",
  "Phase 1",
  "Phase 1/2",
  "Phase 2",
  "Phase 3",
  "Approved / Marketed",
] as const;

export const GEOGRAPHY_OPTIONS = [
  "Global",
  "US",
  "EU",
  "China",
  "Japan",
] as const;

export const MECHANISM_OPTIONS = [
  "Direct inhibitor",
  "Allosteric inhibitor",
  "Covalent inhibitor",
  "Degrader (PROTAC/molecular glue)",
  "Antagonist",
  "Agonist",
  "Dual / multi-target",
  "Synthetic lethal",
] as const;

export const ASSET_TYPE_OPTIONS = [
  "Therapeutic",
  "Diagnostic",
  "Biomarker",
  "Platform / Technology",
  "Combination regimen",
] as const;

export interface StructuredQuery {
  target: string;
  modality: string[];
  stage_from: string | null;
  stage_to: string | null;
  indication: string;
  geography: string[];
  mechanism: string[];
  development_status: string;
  asset_type: string[];
  asset_scope: string;
  other_constraints: string;
}

export interface ParseResponse {
  structured: StructuredQuery;
  warnings: string[];
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
