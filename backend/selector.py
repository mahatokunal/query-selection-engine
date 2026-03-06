import numpy as np
from sentence_transformers import SentenceTransformer

from models import SelectResponse, SelectedQuery

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10)
    return float(1.0 - sim)


def select_queries(
    queries: list[str],
    embeddings_2d: list[list[float]],
    tried_indices: list[int],
    promising_indices: list[int],
    k: int = 5,
) -> SelectResponse:
    model = _get_model()
    full_embeddings = model.encode(queries, normalize_embeddings=True)

    selected: list[SelectedQuery] = []

    # Exploit: auto-include promising queries
    exploit_indices = []
    for idx in promising_indices:
        if idx not in tried_indices:
            continue
        exploit_indices.append(idx)
        selected.append(
            SelectedQuery(
                index=idx,
                query=queries[idx],
                reason=f"Re-selected: marked promising in previous round",
                nearest_tried_index=None,
                nearest_tried_query=None,
                distance=0.0,
                is_exploit=True,
            )
        )

    # Ensure at least 1 explore slot
    explore_count = max(1, k - len(exploit_indices))
    if len(exploit_indices) + explore_count > k:
        explore_count = k - len(exploit_indices)

    # All indices that are already tried or being exploited
    excluded = set(tried_indices) | set(exploit_indices)
    untried = [i for i in range(len(queries)) if i not in excluded]

    # Reference set: all tried + all already selected this round
    reference_indices = list(set(tried_indices) | set(exploit_indices))

    # Farthest-first traversal on untried queries
    for _ in range(min(explore_count, len(untried))):
        # If no reference points yet (first round, first pick), pick a random starting point
        if not reference_indices:
            import random
            first_idx = random.choice(untried)
            selected.append(
                SelectedQuery(
                    index=first_idx,
                    query=queries[first_idx],
                    reason="First selection: starting point for farthest-first traversal.",
                    nearest_tried_index=None,
                    nearest_tried_query=None,
                    distance=0.0,
                    is_exploit=False,
                )
            )
            reference_indices.append(first_idx)
            untried.remove(first_idx)
            continue

        best_idx = None
        best_min_dist = -1.0
        best_nearest_ref = None

        for idx in untried:
            distances = [
                _cosine_distance(full_embeddings[idx], full_embeddings[ref])
                for ref in reference_indices
            ]
            min_dist = min(distances)
            nearest_ref = reference_indices[distances.index(min_dist)]

            if min_dist > best_min_dist:
                best_min_dist = min_dist
                best_idx = idx
                best_nearest_ref = nearest_ref

        if best_idx is None:
            break

        nearest_query = queries[best_nearest_ref] if best_nearest_ref is not None else None
        nearest_truncated = (
            (nearest_query[:60] + "...") if nearest_query and len(nearest_query) > 60 else nearest_query
        )

        selected.append(
            SelectedQuery(
                index=best_idx,
                query=queries[best_idx],
                reason=(
                    f"Distance {best_min_dist:.2f} from nearest tried query "
                    f"(q{best_nearest_ref}: {nearest_truncated}). "
                    f"Fills biggest gap in search space."
                ),
                nearest_tried_index=best_nearest_ref,
                nearest_tried_query=nearest_query,
                distance=best_min_dist,
                is_exploit=False,
            )
        )

        reference_indices.append(best_idx)
        untried.remove(best_idx)

    return SelectResponse(
        selected=selected,
        exploit_count=len(exploit_indices),
        explore_count=len(selected) - len(exploit_indices),
    )
