import json
import logging
from typing import Generator
from sqlalchemy import create_engine, text, TypeDecorator, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Custom Embedding column that works on PostgreSQL with pgvector, and on SQLite as JSON/Text
class VectorType(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            if dialect.name == "postgresql":
                # If pgvector is installed in postgres, string format is '[0.1, 0.2, ...]'
                return f"[{','.join(str(float(x)) for x in value)}]"
            return json.dumps([float(x) for x in value])
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                try:
                    return json.loads(value)
                except Exception:
                    # fallback split
                    return [float(x.strip()) for x in value[1:-1].split(",") if x.strip()]
        return value

Base = declarative_base()

def get_engine():
    # Attempt to connect to DATABASE_URL (PostgreSQL)
    try:
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 3} if "postgresql" in settings.DATABASE_URL else {}
        )
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Connected to primary database: {settings.DATABASE_URL.split('@')[-1]}")
        return engine, True
    except Exception as e:
        logger.warning(f"Could not connect to primary PostgreSQL database ({e}). Falling back to SQLite: {settings.SQLITE_FALLBACK_URL}")
        sqlite_engine = create_engine(
            settings.SQLITE_FALLBACK_URL,
            connect_args={"check_same_thread": False}
        )
        return sqlite_engine, False

engine, is_postgres = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    global engine, is_postgres
    try:
        if is_postgres:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
    except Exception as e:
        logger.warning(f"pgvector extension creation notice: {e}")

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

