from dotenv import load_dotenv
load_dotenv()

import json as json_mod

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import (
    ExpandRequest,
    ExpandResponse,
    EmbedRequest,
    EmbedResponse,
    SelectRequest,
    SelectResponse,
)
from query_expander import expand_query, expand_query_stream
from embedder import embed_queries
from selector import select_queries

app = FastAPI(title="Query Selection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/expand", response_model=ExpandResponse)
async def api_expand(req: ExpandRequest):
    layers = await expand_query(req.target_query, req.pool_size, req.model)
    all_queries = []
    for layer in layers:
        all_queries.extend(layer.queries)
    return ExpandResponse(layers=layers, all_queries=all_queries)


@app.post("/api/expand/stream")
async def api_expand_stream(req: ExpandRequest):
    async def generate():
        async for layer in expand_query_stream(req.target_query, req.pool_size, req.model):
            yield json_mod.dumps({"name": layer.name, "queries": layer.queries}) + "\n"
    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/api/embed", response_model=EmbedResponse)
async def api_embed(req: EmbedRequest):
    points = embed_queries(req.queries)
    return EmbedResponse(points=points)


@app.post("/api/select", response_model=SelectResponse)
async def api_select(req: SelectRequest):
    return select_queries(
        queries=req.queries,
        embeddings_2d=req.embeddings_2d,
        tried_indices=req.tried_indices,
        promising_indices=req.promising_indices,
        k=req.k,
    )
