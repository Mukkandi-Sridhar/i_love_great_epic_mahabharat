"""Semantic retrieval helpers for policies and products."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from backend.core.config import settings
from backend.core.openai_client import _get_openai_client
from backend.rag.ingest import POLICY_COLLECTION, PRODUCT_COLLECTION, _get_chroma_client


logger = logging.getLogger("ChatbotBackend.rag.retrieve")
MIN_SCORE = 0.30
_embed_cache: dict[str, list[float]] = {}
_embed_pending: dict[str, asyncio.Task[list[float] | None]] = {}
_EMBED_CACHE_MAX = 32


async def _fetch_embedding(query: str) -> list[float] | None:
    """Fetch a query embedding from OpenAI, returning None on provider errors."""
    try:
        client = _get_openai_client()
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=query,
        )
        return response.data[0].embedding
    except Exception as exc:
        logger.warning("Query embedding failed: %s", exc)
        return None


async def _embed_query(query: str) -> list[float] | None:
    """Embed a user query with a small module-level cache."""
    normalized = query.strip()
    if not normalized or not settings.openai_api_key:
        return None

    key = normalized.lower()
    if key in _embed_cache:
        return _embed_cache[key]

    task = _embed_pending.get(key)
    if task is None:
        task = asyncio.create_task(_fetch_embedding(normalized))
        _embed_pending[key] = task

    try:
        embedding = await task
    finally:
        if _embed_pending.get(key) is task:
            del _embed_pending[key]

    if embedding:
        if key not in _embed_cache and len(_embed_cache) >= _EMBED_CACHE_MAX:
            _embed_cache.pop(next(iter(_embed_cache)))
        _embed_cache[key] = embedding
    return embedding


def _query_collection(name: str, embedding: list[float], n_results: int) -> dict[str, Any]:
    """Run a blocking Chroma query for a single embedding."""
    client = _get_chroma_client()
    if client is None:
        return {}
    collection = client.get_or_create_collection(name=name)
    return collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )


def _score_from_distance(distance: Any) -> float:
    """Convert L2 distance to similarity score for L2-normalized embeddings."""
    try:
        return max(0.0, 1.0 - float(distance) / 2.0)
    except Exception:
        return 0.0


async def retrieve_policies(query: str) -> list[dict]:
    """Retrieve relevant policy chunks for a user query."""
    try:
        embedding = await _embed_query(query)
        if embedding is None:
            return []
        result = await asyncio.to_thread(_query_collection, POLICY_COLLECTION, embedding, 6)
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        output = []
        for text, metadata, distance in zip(documents, metadatas, distances):
            output.append(
                {
                    "text": text,
                    "section": (metadata or {}).get("section", "General"),
                    "score": _score_from_distance(distance),
                }
            )
        return [item for item in output if item["score"] >= MIN_SCORE]
    except Exception as exc:
        logger.warning("Policy retrieval failed gracefully: %s", exc)
        return []


async def retrieve_products(query: str) -> list[dict]:
    """Retrieve relevant products for a user query."""
    try:
        embedding = await _embed_query(query)
        if embedding is None:
            return []
        result = await asyncio.to_thread(_query_collection, PRODUCT_COLLECTION, embedding, 4)
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        output = []
        for text, metadata, distance in zip(documents, metadatas, distances):
            metadata = metadata or {}
            output.append(
                {
                    "text": text,
                    "product_id": metadata.get("product_id", ""),
                    "title": metadata.get("title", ""),
                    "type": metadata.get("type", ""),
                    "price": metadata.get("price", 0),
                    "language": metadata.get("language", ""),
                    "score": _score_from_distance(distance),
                }
            )
        return [item for item in output if item["score"] >= MIN_SCORE]
    except Exception as exc:
        logger.warning("Product retrieval failed gracefully: %s", exc)
        return []
