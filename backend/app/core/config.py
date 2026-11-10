import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Enterprise Brain"
    API_V1_STR: str = "/api"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/enterprise_brain"
    SQLITE_FALLBACK_URL: str = "sqlite:///./enterprise_brain.db"

    # AI / Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    GEMINI_GENERATION_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_DIMENSION: int = 768

    # Authentication (Clerk)
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_JWKS_URL: str = "https://api.clerk.com/v1/jwks"
    ALLOW_DEMO_AUTH: bool = True  # Allows deterministic header-based enterprise demo identity for testing/eval

    # Ingestion & Chunking
    CHUNK_SIZE: int = 700
    CHUNK_OVERLAP: int = 120
    MAX_UPLOAD_SIZE_MB: int = 25
    UPLOAD_DIR: str = "./uploads"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
