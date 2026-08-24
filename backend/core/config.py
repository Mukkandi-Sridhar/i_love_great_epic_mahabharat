"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
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
    """Typed settings used by backend modules.

    Credential fields are declared with ``repr=False`` so they cannot be
    printed by an accidental ``print(settings)``, a dataclass repr inside a
    traceback, or a logged exception frame. Read them explicitly by name.
    """

    openai_api_key: str = field(default=_env("OPENAI_API_KEY"), repr=False)
    openai_chat_model: str = _env("OPENAI_CHAT_MODEL", _env("OPENAI_MODEL", "gpt-4o-mini"))
    openai_embedding_model: str = _env("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    firebase_service_account_path: str = _env("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    firebase_credentials: str = field(default=_env("FIREBASE_CREDENTIALS"), repr=False)
    razorpay_key_id: str = _env("RAZORPAY_KEY_ID")
    razorpay_key_secret: str = field(default=_env("RAZORPAY_KEY_SECRET"), repr=False)
    razorpay_webhook_secret: str = field(default=_env("RAZORPAY_WEBHOOK_SECRET"), repr=False)

    # Supabase. The service-role key bypasses RLS and must never reach a client;
    # it is what lets the backend remain the only writer of money and access.
    supabase_url: str = _env("SUPABASE_URL")
    supabase_service_role_key: str = field(default=_env("SUPABASE_SERVICE_ROLE_KEY"), repr=False)
    supabase_jwt_secret: str = field(default=_env("SUPABASE_JWT_SECRET"), repr=False)
    # Selects the data backend during the migration: "firebase" (default) or
    # "supabase". Lets the new layer ship dark and be switched per environment.
    data_backend: str = _env("DATA_BACKEND", "firebase").lower()
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
    chunk_size: int = _int_env("CHUNK_SIZE", 500)
    chunk_overlap: int = _int_env("CHUNK_OVERLAP", 100)
    top_k: int = _int_env("TOP_K", 4)
    max_tool_rounds: int = _int_env("MAX_TOOL_ROUNDS", 5)
    auth_cache_ttl: int = _int_env("AUTH_CACHE_TTL", 1800)
    history_limit: int = _int_env("HISTORY_LIMIT", 12)
    # Firestore's own default retry deadline is 300s, which turns an outage or
    # a revoked credential into hung workers rather than a fast error.
    firestore_timeout: int = _int_env("FIRESTORE_TIMEOUT", 15)
    max_response_tokens: int = _int_env("MAX_RESPONSE_TOKENS", 900)
    max_user_message_chars: int = _int_env("MAX_USER_MESSAGE_CHARS", 2000)
    max_tool_result_chars: int = _int_env("MAX_TOOL_RESULT_CHARS", 3500)

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a cleaned list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def use_supabase(self) -> bool:
        """Return whether Supabase is the active data backend."""
        return self.data_backend == "supabase"

    @property
    def supabase_configured(self) -> bool:
        """Return whether Supabase has the credentials it needs to serve traffic."""
        return bool(self.supabase_url and self.supabase_service_role_key and self.supabase_jwt_secret)

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
