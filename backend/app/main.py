"""
VeriAI Knowledge Base API - FastAPI main application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

import sys
import types
from pathlib import Path

# Ensure repo root and backend service root are on sys.path
_current_dir = Path(__file__).resolve().parent          # .../app
_service_root = _current_dir.parent                     # .../backend (or /var/task in Vercel)
_repo_root = _service_root.parent                       # .../repo_root

for _p in (_repo_root, _service_root):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

# When deployed inside a service root in Vercel, /var/task is the backend directory itself,
# so `backend` package does not exist on disk as a parent folder. Alias it to _service_root.
if "backend" not in sys.modules:
    try:
        import backend  # noqa: F401
    except ImportError:
        _backend_pkg = types.ModuleType("backend")
        _backend_pkg.__path__ = [str(_service_root)]
        sys.modules["backend"] = _backend_pkg

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
