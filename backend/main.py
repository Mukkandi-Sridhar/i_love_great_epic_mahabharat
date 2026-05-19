import os
import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(os.path.join(Path(__file__).resolve().parent, ".env"))

from backend.api.chat import router as chat_router
from backend.api.webhook import router as webhook_router
from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.rate_limit import limiter
from backend.mcp.server import list_tools as list_mcp_tools, warm_tool_cache
from backend.rag.ingest import close_chroma, ingest_policies, ingest_products

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger("ChatbotBackend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm RAG and MCP resources on startup, then release local handles."""
    try:
        await ingest_policies()
        await ingest_products()
        warm_tool_cache()
        logger.info("RAG pipeline ready")
    except Exception as exc:
        logger.warning("Startup warmup failed gracefully: %s", exc)
    yield
    close_chroma()


app = FastAPI(title="Dharma Divine Chatbot API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(chat_router)
app.include_router(webhook_router)

db = get_firestore_client()


class CompleteOrderRequest(BaseModel):
    uid: str
    email: str
    name: Optional[str] = None
    phone: str
    product_type: str
    product_id: str
    product_title: Optional[str] = None
    product_language: Optional[str] = None
    product_image: Optional[str] = None
    base_price: float
    coupon_code: Optional[str] = None
    shipping: Optional[dict] = None
    download_link: Optional[str] = None
    payment_mode: Optional[str] = None
    payment_ref: Optional[str] = None
    test_payment: bool = False
    transaction_details: Optional[dict] = None


class ValidateCouponRequest(BaseModel):
    code: str
    amount: float


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


class SendNotificationRequest(BaseModel):
    title: str
    message: str
    uid: Optional[str] = None


class AdminReplyRequest(BaseModel):
    reply: str


def require_admin_secret(request: Request) -> None:
    """Require the configured admin secret for every admin backend route."""
    provided = request.headers.get("X-Admin-Secret", "")
    if not settings.admin_secret or provided != settings.admin_secret:
        raise HTTPException(status_code=401, detail="Invalid admin secret")


@app.post("/complete-order")
@limiter.limit("20/minute")
async def complete_order(request: Request, body: CompleteOrderRequest):
    """Complete an order, apply a valid coupon, and grant product access."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _write_order() -> dict:
        base_price = body.base_price
        final_amount = base_price
        discount_value = 0
        product_type = body.product_type.lower()
        product_title = body.product_title or f"{product_type.title()} - {body.product_id}"
        transaction_details = body.transaction_details or {}
        transaction_id = (
            transaction_details.get("transaction_id")
            or transaction_details.get("gateway_payment_id")
            or body.payment_ref
        )
        if not transaction_id:
            transaction_id = f"txn_sandbox_{db.collection('transactions_index').document().id}"
        transaction_details = {
            "transaction_id": transaction_id,
            "gateway": body.payment_mode or "fake_sandbox",
            "status": "captured" if body.test_payment else "paid",
            "currency": "INR",
            **transaction_details,
        }

        if body.coupon_code:
            coupon_ref = db.collection("coupons").document(body.coupon_code.upper())
            coupon = coupon_ref.get()
            if coupon.exists:
                coupon_data = coupon.to_dict() or {}
                valid = coupon_data.get("enabled", True)
                expires_at = coupon_data.get("expiresAt")
                max_uses = coupon_data.get("maxUses")
                used_count = coupon_data.get("usedCount", 0)

                if valid and expires_at and expires_at.timestamp() < __import__("time").time():
                    valid = False
                if valid and max_uses and used_count >= max_uses:
                    valid = False

                if valid:
                    if coupon_data["type"] == "percent":
                        discount_value = (base_price * coupon_data["value"]) / 100
                    else:
                        discount_value = coupon_data["value"]
                    final_amount = max(0, base_price - discount_value)
                    coupon_ref.update({"usedCount": firestore.Increment(1)})

        order_data = {
            "uid": body.uid,
            "userName": body.name or "",
            "email": body.email,
            "phone": body.phone,
            "productId": body.product_id,
            "productTitle": product_title,
            "productType": product_type,
            "basePrice": base_price,
            "discount": discount_value,
            "amount": final_amount,
            "couponCode": body.coupon_code.upper() if body.coupon_code else None,
            "status": "paid",
            "paymentMode": body.payment_mode or "direct",
            "paymentRef": body.payment_ref,
            "transactionId": transaction_id,
            "transaction": transaction_details,
            "testPayment": body.test_payment,
            "shipping": body.shipping or {},
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        user_order_ref = db.collection("users").document(body.uid).collection("orders").document()
        order_doc_id = user_order_ref.id
        order_data["orderId"] = order_doc_id

        purchase_data = {
            "productId": body.product_id,
            "product_id": body.product_id,
            "type": product_type,
            "productType": product_type,
            "title": product_title,
            "language": body.product_language,
            "imageUrl": body.product_image,
            "price": final_amount,
            "orderId": order_doc_id,
            "status": "active",
            "accessStatus": "active",
            "source": "checkout",
            "paymentMode": body.payment_mode or "direct",
            "paymentRef": body.payment_ref,
            "transactionId": transaction_id,
            "testPayment": body.test_payment,
            "downloadLink": body.download_link,
            "driveLink": body.download_link,
            "hasDownloadLink": bool(body.download_link),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        transaction_data = {
            **transaction_details,
            "transaction_id": transaction_id,
            "uid": body.uid,
            "email": body.email,
            "phone": body.phone,
            "orderId": order_doc_id,
            "productId": body.product_id,
            "productTitle": product_title,
            "amount": final_amount,
            "currency": transaction_details.get("currency", "INR"),
            "status": transaction_details.get("status", "captured" if body.test_payment else "paid"),
            "gateway": transaction_details.get("gateway", body.payment_mode or "direct"),
            "method": transaction_details.get("method", "unknown"),
            "testPayment": body.test_payment,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        batch = db.batch()
        batch.set(user_order_ref, order_data)
        batch.set(db.collection("orders_index").document(order_doc_id), order_data)
        batch.set(db.collection("users").document(body.uid).collection("purchases").document(body.product_id), purchase_data)
        if transaction_id:
            batch.set(db.collection("users").document(body.uid).collection("transactions").document(transaction_id), transaction_data)
            batch.set(db.collection("transactions_index").document(transaction_id), transaction_data)
        batch.commit()
        return {
            "status": "success",
            "order_id": order_doc_id,
            "final_amount": final_amount,
            "transaction_id": transaction_id,
        }

    try:
        return await asyncio.to_thread(_write_order)
    except Exception as exc:
        logger.error("Order completion failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not complete order")


@app.post("/validate-coupon")
async def validate_coupon(body: ValidateCouponRequest):
    """Validate a coupon code and return the discount and final amount."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _read_coupon() -> dict:
        coupon_ref = db.collection("coupons").document(body.code.upper())
        coupon = coupon_ref.get()
        if not coupon.exists:
            raise HTTPException(status_code=404, detail="Coupon not found")

        data = coupon.to_dict() or {}
        if not data.get("enabled", True):
            raise HTTPException(status_code=400, detail="Coupon is disabled")

        expires_at = data.get("expiresAt")
        if expires_at and expires_at.timestamp() < __import__("time").time():
            raise HTTPException(status_code=400, detail="Coupon has expired")

        max_uses = data.get("maxUses")
        used_count = data.get("usedCount", 0)
        if max_uses and used_count >= max_uses:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")

        if data["type"] == "percent":
            discount = (body.amount * data["value"]) / 100
        else:
            discount = data["value"]

        return {
            "valid": True,
            "discount": discount,
            "final_amount": max(0, body.amount - discount),
            "code": body.code.upper(),
            "type": data["type"],
            "value": data["value"],
        }

    try:
        return await asyncio.to_thread(_read_coupon)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Coupon validation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Validation error")


@app.post("/admin/grant-access")
@limiter.limit("10/minute")
async def admin_grant_access(request: Request, body: GrantAccessRequest):
    """Manually grant product access to a user."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _write_access() -> dict:
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).set(
            {
                "productId": body.product_id,
                "type": body.product_type,
                "title": body.title,
                "price": body.price,
                "grantedBy": "admin",
                "status": "active",
                "accessStatus": "active",
                "source": "admin",
                "hasDownloadLink": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        db.collection("users").document(body.uid).collection("notifications").add(
            {
                "title": "Access Granted",
                "message": f"An administrator has granted you access to: {body.title}",
                "type": "system",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "read": False,
            }
        )
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_write_access)
    except Exception as exc:
        logger.error("Manual grant failed: %s", exc)
        raise HTTPException(status_code=500, detail="Grant failed")


@app.post("/admin/revoke-access")
@limiter.limit("10/minute")
async def admin_revoke_access(request: Request, body: RevokeAccessRequest):
    """Manually revoke product access from a user."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _delete_access() -> dict:
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).delete()
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_delete_access)
    except Exception as exc:
        logger.error("Revoke failed: %s", exc)
        raise HTTPException(status_code=500, detail="Revoke failed")


@app.patch("/admin/orders/{order_id}")
@limiter.limit("10/minute")
async def admin_update_order(request: Request, order_id: str, body: UpdateOrderStatusRequest):
    """Update order status and tracking information."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _update_order() -> dict:
        update_data = {
            "status": body.status,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        if body.tracking_number:
            update_data["trackingNumber"] = body.tracking_number
        if body.admin_note:
            update_data["adminNote"] = body.admin_note

        db.collection("orders_index").document(order_id).update(update_data)
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_update_order)
    except Exception as exc:
        logger.error("Order update failed: %s", exc)
        raise HTTPException(status_code=500, detail="Update failed")


@app.post("/admin/send-notification")
@limiter.limit("10/minute")
async def admin_send_notification(request: Request, body: SendNotificationRequest):
    """Send a notification to one user or broadcast to all users."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _send_notification() -> dict:
        notif_data = {
            "title": body.title,
            "message": body.message,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False,
        }

        if body.uid:
            db.collection("users").document(body.uid).collection("notifications").add(notif_data)
            return {"status": "success", "sent": 1}

        users = list(db.collection("users").stream())
        for user in users:
            db.collection("users").document(user.id).collection("notifications").add(notif_data)
        return {"status": "success", "sent": len(users)}

    try:
        return await asyncio.to_thread(_send_notification)
    except Exception as exc:
        logger.error("Notification failed: %s", exc)
        raise HTTPException(status_code=500, detail="Notification failed")


@app.patch("/admin/users/{uid}/block")
@limiter.limit("10/minute")
async def admin_block_user(request: Request, uid: str, blocked: bool):
    """Block or unblock a user."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _set_block_status() -> dict:
        db.collection("users").document(uid).update(
            {
                "blocked": blocked,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return {"status": "success"}

    try:
        return await asyncio.to_thread(_set_block_status)
    except Exception as exc:
        logger.error("User block failed: %s", exc)
        raise HTTPException(status_code=500, detail="Block failed")


@app.post("/admin/tickets/{ticket_id}/reply")
@limiter.limit("10/minute")
async def admin_reply_ticket(request: Request, ticket_id: str, body: AdminReplyRequest):
    """Reply to a support ticket, mark it resolved, and notify the user."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _reply_ticket() -> dict:
        ticket_ref = db.collection("tickets").document(ticket_id)
        ticket = ticket_ref.get()
        if not ticket.exists:
            raise HTTPException(status_code=404, detail="Ticket not found")

        ticket_data = ticket.to_dict() or {}
        update_data = {
            "adminReply": body.reply,
            "status": "resolved",
            "resolvedAt": firestore.SERVER_TIMESTAMP,
        }
        ticket_ref.update(update_data)

        uid = ticket_data.get("uid")
        if uid:
            db.collection("users").document(uid).collection("tickets").document(ticket_id).set(update_data, merge=True)
            db.collection("users").document(uid).collection("notifications").add(
                {
                    "title": "Support Ticket Updated",
                    "message": body.reply,
                    "type": "support",
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "read": False,
                }
            )

        return {"status": "success"}

    try:
        return await asyncio.to_thread(_reply_ticket)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Ticket reply failed: %s", exc)
        raise HTTPException(status_code=500, detail="Ticket reply failed")


@app.get("/")
async def health():
    return {"status": "Support Bot Backend Running"}


@app.get("/uptime")
async def uptime_check():
    return "OK"


@app.get("/ai/status")
async def ai_status():
    """Return the current AI support system status."""
    tool_list = list_mcp_tools()
    tool_names = [tool.get("function", tool)["name"] for tool in tool_list]
    return {
        "status": "ready",
        "model": settings.openai_chat_model,
        "rag": "ChromaDB semantic search with OpenAI embeddings",
        "tools": tool_names,
        "tool_count": len(tool_names),
        "rate_limit": "20/minute on chat; 10/minute on admin routes",
    }


@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health_check():
    return {"status": "ok"}
