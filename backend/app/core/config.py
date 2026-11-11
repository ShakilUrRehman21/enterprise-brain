from functools import lru_cache
from pathlib import Path
from typing import List, Union

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent

INSECURE_DEFAULT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    """Application settings, read from environment variables or a .env file.

    Relative paths (upload dir, SQLite file) resolve against the backend folder,
    so the app behaves the same no matter which directory it is started from.
    """

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Enterprise Brain"
    API_PREFIX: str = "/api"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database. SQLite by default; set a postgresql:// URL for production.
    DATABASE_URL: str = "sqlite:///./data/enterprise_brain.db"

    # Authentication
    SECRET_KEY: str = INSECURE_DEFAULT_SECRET
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12
    ALLOW_REGISTRATION: bool = True
    # Optional bootstrap admin, created on startup if it doesn't exist.
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # AI provider (Google Gemini). Without a key the app runs fully offline
    # using local embeddings and extractive answers.
    GEMINI_API_KEY: str = ""
    # auto | developer | vertex. "auto" tries the Gemini Developer API first and
    # switches to Vertex AI express mode if the key is bound to Vertex instead.
    GEMINI_BACKEND: str = "auto"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_GENERATION_MODEL: str = "gemini-3.8-flash"
    EMBEDDING_DIMENSION: int = 768
    # Time limits: per Gemini HTTP call, and in total for producing one answer
    # (after which the offline extractive answer is used instead).
    GEMINI_TIMEOUT_SECONDS: int = 20
    ANSWER_TIME_BUDGET_SECONDS: int = 45

    # Ingestion
    CHUNK_SIZE: int = 350  # words
    CHUNK_OVERLAP: int = 60  # words
    MAX_UPLOAD_SIZE_MB: int = 25
    UPLOAD_DIR: str = "./data/uploads"

    # Retrieval / answering
    RETRIEVAL_TOP_K: int = 6
    MIN_QUERY_COVERAGE: float = 0.6

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _check_production_secret(self) -> "Settings":
        if self.is_production and self.SECRET_KEY == INSECURE_DEFAULT_SECRET:
            raise ValueError("SECRET_KEY must be set to a strong random value in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        # Render/Heroku style URLs
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            rel = url[len("sqlite:///"):]
            if rel != ":memory:":
                path = (BACKEND_DIR / rel).resolve()
                path.parent.mkdir(parents=True, exist_ok=True)
                url = f"sqlite:///{path.as_posix()}"
        return url

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.GEMINI_API_KEY.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
