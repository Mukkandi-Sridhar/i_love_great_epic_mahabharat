"""Conversation memory and user context loading backed by Firestore."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from typing import Any

from firebase_admin import firestore

from backend.core.firebase import get_firestore_client


logger = logging.getLogger("ChatbotBackend.agent.memory")
_fallback_sessions: dict[str, list[dict[str, Any]]] = defaultdict(list)


def _session_key(uid: str, session_id: str) -> str:
    """Return a stable in-memory fallback key for a chat session."""
    return f"{uid}:{session_id}"


def _serialize_timestamp(value: Any) -> Any:
    """Convert Firestore timestamps to ISO strings for JSON prompts."""
    try:
        return value.isoformat()
    except Exception:
        return value


async def save_turn(uid: str, session_id: str, role: str, content: str) -> None:
    """Save a conversation turn to Firestore, falling back to local memory."""
    if not uid or not session_id:
        return

    db = get_firestore_client()
    if db is None:
        _fallback_sessions[_session_key(uid, session_id)].append(
            {"role": role, "content": content, "timestamp": time.time()}
        )
        return

    def _write() -> None:
        db.collection("users").document(uid).collection("chat_sessions").document(session_id).collection("turns").add(
            {
                "role": role,
                "content": content,
                "timestamp": firestore.SERVER_TIMESTAMP,
            }
        )

    try:
        await asyncio.to_thread(_write)
    except Exception as exc:
        logger.warning("Could not save chat turn: %s", exc)
        _fallback_sessions[_session_key(uid, session_id)].append(
            {"role": role, "content": content, "timestamp": time.time()}
        )


async def get_history(uid: str, session_id: str, limit: int = 10) -> list[dict]:
    """Load the most recent conversation turns in chronological order."""
    if not uid or not session_id:
        return []

    db = get_firestore_client()
    if db is None:
        turns = _fallback_sessions.get(_session_key(uid, session_id), [])
        return [{"role": item["role"], "content": item["content"]} for item in turns[-limit:]]

    def _read() -> list[dict]:
        query = (
            db.collection("users")
            .document(uid)
            .collection("chat_sessions")
            .document(session_id)
            .collection("turns")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        docs = list(query.stream())
        docs.reverse()
        return [
            {
                "role": (doc.to_dict() or {}).get("role", "user"),
                "content": (doc.to_dict() or {}).get("content", ""),
            }
            for doc in docs
            if (doc.to_dict() or {}).get("content")
        ]

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("Could not load chat history: %s", exc)
        return []


def _empty_context() -> dict:
    """Return the default user context used when Firestore is unavailable."""
    return {
        "has_orders": False,
        "recent_orders": [],
        "has_purchases": False,
        "purchases": [],
        "open_tickets_count": 0,
    }


async def get_user_context(uid: str) -> dict:
    """Load recent orders, purchases, and open ticket count for the assistant."""
    if not uid:
        return _empty_context()

    db = get_firestore_client()
    if db is None:
        return _empty_context()

    def _recent_orders() -> list[dict]:
        docs = (
            db.collection("users")
            .document(uid)
            .collection("orders")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(3)
            .stream()
        )
        orders = []
        for doc in docs:
            data = doc.to_dict() or {}
            orders.append(
                {
                    "order_id": doc.id,
                    "product_title": data.get("productTitle") or data.get("title") or data.get("product_id", ""),
                    "status": data.get("status", ""),
                    "amount": data.get("amount", data.get("price", 0)),
                    "createdAt": _serialize_timestamp(data.get("createdAt")),
                }
            )
        return orders

    def _purchases() -> list[dict]:
        docs = db.collection("users").document(uid).collection("purchases").stream()
        purchases = []
        for doc in docs:
            data = doc.to_dict() or {}
            purchases.append(
                {
                    "product_id": data.get("productId") or data.get("product_id") or doc.id,
                    "title": data.get("title", ""),
                    "type": data.get("type", ""),
                }
            )
        return purchases

    def _open_tickets() -> int:
        docs = (
            db.collection("users")
            .document(uid)
            .collection("tickets")
            .where("status", "==", "open")
            .stream()
        )
        return sum(1 for _ in docs)

    try:
        recent_orders, purchases, open_tickets_count = await asyncio.gather(
            asyncio.to_thread(_recent_orders),
            asyncio.to_thread(_purchases),
            asyncio.to_thread(_open_tickets),
        )
        return {
            "has_orders": bool(recent_orders),
            "recent_orders": recent_orders,
            "has_purchases": bool(purchases),
            "purchases": purchases,
            "open_tickets_count": open_tickets_count,
        }
    except Exception as exc:
        logger.warning("Could not load user context: %s", exc)
        return _empty_context()
