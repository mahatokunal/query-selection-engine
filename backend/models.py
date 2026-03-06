from pydantic import BaseModel


class ExpandRequest(BaseModel):
    target_query: str
    pool_size: int = 50
    model: str = "gpt-4.1-mini"


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
