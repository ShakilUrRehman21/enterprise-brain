import logging
from typing import Generator

from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def _build_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        eng = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_conn, _):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

        return eng
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)


engine: Engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


class LegacySchemaError(RuntimeError):
    pass


def _check_legacy_schema() -> None:
    """The pre-1.0 demo schema had no passwords; its users can't sign in.

    Fail fast with an actionable message instead of crashing later on inserts.
    """
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        if "password_hash" not in cols:
            raise LegacySchemaError(
                "This database was created by an older version of Enterprise Brain "
                "(demo header login, no passwords). Reset it with "
                "`python -m app.manage reset-db` (this deletes all data), "
                "or point DATABASE_URL at a new database."
            )


def init_db() -> None:
    from app import models  # noqa: F401 - register tables

    _check_legacy_schema()
    Base.metadata.create_all(bind=engine)


def reset_db() -> None:
    from app import models  # noqa: F401

    from sqlalchemy import MetaData

    meta = MetaData()
    meta.reflect(bind=engine)
    meta.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
