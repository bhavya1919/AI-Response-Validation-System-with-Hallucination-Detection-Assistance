"""
VeriAI Knowledge Base API - FastAPI main application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.config import settings
from backend.app.db.session import engine, Base
from backend.app.api import sources, documents, chunks, search, ingest, evaluate


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (idempotent)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="VeriAI Knowledge Base API",
    description="RAG foundation - knowledge sources, documents, chunks, and semantic search",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(sources.router,   prefix=f"{settings.API_PREFIX}/knowledge/sources",   tags=["Sources"])
app.include_router(documents.router, prefix=f"{settings.API_PREFIX}/knowledge/documents", tags=["Documents"])
app.include_router(chunks.router,    prefix=f"{settings.API_PREFIX}/knowledge/chunks",    tags=["Chunks"])
app.include_router(search.router,    prefix=f"{settings.API_PREFIX}/knowledge/search",    tags=["Search"])
app.include_router(ingest.router,    prefix=f"{settings.API_PREFIX}/knowledge/ingest",    tags=["Ingest"])
app.include_router(evaluate.router,  prefix=f"{settings.API_PREFIX}/evaluate",            tags=["Evaluate"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "veriai-kb-api"}


@app.get("/api/health")
def api_health():
    return {"status": "ok", "service": "veriai-kb-api", "db": "connected"}
