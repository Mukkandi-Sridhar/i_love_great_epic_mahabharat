"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    """Return a stripped environment value with a safe default."""
    return os.getenv(name, default).strip()


def _int_env(name: str, default: int) -> int:
    """Return an integer environment value, falling back on malformed input."""
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    """Return a boolean environment value from common truthy strings."""
    value = _env(name, "true" if default else "false").lower()
    return value in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Typed settings used by backend modules."""

    openai_api_key: str = _env("OPENAI_API_KEY")
    openai_chat_model: str = _env("OPENAI_CHAT_MODEL", _env("OPENAI_MODEL", "gpt-4o-mini"))
    openai_embedding_model: str = _env("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    firebase_service_account_path: str = _env("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    firebase_credentials: str = _env("FIREBASE_CREDENTIALS")
    razorpay_key_id: str = _env("RAZORPAY_KEY_ID")
    razorpay_key_secret: str = _env("RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str = _env("RAZORPAY_WEBHOOK_SECRET")
    app_env: str = _env("APP_ENV", _env("ENVIRONMENT", "production")).lower()
    allow_payment_bypass: bool = _bool_env("ALLOW_PAYMENT_BYPASS", False)
    chroma_dir: str = _env("CHROMA_DIR", "./storage/chroma")
    policies_file: str = _env("POLICIES_FILE", "./backend/company_policies_rag.txt")
    cors_origins: str = _env(
        "CORS_ORIGINS",
        (
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:8080,http://127.0.0.1:8080"
        ),
    )
    # Deprecated: admin routes now use Firebase JWT + /admins/{uid}.
    admin_secret: str = _env("ADMIN_SECRET")
    chunk_size: int = _int_env("CHUNK_SIZE", 500)
    chunk_overlap: int = _int_env("CHUNK_OVERLAP", 100)
    top_k: int = _int_env("TOP_K", 4)
    max_tool_rounds: int = _int_env("MAX_TOOL_ROUNDS", 5)
    auth_cache_ttl: int = _int_env("AUTH_CACHE_TTL", 1800)
    history_limit: int = _int_env("HISTORY_LIMIT", 12)

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a cleaned list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_dev(self) -> bool:
        """Return whether the backend is running in a local/dev environment."""
        return self.app_env in {"dev", "development", "local", "test"}

    @property
    def firebase_service_account_file(self) -> Path:
        """Resolve the Firebase credential path from common run directories."""
        path = Path(self.firebase_service_account_path)
        if path.is_absolute():
            return path
        backend_candidate = BACKEND_DIR / path
        if backend_candidate.exists():
            return backend_candidate
        return PROJECT_DIR / path

    @property
    def chroma_path(self) -> Path:
        """Resolve Chroma storage path for local persistence."""
        path = Path(self.chroma_dir)
        return path if path.is_absolute() else PROJECT_DIR / path

    @property
    def policies_path(self) -> Path:
        """Resolve the policies file from either project or backend cwd."""
        path = Path(self.policies_file)
        if path.is_absolute():
            return path
        project_candidate = PROJECT_DIR / path
        if project_candidate.exists():
            return project_candidate
        return BACKEND_DIR / path.name


settings = Settings()
