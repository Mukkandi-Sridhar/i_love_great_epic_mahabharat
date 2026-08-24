"""Data access for the Supabase/Postgres backend.

Every function here runs with the service-role key, which bypasses Row Level
Security. RLS is the *client's* safety net, not this process's — so the rule in
this module is absolute:

    Any query that touches user-owned data takes ``user_id`` as its first
    argument and filters on it. There is no code path that reads or writes an
    order, purchase, ticket, notification or chat message without that filter.

``user_id`` always originates from a verified access token (see
``core/supabase.verify_access_token``), never from a request body or an
LLM-supplied tool argument.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from backend.core.supabase import get_supabase


logger = logging.getLogger("ChatbotBackend.db.supabase")


class RepositoryUnavailable(RuntimeError):
    """Raised when Supabase is not configured but a query was attempted."""


def _db() -> Any:
    client = get_supabase()
    if client is None:
        raise RepositoryUnavailable("Supabase is not configured")
    return client


def _rows(response: Any) -> list[dict]:
    """Normalize a PostgREST response into a list of dicts."""
    data = getattr(response, "data", None)
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def _first(response: Any) -> dict | None:
    rows = _rows(response)
    return rows[0] if rows else None


# ── Audit trail ─────────────────────────────────────────────────────────────


def _write_audit(actor_id: str | None, action: str, target: str | None, detail: dict) -> None:
    """Record a privileged action. Never raises: an audit failure must not
    roll back the operation it describes, but it is logged loudly."""
    try:
        _db().table("audit_logs").insert(
            {"actor_id": actor_id, "action": action, "target": target, "detail": detail}
        ).execute()
    except Exception as exc:
        logger.error("AUDIT WRITE FAILED action=%s target=%s: %s", action, target, exc)


async def record_audit(actor_id: str | None, action: str, target: str | None = None, **detail: Any) -> None:
    """Append an entry to the audit log off the request path."""
    await asyncio.to_thread(_write_audit, actor_id, action, target, detail)


# ── Identity ────────────────────────────────────────────────────────────────


def _read_is_blocked(user_id: str) -> bool:
    row = _first(_db().table("profiles").select("blocked").eq("id", user_id).limit(1).execute())
    return bool(row and row.get("blocked"))


async def is_blocked(user_id: str) -> bool:
    return await asyncio.to_thread(_read_is_blocked, user_id)


def _read_is_admin(user_id: str) -> bool:
    row = _first(_db().table("admins").select("user_id").eq("user_id", user_id).limit(1).execute())
    return row is not None


async def is_admin(user_id: str) -> bool:
    """Admin status comes from the `admins` table only.

    Deliberately not a column on `profiles`: a user-editable admin flag was the
    escalation path removed during the Firestore hardening.
    """
    return await asyncio.to_thread(_read_is_admin, user_id)


# ── Catalog ─────────────────────────────────────────────────────────────────


def _read_product(product_id: str) -> dict | None:
    return _first(
        _db()
        .table("products")
        .select("*")
        .eq("id", (product_id or "").strip())
        .eq("enabled", True)
        .eq("retired", False)
        .limit(1)
        .execute()
    )


async def get_sellable_product(product_id: str) -> dict | None:
    """Fetch a product that may currently be sold, or None."""
    if not (product_id or "").strip():
        return None
    return await asyncio.to_thread(_read_product, product_id)


def _read_products_by_ids(product_ids: list[str]) -> dict[str, dict]:
    ids = [pid for pid in dict.fromkeys(product_ids) if pid]
    if not ids:
        return {}
    rows = _rows(_db().table("products").select("*").in_("id", ids).execute())
    return {row["id"]: row for row in rows}


async def get_products_by_ids(product_ids: list[str]) -> dict[str, dict]:
    """Batch-read catalog rows so search results can be re-priced from source."""
    if not product_ids:
        return {}
    return await asyncio.to_thread(_read_products_by_ids, product_ids)


def _read_catalog(limit_count: int) -> list[dict]:
    return _rows(
        _db()
        .table("products")
        .select("*")
        .eq("enabled", True)
        .eq("retired", False)
        .order("type")
        .order("title")
        .limit(limit_count)
        .execute()
    )


async def list_catalog(limit_count: int = 20) -> list[dict]:
    return await asyncio.to_thread(_read_catalog, limit_count)


def _read_coupon(code: str) -> dict | None:
    return _first(
        _db().table("coupons").select("*").eq("code", (code or "").strip().upper()).limit(1).execute()
    )


async def get_coupon(code: str) -> dict | None:
    if not (code or "").strip():
        return None
    return await asyncio.to_thread(_read_coupon, code)


# ── Orders, purchases, transactions (all user-scoped) ───────────────────────


def _read_orders(user_id: str, order_id: str | None, limit_count: int) -> list[dict]:
    query = _db().table("orders").select("*").eq("user_id", user_id)
    if order_id:
        query = query.eq("id", order_id)
    return _rows(query.order("created_at", desc=True).limit(limit_count).execute())


async def get_orders(user_id: str, order_id: str | None = None, limit_count: int = 3) -> list[dict]:
    """Fetch the caller's orders. Scoped by user_id even when an id is given,
    so a guessed order id cannot expose another account's order."""
    if not user_id:
        return []
    return await asyncio.to_thread(_read_orders, user_id, order_id, limit_count)


def _read_purchases(user_id: str, limit_count: int) -> list[dict]:
    return _rows(
        _db()
        .table("purchases")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit_count)
        .execute()
    )


async def get_purchases(user_id: str, limit_count: int = 20) -> list[dict]:
    if not user_id:
        return []
    return await asyncio.to_thread(_read_purchases, user_id, limit_count)


def _read_transaction(user_id: str, reference: str) -> dict | None:
    return _first(
        _db()
        .table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", reference)
        .limit(1)
        .execute()
    )


async def get_transaction(user_id: str, reference: str) -> dict | None:
    """Look up one of the caller's own transactions.

    Scoped by user_id so a known or guessed payment id cannot reveal another
    customer's amount, product or status.
    """
    if not user_id or not (reference or "").strip():
        return None
    return await asyncio.to_thread(_read_transaction, user_id, reference.strip())


# ── Support ─────────────────────────────────────────────────────────────────


def _read_tickets(user_id: str, limit_count: int) -> list[dict]:
    return _rows(
        _db()
        .table("tickets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit_count)
        .execute()
    )


async def get_tickets(user_id: str, limit_count: int = 10) -> list[dict]:
    if not user_id:
        return []
    return await asyncio.to_thread(_read_tickets, user_id, limit_count)


def _count_open_tickets(user_id: str) -> int:
    response = (
        _db()
        .table("tickets")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "open")
        .execute()
    )
    return int(getattr(response, "count", 0) or 0)


async def count_open_tickets(user_id: str) -> int:
    if not user_id:
        return 0
    return await asyncio.to_thread(_count_open_tickets, user_id)


def _insert_ticket(payload: dict) -> dict | None:
    return _first(_db().table("tickets").insert(payload).execute())


async def create_ticket(
    user_id: str,
    *,
    issue: str,
    category: str,
    email: str | None = None,
    name: str | None = None,
    order_id: str | None = None,
    reason: str | None = None,
    product_type: str | None = None,
    kind: str = "support_request",
) -> dict | None:
    """Open a ticket owned by the caller."""
    if not user_id:
        return None
    payload = {
        "user_id": user_id,
        "issue": issue,
        "category": category,
        "kind": kind,
        "email": email,
        "name": name,
        "order_id": order_id,
        "reason": reason,
        "product_type": product_type,
        "status": "open",
    }
    return await asyncio.to_thread(_insert_ticket, {k: v for k, v in payload.items() if v is not None})


def _insert_notification(payload: dict) -> None:
    _db().table("notifications").insert(payload).execute()


async def notify(user_id: str, title: str, message: str, kind: str | None = None) -> None:
    """Send one in-app notification to a user."""
    if not user_id:
        return
    payload = {"user_id": user_id, "title": title, "message": message}
    if kind:
        payload["type"] = kind
    await asyncio.to_thread(_insert_notification, payload)


# ── Chat history ────────────────────────────────────────────────────────────


def _read_chat_messages(user_id: str, session_id: str, limit_count: int) -> list[dict]:
    rows = _rows(
        _db()
        .table("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user_id)
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(limit_count)
        .execute()
    )
    rows.reverse()  # newest-first from the index, oldest-first for the prompt
    return rows


async def get_chat_messages(user_id: str, session_id: str, limit_count: int = 12) -> list[dict]:
    """Load one session's transcript, scoped to its owner."""
    if not user_id or not session_id:
        return []
    return await asyncio.to_thread(_read_chat_messages, user_id, session_id, limit_count)


def _write_chat_turn(
    user_id: str, session_id: str, user_message: str, assistant_message: str, tools_called: list[str]
) -> None:
    client = _db()
    client.table("chat_sessions").upsert(
        {"id": session_id, "user_id": user_id}, on_conflict="id"
    ).execute()
    client.table("chat_messages").insert(
        [
            {"session_id": session_id, "user_id": user_id, "role": "user", "content": user_message},
            {
                "session_id": session_id,
                "user_id": user_id,
                "role": "assistant",
                "content": assistant_message,
                "tools_called": tools_called,
            },
        ]
    ).execute()


async def save_chat_turn(
    user_id: str,
    session_id: str,
    user_message: str,
    assistant_message: str,
    tools_called: list[str] | None = None,
) -> None:
    if not user_id or not session_id:
        return
    await asyncio.to_thread(
        _write_chat_turn, user_id, session_id, user_message, assistant_message, tools_called or []
    )
