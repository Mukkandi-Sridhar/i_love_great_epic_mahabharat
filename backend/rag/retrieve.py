"""Semantic retrieval helpers for policies and products."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from openai import AsyncOpenAI

from backend.core.config import settings
from backend.rag.ingest import POLICY_COLLECTION, PRODUCT_COLLECTION, _get_chroma_client


logger = logging.getLogger("ChatbotBackend.rag.retrieve")


async def _embed_query(query: str) -> list[float] | None:
    """Embed a user query, returning None on any provider error."""
    if not query.strip() or not settings.openai_api_key:
        return None
    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=query,
        )
        return response.data[0].embedding
    except Exception as exc:
        logger.warning("Query embedding failed: %s", exc)
        return None


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
    """Convert a Chroma distance into a bounded relevance score."""
    try:
        value = float(distance)
        return max(0.0, min(1.0, 1.0 - value))
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
        return output
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
        return output
    except Exception as exc:
        logger.warning("Product retrieval failed gracefully: %s", exc)
        return []
