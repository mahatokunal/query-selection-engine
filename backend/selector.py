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


def _find_layer_medoid(
    embeddings: np.ndarray, indices: list[int]
) -> int:
    """Find the query closest to the centroid of the given indices."""
    layer_embs = embeddings[indices]
    centroid = layer_embs.mean(axis=0)
    centroid = centroid / (np.linalg.norm(centroid) + 1e-10)
    # Cosine similarity to centroid
    sims = layer_embs @ centroid
    best_local = int(np.argmax(sims))
    return indices[best_local]


def _compute_rebalancing(
    layer_selection_counts: dict[str, int],
    all_layer_names: list[str],
) -> tuple[set[str], set[str]]:
    """Compute which layers are starved (below lower bound) and oversaturated (above upper bound).

    Bounds: lower = 100/(2.5*k)%, upper = (100*2.5/k)%
    where k = number of unique layers.

    Returns (starved_layers, oversaturated_layers).
    """
    unique_layers = sorted(set(all_layer_names))
    k = len(unique_layers)
    if k == 0:
        return set(), set()

    total_selections = sum(layer_selection_counts.values())
    if total_selections == 0:
        return set(), set()

    lower_pct = 100.0 / (2.5 * k)  # e.g. 8% for k=5
    upper_pct = 100.0 * 2.5 / k     # e.g. 50% for k=5

    starved: set[str] = set()
    oversaturated: set[str] = set()

    for layer in unique_layers:
        count = layer_selection_counts.get(layer, 0)
        pct = (count / total_selections) * 100.0
        if pct < lower_pct:
            starved.add(layer)
        elif pct > upper_pct:
            oversaturated.add(layer)

    return starved, oversaturated


def select_queries(
    queries: list[str],
    embeddings_2d: list[list[float]],
    tried_indices: list[int],
    promising_indices: list[int],
    k: int = 5,
    cached_embeddings: np.ndarray | None = None,
    layers: list[str] | None = None,
    current_round: int = 1,
    layer_selection_counts: dict[str, int] | None = None,
) -> SelectResponse:
    if cached_embeddings is not None:
        full_embeddings = cached_embeddings
    else:
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

    # --- Round 1: medoid-per-layer seeding ---
    is_first_round = not reference_indices
    if is_first_round and layers:
        # Group untried indices by layer
        layer_groups: dict[str, list[int]] = {}
        for idx in untried:
            layer_name = layers[idx] if idx < len(layers) else ""
            layer_groups.setdefault(layer_name, []).append(idx)

        # Pick medoid from each layer
        medoid_selections: list[tuple[int, str]] = []
        for layer_name, group_indices in layer_groups.items():
            medoid_idx = _find_layer_medoid(full_embeddings, group_indices)
            medoid_selections.append((medoid_idx, layer_name))

        # Take up to explore_count medoids
        for medoid_idx, layer_name in medoid_selections[:explore_count]:
            selected.append(
                SelectedQuery(
                    index=medoid_idx,
                    query=queries[medoid_idx],
                    reason=f"Layer medoid for {layer_name}: closest to layer centroid. Ensures unbiased layer coverage in round 1.",
                    nearest_tried_index=None,
                    nearest_tried_query=None,
                    distance=0.0,
                    is_exploit=False,
                )
            )
            reference_indices.append(medoid_idx)
            untried.remove(medoid_idx)

        # If more explore slots remain (k > num_layers), fill with farthest-first
        explore_count -= len(medoid_selections[:explore_count])

    # --- Layer rebalancing: every 5 rounds after the first 5 ---
    rebalance_slots_used = 0
    if (
        current_round > 5
        and current_round % 5 == 1  # round 6, 11, 16, 21... (first round after checkpoint)
        and layers
        and layer_selection_counts
        and explore_count > 0
    ):
        starved, oversaturated = _compute_rebalancing(
            layer_selection_counts, list(set(layers))
        )

        if starved:
            # Group untried by layer
            layer_untried: dict[str, list[int]] = {}
            for idx in untried:
                layer_name = layers[idx] if idx < len(layers) else ""
                layer_untried.setdefault(layer_name, []).append(idx)

            # Reserve 1 slot per starved layer (up to half of explore slots)
            max_rebalance = max(1, explore_count // 2)
            for starved_layer in sorted(starved):
                if rebalance_slots_used >= max_rebalance:
                    break
                candidates = layer_untried.get(starved_layer, [])
                if not candidates:
                    continue

                # Pick farthest from reference within this layer
                if reference_indices:
                    best_idx = None
                    best_dist = -1.0
                    best_ref = None
                    for idx in candidates:
                        distances = [
                            _cosine_distance(full_embeddings[idx], full_embeddings[ref])
                            for ref in reference_indices
                        ]
                        min_dist = min(distances)
                        nearest_ref = reference_indices[distances.index(min_dist)]
                        if min_dist > best_dist:
                            best_dist = min_dist
                            best_idx = idx
                            best_ref = nearest_ref
                else:
                    best_idx = candidates[0]
                    best_dist = 0.0
                    best_ref = None

                if best_idx is not None:
                    nearest_query = queries[best_ref] if best_ref is not None else None
                    nearest_truncated = (
                        (nearest_query[:60] + "...") if nearest_query and len(nearest_query) > 60 else nearest_query
                    )
                    selected.append(
                        SelectedQuery(
                            index=best_idx,
                            query=queries[best_idx],
                            reason=(
                                f"Rebalance: layer '{starved_layer}' below minimum threshold. "
                                f"Distance {best_dist:.2f} from nearest tried"
                                f"{f' (q{best_ref}: {nearest_truncated})' if best_ref is not None else ''}."
                            ),
                            nearest_tried_index=best_ref,
                            nearest_tried_query=nearest_query,
                            distance=best_dist,
                            is_exploit=False,
                        )
                    )
                    reference_indices.append(best_idx)
                    untried.remove(best_idx)
                    rebalance_slots_used += 1

        # For remaining farthest-first slots, exclude oversaturated layers
        if oversaturated:
            untried = [
                i for i in untried
                if (layers[i] if i < len(layers) else "") not in oversaturated
            ]

    remaining_explore = explore_count - rebalance_slots_used

    # --- Farthest-first traversal for remaining slots ---
    for _ in range(min(remaining_explore, len(untried))):
        # Fallback: if still no reference (no layers provided, empty pool)
        if not reference_indices:
            first_idx = untried[0]
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
