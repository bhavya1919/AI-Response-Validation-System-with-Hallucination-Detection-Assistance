# ==============================================================================
# VeriAI Backend - Production Dockerfile
# Python 3.11 + FastAPI + FastEmbed (BAAI/bge-small-en-v1.5)
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr and writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

WORKDIR /app

# Install system dependencies (curl for container health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /home/appuser/.cache/fastembed && \
    chown -R appuser:appuser /home/appuser

ENV FASTEMBED_CACHE_PATH=/home/appuser/.cache/fastembed

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Pre-warm BAAI/bge-small-en-v1.5 embedding model into cache during build
# Mitigates cold-start latency; falls back gracefully at runtime if build network is restricted
RUN python -c "import os; os.environ['FASTEMBED_CACHE_PATH']='/home/appuser/.cache/fastembed'; from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')" || true
RUN chown -R appuser:appuser /home/appuser/.cache

# Copy application code and dataset files
COPY backend /app/backend
COPY data /app/data

# Ensure appuser owns /app
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check against FastAPI /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production binding: uvicorn on 0.0.0.0
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
