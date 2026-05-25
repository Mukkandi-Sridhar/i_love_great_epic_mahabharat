"""ChromaDB ingestion pipeline for policies and product catalog."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.openai_client import _get_openai_client


logger = logging.getLogger("ChatbotBackend.rag.ingest")
POLICY_COLLECTION = "mahabharat_policies"
PRODUCT_COLLECTION = "mahabharat_products"
_chroma_client: Any | None = None


FALLBACK_PRODUCT_CATALOG = [
    {
        "id": "ebook-1",
        "title": "Vijnana Bhairava Tantra",
        "type": "ebook",
        "price": 499,
        "language": "English",
        "description": "Digital PDF with 112 meditation techniques and English commentary.",
        "highlights": ["Digital PDF", "Instant download", "Lifetime access"],
    },
    {
        "id": "ebook-2",
        "title": "Mahabharatam Telugu Edition",
        "type": "ebook",
        "price": 299,
        "language": "Telugu",
        "description": "Complete Telugu digital PDF edition covering all 18 Parvas.",
        "highlights": ["Digital PDF", "Simple Telugu", "Mobile optimized"],
    },
    {
        "id": "pd-1",
        "title": "Sri Mahabharatam Telugu Complete",
        "type": "pendrive",
        "price": 1499,
        "language": "Telugu",
        "description": "Complete Telugu Mahabharatam audio collection on 32GB Pendrive.",
        "highlights": ["32GB Pendrive", "Crystal clear audio", "Free OTG adapter"],
    },
    {
        "id": "pd-2",
        "title": "Sri Mahabharatam Telugu Unseen",
        "type": "pendrive",
        "price": 1299,
        "language": "Telugu",
        "description": "Rare and untold Telugu Mahabharatam stories on 16GB Pendrive.",
        "highlights": ["16GB Pendrive", "Rare episodes", "HD audio"],
    },
    {
        "id": "pd-3",
        "title": "Sri Mahabharatam Ultimate 64GB",
        "type": "pendrive",
        "price": 1999,
        "language": "Telugu",
        "description": "Ultimate Telugu collection with complete and unseen episodes on 64GB Pendrive.",
        "highlights": ["64GB Pendrive", "Complete plus unseen pack", "Best value"],
    },
    {
        "id": "pd-4",
        "title": "Sri Mahabharat Hindi Complete",
        "type": "pendrive",
        "price": 1499,
        "language": "Hindi",
        "description": "Complete Hindi Mahabharat narration on 32GB Pendrive.",
        "highlights": ["32GB Pendrive", "Hindi narration", "Studio quality"],
    },
]


async def _load_products_from_firestore() -> list[dict]:
    """Load product documents from Firestore for product RAG ingestion."""
    db = get_firestore_client()
    if db is None:
        return []

    def _read() -> list[dict]:
        products = []
        for doc in db.collection("products").stream():
            data = doc.to_dict() or {}
            products.append({"id": doc.id, **data})
        return products

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("Could not load products from Firestore for RAG: %s", exc)
        return []


def _hash_text(text: str) -> str:
    """Return a stable hash for idempotent ingestion checks."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _get_chroma_client() -> Any | None:
    """Return a persistent ChromaDB client or None when unavailable."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client
    try:
        import chromadb

        settings.chroma_path.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=str(settings.chroma_path))
        return _chroma_client
    except Exception as exc:
        logger.warning("ChromaDB unavailable; RAG ingestion skipped: %s", exc)
        return None


def close_chroma() -> None:
    """Release the Chroma client reference on shutdown."""
    global _chroma_client
    _chroma_client = None


def _collection_needs_refresh(collection: Any, expected_count: int, source_hash: str) -> bool:
    """Check whether a collection already contains the current source hash."""
    try:
        if collection.count() != expected_count:
            return True
        sample = collection.get(limit=1, include=["metadatas"])
        metadatas = sample.get("metadatas") or []
        if not metadatas:
            return True
        return metadatas[0].get("source_hash") != source_hash
    except Exception:
        return True


def _reset_collection(client: Any, name: str) -> Any:
    """Delete and recreate a collection to avoid duplicate stale documents."""
    try:
        client.delete_collection(name)
    except Exception:
        pass
    return client.get_or_create_collection(name=name)


def _section_for_offset(headers: list[tuple[int, str]], offset: int) -> str:
    """Return the latest markdown section header at or before a text offset."""
    section = "General"
    for position, name in headers:
        if position <= offset:
            section = name
        else:
            break
    return section


def _chunk_policy_text(text: str) -> list[dict[str, Any]]:
    """Split policy text into overlapping word-boundary chunks with section metadata."""
    size = max(100, settings.chunk_size)
    overlap = min(max(0, settings.chunk_overlap), size - 1)
    headers: list[tuple[int, str]] = []
    cursor = 0

    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        if stripped.startswith("##"):
            headers.append((cursor, stripped.lstrip("#").strip() or "General"))
        cursor += len(line)

    chunks: list[dict[str, Any]] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            boundary = text.rfind(" ", start + 1, end)
            if boundary > start + int(size * 0.5):
                end = boundary

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(
                {
                    "text": chunk,
                    "section": _section_for_offset(headers, start),
                    "chunk_index": len(chunks),
                }
            )

        if end >= len(text):
            break
        start = max(start + 1, end - overlap)

    return chunks


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts with OpenAI, returning an empty list on any provider error."""
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY missing; RAG ingestion cannot embed documents.")
        return []
    try:
        client = _get_openai_client()
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception as exc:
        logger.warning("OpenAI embedding failed; RAG ingestion skipped: %s", exc)
        return []


async def ingest_policies() -> None:
    """Ingest company policy chunks into the mahabharat_policies collection."""
    try:
        policy_path = settings.policies_path
        if not policy_path.exists():
            logger.warning("Policies file not found: %s", policy_path)
            return

        text = policy_path.read_text(encoding="utf-8")
        chunks = _chunk_policy_text(text)
        if not chunks:
            logger.warning("Policies file has no ingestible content.")
            return

        source_hash = _hash_text(text)
        client = _get_chroma_client()
        if client is None:
            return

        collection = client.get_or_create_collection(name=POLICY_COLLECTION)
        if not _collection_needs_refresh(collection, len(chunks), source_hash):
            logger.info("Policy RAG collection already current (%s chunks).", len(chunks))
            return

        embeddings = await _embed_texts([chunk["text"] for chunk in chunks])
        if len(embeddings) != len(chunks):
            return

        collection = await asyncio.to_thread(_reset_collection, client, POLICY_COLLECTION)
        await asyncio.to_thread(
            collection.upsert,
            ids=[f"policy-{source_hash[:12]}-{chunk['chunk_index']}" for chunk in chunks],
            documents=[chunk["text"] for chunk in chunks],
            embeddings=embeddings,
            metadatas=[
                {
                    "source": str(policy_path.name),
                    "chunk_index": chunk["chunk_index"],
                    "section": chunk["section"],
                    "source_hash": source_hash,
                }
                for chunk in chunks
            ],
        )
        logger.info("Policy RAG ingestion complete (%s chunks).", len(chunks))
    except Exception as exc:
        logger.warning("Policy RAG ingestion failed gracefully: %s", exc)


def _product_text(product: dict[str, Any]) -> str:
    """Create a searchable text representation of a product."""
    raw_highlights = product.get("highlights") or []
    if not isinstance(raw_highlights, list):
        raw_highlights = [raw_highlights]
    highlights = ", ".join(
        item.get("text", "") if isinstance(item, dict) else str(item)
        for item in raw_highlights
    )
    return (
        f"Product ID: {product.get('id', 'unknown')}\n"
        f"Title: {product.get('title', 'Untitled')}\n"
        f"Type: {product.get('type', 'unknown')}\n"
        f"Price: Rs {product.get('price', 0)}\n"
        f"Language: {product.get('language', 'Unknown')}\n"
        f"Description: {product.get('description', '')}\n"
        f"Highlights: {highlights}"
    )


async def ingest_products() -> None:
    """Ingest the Firestore product catalog into the mahabharat_products collection."""
    try:
        products = await _load_products_from_firestore()
        if not products:
            logger.warning("Firestore products collection empty; using fallback product catalog for RAG.")
            products = FALLBACK_PRODUCT_CATALOG

        catalog_json = json.dumps(products, sort_keys=True, default=str)
        source_hash = _hash_text(catalog_json)
        texts = [_product_text(product) for product in products]
        client = _get_chroma_client()
        if client is None:
            return

        collection = client.get_or_create_collection(name=PRODUCT_COLLECTION)
        if not _collection_needs_refresh(collection, len(products), source_hash):
            logger.info("Product RAG collection already current (%s products).", len(products))
            return

        embeddings = await _embed_texts(texts)
        if len(embeddings) != len(texts):
            return

        collection = await asyncio.to_thread(_reset_collection, client, PRODUCT_COLLECTION)
        await asyncio.to_thread(
            collection.upsert,
            ids=[f"product-{product.get('id', str(idx))}" for idx, product in enumerate(products)],
            documents=texts,
            embeddings=embeddings,
            metadatas=[
                {
                    "product_id": product.get("id", str(idx)),
                    "type": product.get("type", "unknown"),
                    "price": product.get("price", 0),
                    "language": product.get("language", "Unknown"),
                    "title": product.get("title", "Untitled"),
                    "source_hash": source_hash,
                }
                for idx, product in enumerate(products)
            ],
        )
        logger.info("Product RAG ingestion complete (%s products).", len(products))
    except Exception as exc:
        logger.warning("Product RAG ingestion failed gracefully: %s", exc)
