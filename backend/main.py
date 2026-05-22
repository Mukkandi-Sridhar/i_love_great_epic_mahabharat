import os
import asyncio
import hashlib
import hmac
import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
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
from backend.core.auth import require_admin, verify_request_uid
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


def _validate_policies_file() -> None:
    """Warn when the configured policies file looks generic instead of domain-specific."""
    try:
        policy_path = settings.policies_path
        if not policy_path.exists():
            return
        content = policy_path.read_text(encoding="utf-8")
        lowered = content.lower()
        if "mahabharat" not in lowered and "ilovegreatepic" not in lowered:
            logger.warning("Policies file may not be domain-specific. Check %s", policy_path)
    except Exception as exc:
        logger.warning("Could not validate policies file: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm RAG and MCP resources on startup, then release local handles."""
    try:
        _validate_policies_file()
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
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


class CreateRazorpayOrderRequest(BaseModel):
    uid: str
    amount: float


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


def _verify_razorpay_signature(
    razorpay_order_id: str | None,
    razorpay_payment_id: str | None,
    razorpay_signature: str | None,
) -> None:
    """Verify Razorpay checkout signature before granting access."""
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payment verification unavailable")
    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        raise HTTPException(status_code=403, detail="Missing payment signature")

    expected = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(status_code=403, detail="Invalid payment signature")


@app.post("/create-razorpay-order")
@limiter.limit("20/minute")
async def create_razorpay_order(request: Request, body: CreateRazorpayOrderRequest):
    """Create a Razorpay order server-side."""
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payment gateway is not configured")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    def _create() -> dict:
        import razorpay

        client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
        order = client.order.create(
            {
                "amount": int(round(body.amount * 100)),
                "currency": "INR",
                "receipt": f"order_{body.uid[:8]}_{int(time.time())}",
            }
        )
        return {
            "order_id": order["id"],
            "amount": body.amount,
            "currency": "INR",
            "key": settings.razorpay_key_id,
        }

    try:
        return await asyncio.to_thread(_create)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not create payment order")


@app.post("/complete-order")
@limiter.limit("20/minute")
async def complete_order(request: Request, body: CompleteOrderRequest):
    """Complete an order, apply a valid coupon, and grant product access."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    await verify_request_uid(request, body.uid, required=True)

    def _write_order() -> dict:
        base_price = body.base_price
        final_amount = base_price
        discount_value = 0
        product_type = body.product_type.lower()
        product_title = body.product_title or f"{product_type.title()} - {body.product_id}"
        transaction_details = body.transaction_details or {}
        razorpay_order_id = body.razorpay_order_id or transaction_details.get("razorpay_order_id")
        razorpay_payment_id = body.razorpay_payment_id or transaction_details.get("razorpay_payment_id")
        razorpay_signature = body.razorpay_signature or transaction_details.get("razorpay_signature")

        allow_test_payment = body.test_payment and (settings.is_dev or settings.allow_payment_bypass)
        if not allow_test_payment:
            _verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature)

        transaction_id = (
            transaction_details.get("transaction_id")
            or transaction_details.get("gateway_payment_id")
            or razorpay_payment_id
            or body.payment_ref
        )
        if not transaction_id:
            transaction_id = f"txn_test_{db.collection('transactions_index').document().id}"
        transaction_index_ref = db.collection("transactions_index").document(transaction_id)
        if transaction_index_ref.get().exists:
            raise HTTPException(status_code=409, detail="Transaction already processed")

        transaction_details = {
            "transaction_id": transaction_id,
            "gateway": body.payment_mode or "test_checkout",
            "status": "captured" if body.test_payment else "paid",
            "currency": "INR",
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            **transaction_details,
        }

        product_ref = None
        product_snap = None
        if product_type in {"pendrive", "sdcard"}:
            product_ref = db.collection("products").document(body.product_id)
            product_snap = product_ref.get()
            if product_snap.exists:
                stock = (product_snap.to_dict() or {}).get("stockCount", 999)
                if stock <= 0:
                    raise HTTPException(status_code=400, detail="Product is out of stock")

        if body.coupon_code:
            coupon_ref = db.collection("coupons").document(body.coupon_code.upper())

            @firestore.transactional
            def _apply_coupon(transaction, ref, price):
                snap = ref.get(transaction=transaction)
                if not snap.exists:
                    return 0
                data = snap.to_dict() or {}
                if not data.get("enabled", True):
                    return 0
                expires_at = data.get("expiresAt")
                if expires_at and expires_at.timestamp() < time.time():
                    return 0
                max_uses = data.get("maxUses")
                used_count = data.get("usedCount", 0)
                if max_uses and used_count >= max_uses:
                    return 0
                discount = (price * data["value"]) / 100 if data["type"] == "percent" else data["value"]
                transaction.update(ref, {"usedCount": firestore.Increment(1)})
                return discount

            discount_value = _apply_coupon(db.transaction(), coupon_ref, base_price)
            final_amount = max(0, base_price - discount_value)

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
            batch.set(transaction_index_ref, transaction_data)
        if product_ref is not None and product_snap is not None and product_snap.exists:
            batch.update(product_ref, {"stockCount": firestore.Increment(-1)})
        batch.commit()
        return {
            "status": "success",
            "order_id": order_doc_id,
            "final_amount": final_amount,
            "transaction_id": transaction_id,
        }

    try:
        return await asyncio.to_thread(_write_order)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Order completion failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not complete order")


@app.post("/validate-coupon")
@limiter.limit("10/minute")
async def validate_coupon(request: Request, body: ValidateCouponRequest):
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


@app.post("/admin/rag/refresh")
@limiter.limit("5/minute")
async def refresh_rag(request: Request, admin_uid: str = Depends(require_admin)):
    """Refresh the product RAG index from Firestore."""
    await ingest_products()
    return {"status": "refreshed"}


@app.post("/admin/grant-access")
@limiter.limit("10/minute")
async def admin_grant_access(request: Request, body: GrantAccessRequest, admin_uid: str = Depends(require_admin)):
    """Manually grant product access to a user."""
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
async def admin_revoke_access(request: Request, body: RevokeAccessRequest, admin_uid: str = Depends(require_admin)):
    """Manually revoke product access from a user."""
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
async def admin_update_order(
    request: Request,
    order_id: str,
    body: UpdateOrderStatusRequest,
    admin_uid: str = Depends(require_admin),
):
    """Update order status and tracking information."""
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
async def admin_send_notification(
    request: Request,
    body: SendNotificationRequest,
    admin_uid: str = Depends(require_admin),
):
    """Send a notification to one user or broadcast to all users."""
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
async def admin_block_user(request: Request, uid: str, blocked: bool, admin_uid: str = Depends(require_admin)):
    """Block or unblock a user."""
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
async def admin_reply_ticket(
    request: Request,
    ticket_id: str,
    body: AdminReplyRequest,
    admin_uid: str = Depends(require_admin),
):
    """Reply to a support ticket, mark it resolved, and notify the user."""
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
