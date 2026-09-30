from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from backend.app.config import settings
from backend.app.db.base import Base

try:
    engine = create_engine(
        settings.sync_database_url,
        pool_pre_ping=True,
    )
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    # Fallback to local SQLite database for standalone offline execution
    import os
    import sys
    # On serverless (like Vercel/AWS Lambda), the code directory is read-only; /tmp is writable
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        db_path = "/tmp/veriai_fallback.db"
    else:
        db_path = os.path.join(os.path.dirname(__file__), "veriai_fallback.db")
    print(f"[VeriAI DB] Warning: PostgreSQL connection failed ({e}). Falling back to SQLite at {db_path}", file=sys.stderr)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


__all__ = ["Base", "engine", "SessionLocal", "get_db"]
