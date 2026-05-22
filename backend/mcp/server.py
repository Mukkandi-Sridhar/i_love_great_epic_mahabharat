"""Internal MCP-style tool server for Dharma support workflows."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from firebase_admin import firestore

from backend.core.firebase import get_firestore_client
from backend.rag.retrieve import retrieve_policies, retrieve_products


logger = logging.getLogger("ChatbotBackend.mcp")
SERVER_NAME = "mahabharat-support-mcp"
SENSITIVE_TRANSACTION_FIELDS = {"razorpay_signature", "razorpay_key", "secret"}


def _json(data: dict) -> str:
    """Serialize tool output as a JSON string."""
    return json.dumps(data, ensure_ascii=False, default=str)


def _parse_args(arguments: str | dict | None) -> dict:
    """Parse OpenAI tool-call arguments into a dict."""
    if isinstance(arguments, dict):
        return arguments
    if not arguments:
        return {}
    try:
        return json.loads(arguments)
    except json.JSONDecodeError:
        return {}


def _serialize_timestamp(value: Any) -> Any:
    """Convert known timestamp values to JSON-safe strings."""
    try:
        if hasattr(value, "isoformat"):
            return value.isoformat()
    except Exception:
        pass
    return value


def _city_state(shipping: dict | None) -> dict:
    """Return only city and state from a shipping address for privacy."""
    shipping = shipping or {}
    return {
        "city": shipping.get("city", ""),
        "state": shipping.get("state", ""),
    }


def _clean_uid(uid: str) -> str | None:
    """Return a stripped uid or None when it is missing."""
    uid = (uid or "").strip()
    return uid or None


def _safe_transaction(transaction: dict | None) -> dict:
    """Remove sensitive payment fields before exposing transaction data to the LLM."""
    transaction = transaction or {}
    return {key: value for key, value in transaction.items() if key not in SENSITIVE_TRANSACTION_FIELDS}


def list_tools() -> list[dict]:
    """Return OpenAI-compatible function specs for all MCP tools."""
    return [
        {
            "name": "get_order_status",
            "description": "Check a user's real order data from Firestore.",
            "parameters": {
                "type": "object",
                "properties": {
                    "uid": {"type": "string"},
                    "order_id": {"type": "string"},
                },
                "required": ["uid"],
            },
        },
        {
            "name": "get_user_purchases",
            "description": "List products a user has bought.",
            "parameters": {
                "type": "object",
                "properties": {"uid": {"type": "string"}},
                "required": ["uid"],
            },
        },
        {
            "name": "verify_payment",
            "description": "Verify a stored transaction by transaction/payment ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string", "description": "Firestore transaction ID"},
                    "razorpay_payment_id": {"type": "string", "description": "Razorpay payment ID (rzp_...)"},
                },
                "required": [],
            },
        },
        {
            "name": "create_refund_request",
            "description": "Create a refund request for eligible physical products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "uid": {"type": "string"},
                    "email": {"type": "string"},
                    "order_id": {"type": "string"},
                    "reason": {"type": "string"},
                    "product_type": {"type": "string"},
                },
                "required": ["uid", "email", "order_id", "reason", "product_type"],
            },
        },
        {
            "name": "create_support_ticket",
            "description": "Create a support ticket for unresolved customer issues.",
            "parameters": {
                "type": "object",
                "properties": {
                    "uid": {"type": "string"},
                    "email": {"type": "string"},
                    "name": {"type": "string"},
                    "issue": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["payment", "access", "shipping", "refund", "technical", "other"],
                    },
                },
                "required": ["uid", "email", "name", "issue", "category"],
            },
        },
        {
            "name": "check_coupon",
            "description": "Validate a coupon code and calculate final payable amount.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "amount": {"type": "number"},
                },
                "required": ["code", "amount"],
            },
        },
        {
            "name": "search_policies",
            "description": "Search company policies and return retrieved chunks for synthesis.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
        {
            "name": "search_products",
            "description": "Search product catalog for matching products and prices.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    ]


def warm_tool_cache() -> list[dict]:
    """Warm and return the static MCP tool list."""
    tools = list_tools()
    logger.info("%s warmed with %s tools", SERVER_NAME, len(tools))
    return tools


async def _get_order_status(uid: str, order_id: str | None = None) -> dict:
    """Fetch recent user orders or one specific order."""
    uid = _clean_uid(uid)
    if not uid:
        return {"error": "User identifier is required."}

    db = get_firestore_client()
    if db is None:
        return {"error": "Could not fetch orders"}

    def _read() -> dict:
        if order_id:
            docs = [db.collection("users").document(uid).collection("orders").document(order_id).get()]
        else:
            docs = list(
                db.collection("users")
                .document(uid)
                .collection("orders")
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .limit(3)
                .stream()
            )

        orders = []
        for doc in docs:
            if not doc.exists:
                continue
            data = doc.to_dict() or {}
            safe_transaction = _safe_transaction(data.get("transaction"))
            orders.append(
                {
                    "order_id": doc.id,
                    "product_title": data.get("productTitle") or data.get("title", ""),
                    "product_type": data.get("productType") or data.get("type", ""),
                    "amount": data.get("amount", data.get("price", 0)),
                    "status": data.get("status", ""),
                    "payment_mode": data.get("paymentMode", ""),
                    "payment_ref": data.get("paymentRef", ""),
                    "transaction_id": data.get("transactionId", ""),
                    "transaction": safe_transaction,
                    "createdAt": _serialize_timestamp(data.get("createdAt")),
                    "tracking_number": data.get("trackingNumber") or data.get("tracking_number", ""),
                    "shipping_address": _city_state(data.get("shipping")),
                }
            )
        return {"orders": orders}

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("get_order_status failed: %s", exc)
        return {"error": "Could not fetch orders"}


async def _get_user_purchases(uid: str) -> dict:
    """Fetch all purchases for a user."""
    uid = _clean_uid(uid)
    if not uid:
        return {"error": "User identifier is required."}

    db = get_firestore_client()
    if db is None:
        return {"purchases": [], "total_count": 0}

    def _read() -> dict:
        purchases = []
        docs = db.collection("users").document(uid).collection("purchases").stream()
        for doc in docs:
            data = doc.to_dict() or {}
            purchases.append(
                {
                    "product_id": data.get("productId") or data.get("product_id") or doc.id,
                    "title": data.get("title", ""),
                    "type": data.get("type", ""),
                    "price": data.get("price", 0),
                    "language": data.get("language", ""),
                    "order_id": data.get("orderId", ""),
                    "status": data.get("status", data.get("accessStatus", "")),
                    "has_download_link": bool(
                        data.get("hasDownloadLink") or data.get("driveLink") or data.get("downloadLink")
                    ),
                    "createdAt": _serialize_timestamp(data.get("createdAt")),
                }
            )
        return {"purchases": purchases, "total_count": len(purchases)}

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("get_user_purchases failed: %s", exc)
        return {"purchases": [], "total_count": 0}


async def _verify_payment(transaction_id: str) -> dict:
    """Verify a stored checkout transaction from Firestore."""
    transaction_id = (transaction_id or "").strip()
    if not transaction_id:
        return {"error": "Please share a transaction ID."}

    db = get_firestore_client()
    if db is None:
        return {"error": "Could not verify payment right now."}

    def _read() -> dict:
        transaction = db.collection("transactions_index").document(transaction_id).get()
        if not transaction.exists:
            return {"error": "Transaction not found. Please check your transaction ID."}

        data = transaction.to_dict() or {}
        paid_at = data.get("paid_at") or data.get("createdAt")
        if hasattr(paid_at, "isoformat"):
            paid_at = paid_at.isoformat()

        return {
            "payment_id": data.get("gateway_payment_id") or data.get("transaction_id") or transaction.id,
            "transaction_id": data.get("transaction_id") or transaction.id,
            "order_id": data.get("orderId", ""),
            "product_title": data.get("productTitle", ""),
            "status": data.get("status", ""),
            "amount_inr": data.get("amount", 0),
            "currency": data.get("currency", "INR"),
            "method": data.get("method", ""),
            "gateway": data.get("gateway", "razorpay"),
            "captured": data.get("status") in {"captured", "paid", "success"},
            "test_payment": data.get("testPayment", True),
            "created_at": paid_at,
        }

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("verify_payment failed: %s", exc)
        return {"error": "Could not verify payment right now."}


async def _create_refund_request(uid: str, email: str, order_id: str, reason: str, product_type: str) -> dict:
    """Create a refund ticket when product policy allows it."""
    uid = _clean_uid(uid)
    if not uid:
        return {"error": "User identifier is required."}

    order_id = (order_id or "").strip()
    if not order_id:
        return {"refundable": False, "message": "Order not found for your account."}

    normalized_type = (product_type or "").lower()
    if normalized_type == "ebook":
        return {
            "refundable": False,
            "message": "Digital products are non-refundable after access is granted per our policy.",
        }

    if normalized_type not in {"pendrive", "sdcard"}:
        normalized_type = "other"

    db = get_firestore_client()
    if db is None:
        return {"refundable": True, "message": "Refund request noted. Please contact support to complete it."}

    def _write() -> dict:
        order_doc = db.collection("users").document(uid).collection("orders").document(order_id).get()
        if not order_doc.exists:
            return {"refundable": False, "message": "Order not found for your account."}

        ticket_data = {
            "type": "refund_request",
            "category": "refund",
            "order_id": order_id,
            "reason": reason,
            "email": email,
            "product_type": normalized_type,
            "status": "open",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        user_ticket_ref = db.collection("users").document(uid).collection("tickets").document()
        notification_ref = db.collection("users").document(uid).collection("notifications").document()
        batch = db.batch()
        batch.set(user_ticket_ref, ticket_data)
        batch.set(db.collection("tickets").document(user_ticket_ref.id), {**ticket_data, "uid": uid})
        batch.set(
            notification_ref,
            {
                "title": "Refund Request Received",
                "message": f"We received your refund request for order {order_id}.",
                "read": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.commit()
        return {
            "refundable": True,
            "ticket_id": user_ticket_ref.id,
            "message": "Refund request created. We'll review within 2-3 business days.",
        }

    try:
        return await asyncio.to_thread(_write)
    except Exception as exc:
        logger.warning("create_refund_request failed: %s", exc)
        return {"error": "Could not create refund request right now."}


async def _create_support_ticket(uid: str, email: str, name: str, issue: str, category: str) -> dict:
    """Create a support ticket in user and root ticket collections."""
    uid = _clean_uid(uid)
    if not uid:
        return {"error": "User identifier is required."}

    db = get_firestore_client()
    if db is None:
        return {"message": "Your support request has been received. We'll contact you within 24 hours."}

    def _write() -> dict:
        ticket_data = {
            "category": category,
            "issue": issue,
            "email": email,
            "name": name,
            "status": "open",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        user_ticket_ref = db.collection("users").document(uid).collection("tickets").document()
        notification_ref = db.collection("users").document(uid).collection("notifications").document()
        batch = db.batch()
        batch.set(user_ticket_ref, ticket_data)
        batch.set(db.collection("tickets").document(user_ticket_ref.id), {**ticket_data, "uid": uid})
        batch.set(
            notification_ref,
            {
                "title": "Support Ticket Created",
                "message": "Your ticket has been received. We'll respond within 24 hours.",
                "read": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.commit()
        return {
            "ticket_id": user_ticket_ref.id,
            "message": "Your support ticket has been created. We'll contact you within 24 hours.",
        }

    try:
        return await asyncio.to_thread(_write)
    except Exception as exc:
        logger.warning("create_support_ticket failed: %s", exc)
        return {"error": "Could not create support ticket right now."}


async def _check_coupon(code: str, amount: float) -> dict:
    """Validate a coupon and calculate discount."""
    db = get_firestore_client()
    if db is None:
        return {"valid": False, "message": "Coupon validation is unavailable right now."}

    def _read() -> dict:
        coupon = db.collection("coupons").document(code.upper()).get()
        if not coupon.exists:
            return {"valid": False, "message": "This coupon is invalid or expired."}

        data = coupon.to_dict() or {}
        enabled = data.get("enabled", True)
        expires_at = data.get("expiresAt")
        max_uses = data.get("maxUses")
        used_count = data.get("usedCount", 0)
        if not enabled:
            return {"valid": False, "message": "This coupon is invalid or expired."}
        if expires_at and expires_at.timestamp() < datetime.now(tz=timezone.utc).timestamp():
            return {"valid": False, "message": "This coupon is invalid or expired."}
        if max_uses and used_count >= max_uses:
            return {"valid": False, "message": "This coupon is invalid or expired."}

        value = float(data.get("value", 0))
        discount = (amount * value / 100) if data.get("type") == "percent" else value
        discount = max(0, min(float(amount), discount))
        final_amount = max(0, float(amount) - discount)
        return {
            "valid": True,
            "code": code.upper(),
            "discount": discount,
            "final_amount": final_amount,
            "message": f"Coupon applied! You save ₹{discount:g}.",
        }

    try:
        return await asyncio.to_thread(_read)
    except Exception as exc:
        logger.warning("check_coupon failed: %s", exc)
        return {"valid": False, "message": "This coupon is invalid or expired."}


async def _search_policies(query: str) -> dict:
    """Search policies and return chunks for the model to synthesize."""
    results = await retrieve_policies(query)
    if not results:
        return {"retrieved_chunks": [], "sections_referenced": []}
    sections = []
    lines = []
    for result in results[:3]:
        section = result.get("section", "General")
        if section not in sections:
            sections.append(section)
        lines.append(f"{section}: {result.get('text', '')}")
    return {"retrieved_chunks": lines, "sections_referenced": sections}


async def _search_products(query: str) -> dict:
    """Search products and return matching catalog data."""
    results = await retrieve_products(query)
    products = []
    for result in results:
        products.append(
            {
                "product_id": result.get("product_id", ""),
                "title": result.get("title", ""),
                "type": result.get("type", ""),
                "price": result.get("price", 0),
                "language": result.get("language", ""),
                "summary": result.get("text", "")[:300],
            }
        )
    return {"products": products}


async def process_tool_call(name: str, arguments: str | dict | None) -> str:
    """Execute an MCP tool and return its JSON string result."""
    args = _parse_args(arguments)
    logger.info("MCP tool call: %s", name)
    try:
        if name == "get_order_status":
            return _json(await _get_order_status(args.get("uid", ""), args.get("order_id")))
        if name == "get_user_purchases":
            return _json(await _get_user_purchases(args.get("uid", "")))
        if name == "verify_payment":
            return _json(await _verify_payment(args.get("transaction_id") or args.get("razorpay_payment_id", "")))
        if name == "create_refund_request":
            return _json(
                await _create_refund_request(
                    args.get("uid", ""),
                    args.get("email", ""),
                    args.get("order_id", ""),
                    args.get("reason", ""),
                    args.get("product_type", ""),
                )
            )
        if name == "create_support_ticket":
            return _json(
                await _create_support_ticket(
                    args.get("uid", ""),
                    args.get("email", ""),
                    args.get("name", ""),
                    args.get("issue", ""),
                    args.get("category", "other"),
                )
            )
        if name == "check_coupon":
            return _json(await _check_coupon(args.get("code", ""), float(args.get("amount", 0) or 0)))
        if name == "search_policies":
            return _json(await _search_policies(args.get("query", "")))
        if name == "search_products":
            return _json(await _search_products(args.get("query", "")))
        return _json({"error": "Unknown tool"})
    except Exception as exc:
        logger.warning("MCP tool failed gracefully: %s", exc)
        return _json({"error": "Tool unavailable right now."})
