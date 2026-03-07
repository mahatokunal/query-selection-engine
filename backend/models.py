from pydantic import BaseModel


# --- Constant option lists ---

MODALITY_OPTIONS = [
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
]

STAGE_OPTIONS = [
    "Discovery",
    "Preclinical",
    "IND-enabling",
    "Phase 1",
    "Phase 1/2",
    "Phase 2",
    "Phase 3",
    "Approved / Marketed",
]

GEOGRAPHY_OPTIONS = [
    "Global",
    "US",
    "EU",
    "China",
    "Japan",
]

MECHANISM_OPTIONS = [
    "Direct inhibitor",
    "Allosteric inhibitor",
    "Covalent inhibitor",
    "Degrader (PROTAC/molecular glue)",
    "Antagonist",
    "Agonist",
    "Dual / multi-target",
    "Synthetic lethal",
]

ASSET_TYPE_OPTIONS = [
    "Therapeutic",
    "Diagnostic",
    "Biomarker",
    "Platform / Technology",
    "Combination regimen",
]


# --- Structured query model ---

class StructuredQuery(BaseModel):
    target: str
    modality: list[str] = []
    stage_from: str | None = None
    stage_to: str | None = None
    indication: str = ""
    geography: list[str] = []
    mechanism: list[str] = []
    development_status: str = "active_only"
    asset_type: list[str] = ["Therapeutic"]
    asset_scope: str = "lead_per_program"
    other_constraints: str = ""


class ParseRequest(BaseModel):
    raw_query: str
    model: str = "gpt-4.1-mini"


class ParseResponse(BaseModel):
    structured: StructuredQuery
    warnings: list[str] = []


# --- Existing models ---

class ExpandRequest(BaseModel):
    target_query: str
    pool_size: int = 50
    model: str = "gpt-4.1-mini"
    structured_query: StructuredQuery | None = None


class LayerResult(BaseModel):
    name: str
    queries: list[str]


class ExpandResponse(BaseModel):
    layers: list[LayerResult]
    all_queries: list[str]


class EmbedRequest(BaseModel):
    queries: list[str]


class Point2D(BaseModel):
    query: str
    index: int
    x: float
    y: float


class EmbedResponse(BaseModel):
    points: list[Point2D]


class SelectRequest(BaseModel):
    queries: list[str]
    embeddings_2d: list[list[float]]
    tried_indices: list[int] = []
    promising_indices: list[int] = []
    k: int = 5
    layers: list[str] = []
    current_round: int = 1
    layer_selection_counts: dict[str, int] = {}


class SelectedQuery(BaseModel):
    index: int
    query: str
    reason: str
    nearest_tried_index: int | None = None
    nearest_tried_query: str | None = None
    distance: float
    is_exploit: bool


class SelectResponse(BaseModel):
    selected: list[SelectedQuery]
    exploit_count: int
    explore_count: int


class MetricsRequest(BaseModel):
    layers: list[str]
    tried_indices: list[int] = []
    compute_intra_layer: bool = False
    compute_distance_to_tried: bool = False


class MetricsResponse(BaseModel):
    intra_layer_distances: dict[str, float] | None = None
    distance_to_nearest_tried: dict[str, float] | None = None
