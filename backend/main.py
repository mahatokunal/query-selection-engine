from dotenv import load_dotenv
load_dotenv()

import json as json_mod

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import numpy as np

from models import (
    ExpandRequest,
    ExpandResponse,
    EmbedRequest,
    EmbedResponse,
    SelectRequest,
    SelectResponse,
    MetricsRequest,
    MetricsResponse,
    ParseRequest,
    ParseResponse,
    StructuredQuery,
    MODALITY_OPTIONS,
    STAGE_OPTIONS,
    GEOGRAPHY_OPTIONS,
    MECHANISM_OPTIONS,
    ASSET_TYPE_OPTIONS,
)
import os
from openai import AsyncOpenAI

from query_expander import expand_query, expand_query_stream
from embedder import embed_queries
from selector import select_queries
from metrics import compute_intra_layer_distances, compute_distance_to_nearest_tried

_cached_embeddings: np.ndarray | None = None

_openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

ALLOWED_MODELS = {"gpt-4.1-mini", "gpt-5-mini-2025-08-07"}

app = FastAPI(title="Query Selection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PARSE_SYSTEM_PROMPT = f"""You are a biomedical query parser. Extract structured fields from a user's free-text drug-asset search query.

Return a JSON object with these fields:
- "target" (string, required): The biological target(s). Keep gene names as-is (e.g. "CDK12", "MDM2 & MDM4"). If multiple targets, join with " & ".
- "modality" (array of strings): Select from: {json_mod.dumps(MODALITY_OPTIONS)}. You may also add "Other: <description>" entries. Infer from context (e.g. "inhibitors" → "Small molecule", "degrader" → "PROTAC / Degrader").
- "stage_from" (string or null): Earliest development stage. Options: {json_mod.dumps(STAGE_OPTIONS)}.
- "stage_to" (string or null): Latest development stage. Same options as stage_from.
- "indication" (string): Disease area or indication. Keep it concise (e.g. "Triple Negative Breast Cancer", not the full query).
- "geography" (array of strings): Select from: {json_mod.dumps(GEOGRAPHY_OPTIONS)}. Add "Other: <country>" if needed.
- "mechanism" (array of strings): Select from: {json_mod.dumps(MECHANISM_OPTIONS)}. Infer from context (e.g. "covalent" → "Covalent inhibitor", "PROTAC" → "Degrader (PROTAC/molecular glue)").
- "development_status" (string): "active_only" or "include_discontinued". Default "active_only".
- "asset_type" (array of strings): Select from: {json_mod.dumps(ASSET_TYPE_OPTIONS)}. Default ["Therapeutic"].
- "asset_scope" (string): "lead_per_program" or "all_per_program". Default "lead_per_program".
- "other_constraints" (string): Any constraints not captured above. Leave empty if none.
- "warnings" (array of strings): Issues found during parsing (e.g. "Target not clearly identified", "No indication specified").

Return ONLY valid JSON. No explanation."""


@app.post("/api/parse", response_model=ParseResponse)
async def api_parse(req: ParseRequest):
    model = req.model if req.model in ALLOWED_MODELS else "gpt-4.1-mini"

    response = await _openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": req.raw_query},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or "{}"
    parsed = json_mod.loads(content)

    warnings = parsed.pop("warnings", [])
    if not parsed.get("target"):
        warnings.append("Target not clearly identified — please fill in the Target field.")
    if not parsed.get("indication"):
        warnings.append("No indication specified — results may be very broad.")

    structured = StructuredQuery(**{
        k: v for k, v in parsed.items()
        if k in StructuredQuery.model_fields
    })

    return ParseResponse(structured=structured, warnings=warnings)


@app.post("/api/expand", response_model=ExpandResponse)
async def api_expand(req: ExpandRequest):
    layers = await expand_query(req.target_query, req.pool_size, req.model, req.structured_query)
    all_queries = []
    for layer in layers:
        all_queries.extend(layer.queries)
    return ExpandResponse(layers=layers, all_queries=all_queries)


@app.post("/api/expand/stream")
async def api_expand_stream(req: ExpandRequest):
    async def generate():
        async for layer in expand_query_stream(req.target_query, req.pool_size, req.model, req.structured_query):
            yield json_mod.dumps({"name": layer.name, "queries": layer.queries}) + "\n"
    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/api/embed", response_model=EmbedResponse)
async def api_embed(req: EmbedRequest):
    global _cached_embeddings
    points, embeddings = embed_queries(req.queries)
    _cached_embeddings = embeddings
    return EmbedResponse(points=points)


@app.post("/api/select", response_model=SelectResponse)
async def api_select(req: SelectRequest):
    return select_queries(
        queries=req.queries,
        embeddings_2d=req.embeddings_2d,
        tried_indices=req.tried_indices,
        promising_indices=req.promising_indices,
        k=req.k,
        cached_embeddings=_cached_embeddings,
        layers=req.layers if req.layers else None,
        current_round=req.current_round,
        layer_selection_counts=req.layer_selection_counts if req.layer_selection_counts else None,
    )


@app.post("/api/metrics", response_model=MetricsResponse)
async def api_metrics(req: MetricsRequest):
    if _cached_embeddings is None:
        return MetricsResponse()

    intra = None
    dist_tried = None

    if req.compute_intra_layer:
        intra = compute_intra_layer_distances(_cached_embeddings, req.layers)

    if req.compute_distance_to_tried:
        dist_tried = compute_distance_to_nearest_tried(
            _cached_embeddings, req.layers, req.tried_indices
        )

    return MetricsResponse(
        intra_layer_distances=intra,
        distance_to_nearest_tried=dist_tried,
    )
