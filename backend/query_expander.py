import json
import os
import random

from openai import AsyncOpenAI

from models import LayerResult

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

MODALITIES = [
    "small molecule",
    "PROTAC",
    "degrader",
    "antibody",
    "inhibitor",
    "antagonist",
    "covalent inhibitor",
    "ADC",
    "molecular glue",
]

# Layers 1-4 use LLM. Layer 5 is deterministic cross-product.
LLM_LAYER_PROMPTS = {
    "Core (Deterministic)": """Generate direct search queries by combining the target, indication, and modality terms from the input.
These should be straightforward, no creativity — just the obvious keyword combinations.
Examples: "CDK12 inhibitor triple negative breast cancer", "CDK12 small molecule TNBC".""",
    "Synonyms": """Replace key scientific terms with their synonyms and alternative names.
Use official nomenclature, gene names, protein names, and common abbreviations.
Return the queries AND also include a JSON field "aliases" with a list of target name aliases/synonyms you used.
Examples: "cyclin-dependent kinase 12 inhibitor breast cancer", "CDK12 antagonist TNBC".
Return as: {"queries": [...], "aliases": ["cyclin-dependent kinase 12", "CDK12", ...]}""",
    "Translations": """Translate the core queries into Chinese (Simplified), Japanese, and Korean.
These are critical for finding assets in non-English databases.
Examples: "CDK12 抑制剂 三阴性乳腺癌", "CDK12 阻害剤 トリプルネガティブ乳がん".""",
    "Controlled Random (Bounded)": """Generate creative but bounded variations exploring adjacent scientific space.
Think: related targets, mechanisms, pathways, drug modalities.
Stay within the therapeutic area — don't drift to unrelated diseases.
Examples: "CDK12 PROTAC degrader solid tumor", "CDK12 CDK13 dual inhibitor breast".""",
}

ALLOWED_MODELS = {"gpt-4.1-mini", "gpt-5-mini-2025-08-07"}


def _parse_llm_response(content: str, count: int) -> tuple[list[str], list[str]]:
    """Parse LLM response. Returns (queries, aliases)."""
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return [], []

    aliases: list[str] = []
    queries: list[str] = []

    if isinstance(parsed, list):
        queries = [str(q) for q in parsed[:count]]
    elif isinstance(parsed, dict):
        # Extract aliases if present
        if "aliases" in parsed and isinstance(parsed["aliases"], list):
            aliases = [str(a) for a in parsed["aliases"]]

        if "queries" in parsed:
            raw = parsed["queries"]
        else:
            # Skip aliases key, get first list-valued key
            raw = []
            for k, v in parsed.items():
                if k != "aliases" and isinstance(v, list):
                    raw = v
                    break
        if isinstance(raw, list):
            queries = [str(q) for q in raw[:count]]

    return queries, aliases


def _generate_cross_product(aliases: list[str], indication: str, count: int) -> list[str]:
    """Generate modality × alias cross-product queries deterministically."""
    queries: list[str] = []
    for alias in aliases:
        for modality in MODALITIES:
            q = f"{alias} {modality} {indication}".strip()
            queries.append(q)

    # Deduplicate while preserving order
    seen = set()
    unique: list[str] = []
    for q in queries:
        q_lower = q.lower()
        if q_lower not in seen:
            seen.add(q_lower)
            unique.append(q)

    # If we have more than needed, sample; if fewer, return all
    if len(unique) > count:
        # Take a spread rather than just first N
        random.seed(42)
        unique = random.sample(unique, count)

    return unique


async def expand_query(target_query: str, pool_size: int, model: str = "gpt-4.1-mini") -> list[LayerResult]:
    layers: list[LayerResult] = []
    async for layer in expand_query_stream(target_query, pool_size, model):
        layers.append(layer)
    return layers


async def expand_query_stream(target_query: str, pool_size: int, model: str = "gpt-4.1-mini"):
    """Yield LayerResult one at a time. Layers 1-4 use LLM, Layer 5 is deterministic."""
    if model not in ALLOWED_MODELS:
        model = "gpt-4.1-mini"

    queries_per_layer = pool_size // 5
    remainder = pool_size % 5

    collected_aliases: list[str] = []

    for i, (layer_name, layer_instruction) in enumerate(LLM_LAYER_PROMPTS.items()):
        count = queries_per_layer + (1 if i < remainder else 0)

        # For Synonyms layer, ask for aliases too
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a biomedical query expansion engine. "
                        "Generate search queries for finding drug assets in patents, "
                        "clinical trials, academic papers, and company pipelines. "
                        "Return ONLY valid JSON. No explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Target input: {target_query}\n\n"
                        f"Layer: {layer_name}\n"
                        f"Instructions: {layer_instruction}\n\n"
                        f"Generate exactly {count} unique search queries.\n"
                        f'Return as JSON: {{"queries": ["query1", "query2", ...]}}'
                    ),
                },
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or '{"queries": []}'
        queries, aliases = _parse_llm_response(content, count)

        if layer_name == "Synonyms" and aliases:
            collected_aliases = aliases

        yield LayerResult(name=layer_name, queries=queries)

    # Layer 5: Deterministic cross-product (no LLM call)
    l5_count = queries_per_layer + (1 if 4 < remainder else 0)

    # Extract indication from target query (everything after the target name)
    indication = target_query

    # If we didn't get aliases from the Synonyms layer, use the target query as-is
    if not collected_aliases:
        # Extract a basic target name from the query
        collected_aliases = [target_query.split(" for ")[0].split(" in ")[0].strip()]

    cross_queries = _generate_cross_product(collected_aliases, indication, l5_count)
    yield LayerResult(name="Modality x Target Alias", queries=cross_queries)
