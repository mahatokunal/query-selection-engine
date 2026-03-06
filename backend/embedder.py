import numpy as np
from sentence_transformers import SentenceTransformer
from umap import UMAP

from models import Point2D

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_queries(queries: list[str]) -> tuple[list[Point2D], np.ndarray]:
    model = _get_model()
    embeddings = model.encode(queries, normalize_embeddings=True)
    embeddings = np.array(embeddings)

    reducer = UMAP(
        n_components=2,
        random_state=42,
        n_neighbors=min(15, len(queries) - 1),
        min_dist=0.1,
        metric="cosine",
    )
    coords_2d = reducer.fit_transform(embeddings)

    points = []
    for i, query in enumerate(queries):
        points.append(
            Point2D(
                query=query,
                index=i,
                x=float(coords_2d[i, 0]),
                y=float(coords_2d[i, 1]),
            )
        )

    return points, embeddings
