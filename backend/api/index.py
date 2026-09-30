"""
Vercel FastAPI entry point.

Vercel discovers this file at backend/api/index.py when the service root is
set to `backend/` with framework `fastapi`.

The main application lives at backend/app/main.py and uses absolute imports
relative to the repository root (e.g. `from backend.app.config import settings`).
We add the repository root to sys.path here so those imports resolve correctly
when Vercel runs from within the `backend/` directory.
"""

import sys
from pathlib import Path

# Add repo root (parent of the `backend/` service directory) to sys.path so
# `from backend.app.xxx import ...` resolves correctly.
_service_root = Path(__file__).resolve().parent.parent   # -> .../backend/
_repo_root = _service_root.parent                        # -> .../repo-root/

for _p in (_repo_root, _service_root):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

# Import and re-export the FastAPI application object.
from backend.app.main import app  # noqa: E402  # type: ignore

__all__ = ["app"]
