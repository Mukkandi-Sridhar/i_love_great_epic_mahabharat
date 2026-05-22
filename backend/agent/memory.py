"""Conversation memory and user context loading backed by Firestore."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict
from typing import Any

from firebase_admin import firestore

from backend.core.firebase import get_firestore_client


logger = logging.getLogger("ChatbotBackend.agent.memory")


class _BoundedDict(OrderedDict):
    """Small LRU store for no-Firestore chat history fallback."""

    def __init__(self, maxsize: int = 500):
        super().__init__()
        self.maxsize = maxsize

    def __setitem__(self, key: str, value: list[dict[str, Any]]) -> None:
        super().__setitem__(key, value)
        self.move_to_end(key)
        if len(self) > self.maxsize:
            self.popitem(last=False)

    def get(self, key: str, default: Any = None) -> Any:
        value = super().get(key, default)
        if key in self:
            self.move_to_end(key)
        return value


_fallback_sessions: _BoundedDict = _BoundedDict(maxsize=500)


def _session_key(uid: str, session_id: str) -> str:
    """Return a stable in-memory fallback key for a chat session."""
    return f"{uid}:{session_id}"


def _serialize_timestamp(value: Any) -> Any:
    """Convert Firestore timestamps to ISO strings for JSON prompts."""
    try:
        return value.isoformat()
    except Exception:
        return value


def append_fallback_turns(uid: str, session_id: str, turns: list[dict[str, Any]]) -> None:
    """Persist turns in bounded local memory when Firestore is unavailable."""
    if not uid or not session_id:
        return
    key = _session_key(uid, session_id)
    existing = list(_fallback_sessions.get(key, []))
    for turn in turns:
        role = turn.get("role")
        content = turn.get("content")
        if role and content:
            existing.append({"role": role, "content": content, "timestamp": time.time()})
    _fallback_sessions[key] = existing


async def save_turn(uid: str, session_id: str, role: str, content: str) -> None:
    """Deprecated compatibility shim; messages collection is the source of truth."""
    append_fallback_turns(uid, session_id, [{"role": role, "content": content}])


async def get_history(uid: str, session_id: str, limit: int = 10) -> list[dict]:
    """Load the most recent conversation turns in chronological order."""
    if not uid or not session_id:
        return []

    db = get_firestore_client()
    if db is None:
        turns = _fallback_sessions.get(_session_key(uid, session_id), [])
        return [{"role": item["role"], "content": item["content"]} for item in turns[-limit:]]

    def _read() -> list[dict]:
        messages_query = (
            db.collection("users")
            .document(uid)
            .collection("chat_sessions")
            .document(session_id)
            .collection("messages")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        message_docs = list(messages_query.stream())
        if message_docs:
            message_docs.reverse()
            return [
                {
                    "role": (doc.to_dict() or {}).get("role", "user"),
                    "content": (doc.to_dict() or {}).get("content", ""),
                }
                for doc in message_docs
                if (doc.to_dict() or {}).get("content")
            ]
        return []

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
