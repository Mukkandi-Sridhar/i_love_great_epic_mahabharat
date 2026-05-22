"""Shared OpenAI client factory for backend modules."""

from __future__ import annotations

from openai import AsyncOpenAI

from backend.core.config import settings


_openai_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client with shared connection pooling."""
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=30.0,
            max_retries=2,
        )
    return _openai_client
