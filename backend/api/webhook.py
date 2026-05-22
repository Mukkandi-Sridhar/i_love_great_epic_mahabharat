"""Razorpay webhook endpoint with signature verification."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from firebase_admin import firestore

from backend.core.config import settings
from backend.core.firebase import get_firestore_client


logger = logging.getLogger("ChatbotBackend.api.webhook")
router = APIRouter()


def _valid_signature(body: bytes, signature: str | None) -> bool:
    """Validate Razorpay HMAC SHA256 webhook signature."""
    if not settings.razorpay_webhook_secret:
        logger.warning("RAZORPAY_WEBHOOK_SECRET missing; webhook ignored.")
        return False
    if not signature:
        return False
    digest = hmac.new(
        settings.razorpay_webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, signature)


def _payment_entity(event: dict[str, Any]) -> dict[str, Any]:
    """Extract the Razorpay payment entity from an event payload."""
    return (((event.get("payload") or {}).get("payment") or {}).get("entity") or {})


@router.post("/webhook/razorpay", response_model=None)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
) -> Any:
    """Process Razorpay payment events without exposing internal errors."""
    body = await request.body()
    if not settings.razorpay_webhook_secret:
        return {"status": "ignored", "message": "Webhook secret not configured"}
    if not _valid_signature(body, x_razorpay_signature):
        return JSONResponse(status_code=400, content={"detail": "Invalid signature"})

    try:
        event = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"detail": "Invalid payload"})

    db = get_firestore_client()
    if db is None:
        logger.warning("Firestore unavailable; Razorpay webhook accepted without processing.")
        return {"status": "accepted"}

    try:
        event_name = event.get("event")
        payment = _payment_entity(event)
        payment_id = payment.get("id")
        order_id = payment.get("order_id")
        amount = (payment.get("amount") or 0) / 100
        notes = payment.get("notes") or {}
        uid = notes.get("uid")
        product_id = notes.get("product_id")
        product_type = notes.get("product_type", "ebook")
        product_title = notes.get("product_title", product_id or "Purchased product")

        if event_name == "payment.captured":
            if order_id:
                db.collection("orders_index").document(order_id).set(
                    {
                        "status": "paid",
                        "razorpayPaymentId": payment_id,
                        "amount": amount,
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )
            if uid and product_id:
                db.collection("users").document(uid).collection("purchases").document(product_id).set(
                    {
                        "productId": product_id,
                        "type": product_type,
                        "title": product_title,
                        "price": amount,
                        "razorpayPaymentId": payment_id,
                        "createdAt": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )
                notif_id = payment_id or f"payment-{order_id or product_id}"
                db.collection("users").document(uid).collection("notifications").document(notif_id).set(
                    {
                        "title": "Payment Successful",
                        "message": f"Access has been granted for {product_title}.",
                        "read": False,
                        "createdAt": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )

        if event_name == "payment.failed":
            if order_id:
                db.collection("orders_index").document(order_id).set(
                    {
                        "status": "failed",
                        "razorpayPaymentId": payment_id,
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )
            if uid:
                db.collection("users").document(uid).collection("notifications").add(
                    {
                        "title": "Payment Failed",
                        "message": "Your payment failed. Please try again.",
                        "read": False,
                        "createdAt": firestore.SERVER_TIMESTAMP,
                    }
                )
    except Exception as exc:
        logger.error("Razorpay webhook processing failed after acceptance: %s", exc)

    return {"status": "ok"}
