import numpy as np


def compute_intra_layer_distances(
    embeddings: np.ndarray, layers: list[str]
) -> dict[str, float]:
    """Compute average pairwise cosine distance within each layer.

    Returns {layer_name: avg_pairwise_cosine_distance}.
    Low values indicate the embedding model collapses that layer's queries.
    """
    unique_layers = list(dict.fromkeys(layers))  # preserve order
    result: dict[str, float] = {}

    for layer in unique_layers:
        indices = [i for i, l in enumerate(layers) if l == layer]
        if len(indices) < 2:
            result[layer] = 0.0
            continue

        layer_embs = embeddings[indices]
        # Cosine similarity matrix (embeddings are already normalized)
        sim_matrix = layer_embs @ layer_embs.T
        n = len(indices)
        # Extract upper triangle (excluding diagonal)
        upper_mask = np.triu(np.ones((n, n), dtype=bool), k=1)
        pairwise_sims = sim_matrix[upper_mask]
        avg_distance = float(1.0 - pairwise_sims.mean())
        result[layer] = round(avg_distance, 4)

    return result


def compute_distance_to_nearest_tried(
    embeddings: np.ndarray, layers: list[str], tried_indices: list[int]
) -> dict[str, float]:
    """Compute per-layer average minimum cosine distance to nearest tried query.

    Returns {layer_name: avg_min_distance_to_tried}.
    Measures how well tried queries cover each layer.
    """
    if not tried_indices:
        return {}

    unique_layers = list(dict.fromkeys(layers))
    tried_embs = embeddings[tried_indices]
    result: dict[str, float] = {}

    for layer in unique_layers:
        indices = [i for i, l in enumerate(layers) if l == layer]
        # Only consider untried queries in this layer
        untried_in_layer = [i for i in indices if i not in set(tried_indices)]
        if not untried_in_layer:
            result[layer] = 0.0
            continue

        layer_embs = embeddings[untried_in_layer]
        # Cosine similarity: each untried vs all tried
        sim_matrix = layer_embs @ tried_embs.T
        # Distance = 1 - similarity; min distance = 1 - max similarity
        max_sims = sim_matrix.max(axis=1)
        avg_min_distance = float((1.0 - max_sims).mean())
        result[layer] = round(avg_min_distance, 4)

    return result
