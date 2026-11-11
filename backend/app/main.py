import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app import __version__
from app.api.routes import auth, chat, documents, system, users
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models import DocStatus, Document, Role, User

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("enterprise_brain")


def _bootstrap() -> None:
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    init_db()
    with SessionLocal() as db:
        # Optional admin from environment variables (handy for deployments).
        if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
            email = settings.ADMIN_EMAIL.lower()
            if not db.scalar(select(User).where(User.email == email)):
                db.add(User(email=email, full_name="Administrator", password_hash=hash_password(settings.ADMIN_PASSWORD), role=Role.ADMIN))
                logger.info("Created admin account %s", email)
        # Documents left 'processing' by a crash/restart will never finish; flag them.
        for doc in db.scalars(select(Document).where(Document.status == DocStatus.PROCESSING)):
            doc.status, doc.error_message = DocStatus.FAILED, "Processing was interrupted. Reprocess the document."
        db.commit()


def _reindex_in_background() -> None:
    """After a Gemini key is added, existing passages still carry local vectors.
    Re-embed them without blocking startup (search keeps working meanwhile)."""
    from app.services.embeddings import embeddings
    from app.services.ingestion.pipeline import reindex_stale_embeddings
    from app.services.retrieval import chunk_cache

    if embeddings.gemini is None:
        return

    def run():
        try:
            with SessionLocal() as db:
                n = reindex_stale_embeddings(db)
            if n:
                chunk_cache.clear()
                logger.info("Re-embedded %d passages with %s", n, embeddings.active.model_id)
        except Exception:
            logger.exception("Background re-indexing failed; run `python -m app.manage reindex` to retry.")

    threading.Thread(target=run, name="reindex", daemon=True).start()


@asynccontextmanager
async def lifespan(_: FastAPI):
    _bootstrap()
    _reindex_in_background()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=__version__,
    description="Permission-aware document Q&A with verifiable citations.",
    lifespan=lifespan,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    msg = first.get("msg", "Invalid request").removeprefix("Value error, ")
    return JSONResponse(
        status_code=422,
        content={"detail": f"{field}: {msg}", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Try again."})


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "version": __version__}


for module in (auth, users, documents, chat, system):
    app.include_router(module.router, prefix=settings.API_PREFIX)
