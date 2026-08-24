"""Admin API routes for the Mahabharat backend."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from pydantic import BaseModel, field_validator

from backend.core.auth import invalidate_blocked_cache, require_admin
from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.rate_limit import limiter
from backend.mcp.server import list_tools as list_mcp_tools
from backend.rag.ingest import ingest_products


logger = logging.getLogger("ChatbotBackend.api.admin")
router = APIRouter(tags=["admin"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

ORDER_STATUSES = {"processing", "shipped", "delivered", "cancelled", "refunded", "paid"}


def _db():
    database = get_firestore_client()
    if database is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return database


class GrantAccessRequest(BaseModel):
    uid: str
    email: str
    product_id: str
    product_type: str
    title: str
    price: float


class RevokeAccessRequest(BaseModel):
    uid: str
    product_id: str


class UpdateOrderStatusRequest(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    admin_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v):
        if v not in ORDER_STATUSES:
            raise ValueError(f"status must be one of {sorted(ORDER_STATUSES)}")
        return v


class SendNotificationRequest(BaseModel):
    title: str
    message: str
    uid: Optional[str] = None


class AdminReplyRequest(BaseModel):
    reply: str


class BlockUserRequest(BaseModel):
    blocked: bool


@admin_router.post("/rag/refresh")
@limiter.limit("5/minute")
async def refresh_rag(request: Request, admin_uid: str = Depends(require_admin)):
    """Refresh the product RAG index from Firestore."""
    await ingest_products()
    return {"status": "refreshed"}


@admin_router.post("/grant-access")
@limiter.limit("10/minute")
async def admin_grant_access(request: Request, body: GrantAccessRequest, admin_uid: str = Depends(require_admin)):
    """Manually grant product access to a user."""
    def _write_access() -> dict:
        database = _db()
        purchase_ref = database.collection("users").document(body.uid).collection("purchases").document(body.product_id)
        notif_ref = database.collection("users").document(body.uid).collection("notifications").document()
        batch = database.batch()
        batch.set(
            purchase_ref,
            {
                "productId": body.product_id,
                "type": body.product_type,
                "title": body.title,
                "price": body.price,
                "grantedBy": "admin",
                "grantedByUid": admin_uid,
                "status": "active",
                "accessStatus": "active",
                "source": "admin",
                "hasDownloadLink": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.set(
            notif_ref,
            {
                "title": "Access Granted",
                "message": f"An administrator has granted you access to: {body.title}",
                "type": "system",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "read": False,
            },
        )
        batch.commit()
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_write_access)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Manual grant failed: %s", exc)
        raise HTTPException(status_code=500, detail="Grant failed")


@admin_router.post("/revoke-access")
@limiter.limit("10/minute")
async def admin_revoke_access(request: Request, body: RevokeAccessRequest, admin_uid: str = Depends(require_admin)):
    """Manually revoke product access from a user."""
    def _delete_access() -> dict:
        database = _db()
        purchase_ref = database.collection("users").document(body.uid).collection("purchases").document(body.product_id)
        snap = purchase_ref.get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Purchase not found for this user")

        notif_ref = database.collection("users").document(body.uid).collection("notifications").document()
        title = (snap.to_dict() or {}).get("title", body.product_id)

        batch = database.batch()
        batch.delete(purchase_ref)
        batch.set(
            notif_ref,
            {
                "title": "Access Revoked",
                "message": f"Administrator has revoked your access to: {title}",
                "type": "system",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "read": False,
            },
        )
        batch.commit()
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_delete_access)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Revoke failed: %s", exc)
        raise HTTPException(status_code=500, detail="Revoke failed")


@admin_router.patch("/orders/{order_id}")
@limiter.limit("10/minute")
async def admin_update_order(
    request: Request,
    order_id: str,
    body: UpdateOrderStatusRequest,
    admin_uid: str = Depends(require_admin),
):
    """Update order status and tracking information."""
    def _update_order() -> dict:
        database = _db()
        order_ref = database.collection("orders_index").document(order_id)
        order_doc = order_ref.get()
        if not order_doc.exists:
            raise HTTPException(status_code=404, detail="Order not found")

        order_data = order_doc.to_dict() or {}
        uid = order_data.get("uid")

        if body.status not in ORDER_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(ORDER_STATUSES)}")
        if body.status == "shipped" and not body.tracking_number:
            raise HTTPException(status_code=400, detail="tracking_number is required when status is 'shipped'")

        update_data = {"status": body.status, "updatedAt": firestore.SERVER_TIMESTAMP}
        if body.tracking_number:
            update_data["trackingNumber"] = body.tracking_number
        if body.admin_note:
            update_data["adminNote"] = body.admin_note

        batch = database.batch()
        batch.update(order_ref, update_data)
        if uid:
            user_order_ref = database.collection("users").document(uid).collection("orders").document(order_id)
            batch.update(user_order_ref, update_data)
            if body.status in {"shipped", "delivered"}:
                notif_ref = database.collection("users").document(uid).collection("notifications").document()
                batch.set(
                    notif_ref,
                    {
                        "title": f"Order {body.status.title()}",
                        "message": (
                            f"Your order has been {body.status}."
                            + (f" Tracking: {body.tracking_number}" if body.tracking_number else "")
                        ),
                        "read": False,
                        "createdAt": firestore.SERVER_TIMESTAMP,
                    },
                )
        batch.commit()
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_update_order)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Order update failed: %s", exc)
        raise HTTPException(status_code=500, detail="Update failed")


@admin_router.post("/send-notification")
@limiter.limit("10/minute")
async def admin_send_notification(
    request: Request,
    body: SendNotificationRequest,
    admin_uid: str = Depends(require_admin),
):
    """Send a notification to one user or broadcast to all users."""
    def _send_notification() -> dict:
        database = _db()
        notif_data = {
            "title": body.title,
            "message": body.message,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False,
        }

        if body.uid:
            database.collection("users").document(body.uid).collection("notifications").document().set(notif_data)
            return {"status": "success", "sent": 1}

        sent = 0
        batch = database.batch()
        batch_count = 0
        # select([]) returns document IDs without their fields — a broadcast only
        # needs the ids, and pulling every full user profile is billed per read.
        for user_doc in database.collection("users").select([]).stream():
            ref = database.collection("users").document(user_doc.id).collection("notifications").document()
            batch.set(ref, notif_data)
            batch_count += 1
            sent += 1
            if batch_count >= 499:
                batch.commit()
                batch = database.batch()
                batch_count = 0
        if batch_count:
            batch.commit()
        return {"status": "success", "sent": sent}

    try:
        return await asyncio.to_thread(_send_notification)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Notification failed: %s", exc)
        raise HTTPException(status_code=500, detail="Notification failed")


@admin_router.patch("/users/{uid}/block")
@limiter.limit("10/minute")
async def admin_block_user(
    request: Request,
    uid: str,
    body: BlockUserRequest,
    admin_uid: str = Depends(require_admin),
):
    """Block or unblock a user."""
    def _set_block_status() -> dict:
        database = _db()
        database.collection("users").document(uid).update(
            {
                "blocked": body.blocked,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        if body.blocked:
            firebase_auth.revoke_refresh_tokens(uid)
        invalidate_blocked_cache(uid)
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_set_block_status)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("User block failed: %s", exc)
        raise HTTPException(status_code=500, detail="Block failed")


@admin_router.post("/tickets/{ticket_id}/reply")
@limiter.limit("10/minute")
async def admin_reply_ticket(
    request: Request,
    ticket_id: str,
    body: AdminReplyRequest,
    admin_uid: str = Depends(require_admin),
):
    """Reply to a support ticket, mark it resolved, and notify the user."""
    def _reply_ticket() -> dict:
        database = _db()
        ticket_ref = database.collection("tickets").document(ticket_id)
        ticket = ticket_ref.get()
        if not ticket.exists:
            raise HTTPException(status_code=404, detail="Ticket not found")

        ticket_data = ticket.to_dict() or {}
        update_data = {
            "adminReply": body.reply,
            "status": "resolved",
            "resolvedAt": firestore.SERVER_TIMESTAMP,
        }
        uid = ticket_data.get("uid")
        batch = database.batch()
        batch.update(ticket_ref, update_data)
        if uid:
            user_ticket_ref = database.collection("users").document(uid).collection("tickets").document(ticket_id)
            batch.set(user_ticket_ref, update_data, merge=True)
            notif_ref = database.collection("users").document(uid).collection("notifications").document()
            batch.set(
                notif_ref,
                {
                    "title": "Support Ticket Updated",
                    "message": body.reply,
                    "type": "support",
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "read": False,
                },
            )
        batch.commit()

        return {"status": "success"}

    try:
        return await asyncio.to_thread(_reply_ticket)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Ticket reply failed: %s", exc)
        raise HTTPException(status_code=500, detail="Ticket reply failed")


@router.get("/ai/status")
async def ai_status(admin_uid: str = Depends(require_admin)):
    """Return the current AI support system status."""
    tool_list = list_mcp_tools()
    return {
        "status": "ready",
        "model": settings.openai_chat_model,
        "rag": "ChromaDB semantic search with OpenAI embeddings",
        "tool_count": len(tool_list),
        "rate_limit": "20/minute on chat; 10/minute on admin routes",
    }


router.include_router(admin_router)
