import os
import asyncio
import hashlib
import hmac
import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from firebase_admin import firestore
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(os.path.join(Path(__file__).resolve().parent, ".env"))

from backend.api.admin import router as admin_router
from backend.api.chat import router as chat_router
from backend.api.webhook import router as webhook_router
from backend.core.auth import verify_request_uid
from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.rate_limit import RATE_LIMIT_SINGLE_INSTANCE_WARNING, limiter
from backend.mcp.server import warm_tool_cache
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
    """Start the API immediately, warming RAG and MCP resources in the background."""
    executor = ThreadPoolExecutor(max_workers=40, thread_name_prefix="firestore")
    loop = asyncio.get_running_loop()
    loop.set_default_executor(executor)
    try:
        web_concurrency = int(os.getenv("WEB_CONCURRENCY", "1") or "1")
    except ValueError:
        web_concurrency = 1
    if web_concurrency > 1:
        logger.warning(RATE_LIMIT_SINGLE_INSTANCE_WARNING)

    async def _warm_resources() -> None:
        try:
            _validate_policies_file()
            await ingest_policies()
            await ingest_products()
            warm_tool_cache()
            logger.info("RAG pipeline ready")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Startup warmup failed gracefully: %s", exc)

    warmup_task = asyncio.create_task(_warm_resources())
    try:
        yield
    finally:
        if not warmup_task.done():
            warmup_task.cancel()
            try:
                await warmup_task
            except asyncio.CancelledError:
                pass
        executor.shutdown(wait=False)
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
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=5)


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
app.include_router(admin_router)


class _DuplicateTransaction(Exception):
    pass


def _db():
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return db


def _get_active_product(db, product_id: str) -> dict:
    """Fetch a product's authoritative price/type/title from Firestore.

    Prices are never trusted from the client — every endpoint that charges
    money looks the price up here instead of accepting it in the request body.
    """
    doc = db.collection("products").document((product_id or "").strip()).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")
    data = doc.to_dict() or {}
    if data.get("enabled", True) is False:
        raise HTTPException(status_code=404, detail="Product not found")
    return data


def _coupon_discount_from_snapshot(data: dict, price: float) -> float:
    """Compute a coupon's discount for a price from a Firestore coupon snapshot."""
    if not data.get("enabled", True):
        return 0
    expires_at = data.get("expiresAt")
    if expires_at and expires_at.timestamp() < time.time():
        return 0
    max_uses = data.get("maxUses")
    used_count = data.get("usedCount", 0)
    if max_uses and used_count >= max_uses:
        return 0
    coupon_type = data.get("type", "fixed")
    coupon_value = float(data.get("value", 0))
    discount = (price * coupon_value / 100) if coupon_type == "percent" else coupon_value
    return max(0.0, min(float(price), discount))


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
    product_id: str
    coupon_code: Optional[str] = None


class ValidateCouponRequest(BaseModel):
    code: str
    amount: float


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
    """Create a Razorpay order for the product's authoritative Firestore price.

    The client never supplies the amount — Razorpay orders are immutable once
    created, so pricing correctly here is what makes the signature check in
    /complete-order actually mean something.
    """
    await verify_request_uid(request, body.uid, required=True)

    def _create() -> dict:
        db = _db()
        product = _get_active_product(db, body.product_id)
        base_price = float(product.get("price", 0) or 0)
        if base_price <= 0:
            raise HTTPException(status_code=400, detail="Invalid product price")

        coupon_code = (body.coupon_code or "").strip().upper() or None
        discount = 0.0
        if coupon_code:
            coupon_snap = db.collection("coupons").document(coupon_code).get()
            if coupon_snap.exists:
                discount = _coupon_discount_from_snapshot(coupon_snap.to_dict() or {}, base_price)

        final_amount = max(0.0, base_price - discount)

        # Razorpay can't create a ₹0 order (its minimum is ₹1), and there's
        # nothing to sign a payment for when a coupon fully covers the price.
        # Record a "free" intent instead — complete-order recognizes it and
        # grants access without a Razorpay signature, since the ₹0 amount was
        # computed here from the authoritative product price + coupon, not
        # supplied by the client.
        if final_amount <= 0:
            intent_ref = db.collection("payment_intents").document()
            intent_ref.set(
                {
                    "uid": body.uid,
                    "productId": body.product_id,
                    "productType": product.get("type", ""),
                    "productTitle": product.get("title", ""),
                    "basePrice": base_price,
                    "couponCode": coupon_code,
                    "discount": discount,
                    "amount": 0.0,
                    "free": True,
                    "used": False,
                    "createdAt": firestore.SERVER_TIMESTAMP,
                }
            )
            return {
                "order_id": intent_ref.id,
                "amount": 0.0,
                "currency": "INR",
                "key": None,
                "free": True,
            }

        if not settings.razorpay_key_id or not settings.razorpay_key_secret:
            raise HTTPException(status_code=503, detail="Payment gateway is not configured")

        import razorpay

        client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
        order = client.order.create(
            {
                "amount": int(round(final_amount * 100)),
                "currency": "INR",
                "receipt": f"order_{body.uid[:8]}_{int(time.time())}",
                "notes": {"uid": body.uid, "product_id": body.product_id},
            }
        )

        db.collection("payment_intents").document(order["id"]).set(
            {
                "uid": body.uid,
                "productId": body.product_id,
                "productType": product.get("type", ""),
                "productTitle": product.get("title", ""),
                "basePrice": base_price,
                "couponCode": coupon_code,
                "discount": discount,
                "amount": final_amount,
                "free": False,
                "used": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return {
            "order_id": order["id"],
            "amount": final_amount,
            "currency": "INR",
            "key": settings.razorpay_key_id,
            "free": False,
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
    await verify_request_uid(request, body.uid, required=True)

    def _write_order() -> dict:
        db = _db()
        transaction_details = body.transaction_details or {}
        razorpay_order_id = body.razorpay_order_id or transaction_details.get("razorpay_order_id")
        razorpay_payment_id = body.razorpay_payment_id or transaction_details.get("razorpay_payment_id")
        razorpay_signature = body.razorpay_signature or transaction_details.get("razorpay_signature")

        allow_test_payment = body.test_payment and (settings.is_dev or settings.allow_payment_bypass)

        intent = None
        intent_ref = None
        if razorpay_order_id:
            intent_ref = db.collection("payment_intents").document(razorpay_order_id)
            intent_snap = intent_ref.get()
            if intent_snap.exists:
                intent = intent_snap.to_dict() or {}

        # A "free" intent was recorded by create-razorpay-order itself, with an
        # amount computed server-side from the real product price and coupon —
        # it never went through Razorpay, so there is no signature to check.
        is_free_intent = bool(intent) and intent.get("free") is True and float(intent.get("amount", 0) or 0) <= 0

        if not allow_test_payment and not is_free_intent:
            _verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
            if intent is None:
                raise HTTPException(status_code=403, detail="Unknown payment order")

        if intent is not None:
            if intent.get("uid") != body.uid:
                raise HTTPException(status_code=403, detail="Payment order does not belong to this account")
            if intent.get("used"):
                raise HTTPException(status_code=409, detail="Payment order already processed")

        # Pricing and product identity always come from a server-trusted source:
        # the payment_intent recorded at order-creation time for real payments,
        # or a fresh Firestore product lookup for gated dev/test-bypass payments.
        # The client-supplied product_id/product_type/base_price/coupon_code in
        # `body` are never used to compute money or grant access.
        product = None
        if intent is not None:
            product_id = intent.get("productId") or ""
            product_type = (intent.get("productType") or "").lower()
            product_title = intent.get("productTitle") or f"{product_type.title()} - {product_id}"
            base_price = float(intent.get("basePrice", 0))
            discount_value = float(intent.get("discount", 0))
            final_amount = float(intent.get("amount", max(0.0, base_price - discount_value)))
            coupon_code = intent.get("couponCode")
        else:
            product_id = (body.product_id or "").strip()
            product = _get_active_product(db, product_id)
            product_type = (product.get("type") or body.product_type or "").lower()
            product_title = body.product_title or product.get("title") or f"{product_type.title()} - {product_id}"
            base_price = float(product.get("price", 0) or 0)
            coupon_code = (body.coupon_code or "").strip().upper() or None
            discount_value = 0.0
            if coupon_code:
                coupon_ref = db.collection("coupons").document(coupon_code)

                @firestore.transactional
                def _apply_coupon(transaction, ref, price):
                    snap = ref.get(transaction=transaction)
                    if not snap.exists:
                        return 0.0
                    discount = _coupon_discount_from_snapshot(snap.to_dict() or {}, price)
                    if discount > 0:
                        transaction.update(ref, {"usedCount": firestore.Increment(1)})
                    return discount

                discount_value = _apply_coupon(db.transaction(), coupon_ref, base_price)
            final_amount = max(0.0, base_price - discount_value)

        transaction_id = (
            transaction_details.get("transaction_id")
            or transaction_details.get("gateway_payment_id")
            or razorpay_payment_id
            or body.payment_ref
        )
        if not transaction_id:
            prefix = "txn_free" if is_free_intent else "txn_test"
            transaction_id = f"{prefix}_{db.collection('transactions_index').document().id}"
        transaction_index_ref = db.collection("transactions_index").document(transaction_id)

        @firestore.transactional
        def _claim_transaction(transaction, ref):
            snap = ref.get(transaction=transaction)
            if snap.exists:
                raise _DuplicateTransaction()
            transaction.set(ref, {"claimed": True, "claimedAt": firestore.SERVER_TIMESTAMP})

        try:
            _claim_transaction(db.transaction(), transaction_index_ref)
        except _DuplicateTransaction:
            raise HTTPException(status_code=409, detail="Transaction already processed")

        transaction_details = {
            **transaction_details,
            "transaction_id": transaction_id,
            "gateway": "free" if is_free_intent else (body.payment_mode or "test_checkout"),
            "status": "free" if is_free_intent else ("captured" if body.test_payment else "paid"),
            "currency": "INR",
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        }

        product_ref = None
        product_snap = None
        if product_type in {"pendrive", "sdcard"}:
            product_ref = db.collection("products").document(product_id)
            product_snap = product_ref.get()
            if product_snap.exists:
                stock = (product_snap.to_dict() or {}).get("stockCount", 999)
                if stock <= 0:
                    raise HTTPException(status_code=400, detail="Product is out of stock")

        # The readable file is whatever the catalog says it is. Trusting the
        # client's copy would let a stale or placeholder catalog persist a dead
        # link onto a real purchase, leaving a paying customer with no book.
        if product is None:
            product_doc = db.collection("products").document(product_id).get()
            product = (product_doc.to_dict() or {}) if product_doc.exists else {}
        download_link = (
            product.get("driveLink")
            or product.get("downloadLink")
            or body.download_link
            or None
        )
        product_language = product.get("language") or body.product_language
        product_image = product.get("image") or product.get("imageUrl") or body.product_image

        order_data = {
            "uid": body.uid,
            "userName": body.name or "",
            "email": body.email,
            "phone": body.phone,
            "productId": product_id,
            "productTitle": product_title,
            "productType": product_type,
            "basePrice": base_price,
            "discount": discount_value,
            "amount": final_amount,
            "couponCode": coupon_code,
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
            "productId": product_id,
            "product_id": product_id,
            "type": product_type,
            "productType": product_type,
            "title": product_title,
            "language": product_language,
            "imageUrl": product_image,
            "price": final_amount,
            "orderId": order_doc_id,
            "status": "active",
            "accessStatus": "active",
            "source": "checkout",
            "paymentMode": body.payment_mode or "direct",
            "paymentRef": body.payment_ref,
            "transactionId": transaction_id,
            "testPayment": body.test_payment,
            "downloadLink": download_link,
            "driveLink": download_link,
            "hasDownloadLink": bool(download_link),
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
            "productId": product_id,
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
        batch.set(db.collection("users").document(body.uid).collection("purchases").document(product_id), purchase_data)
        if transaction_id:
            batch.set(db.collection("users").document(body.uid).collection("transactions").document(transaction_id), transaction_data)
            batch.set(transaction_index_ref, transaction_data)
        if product_ref is not None and product_snap is not None and product_snap.exists:
            batch.update(product_ref, {"stockCount": firestore.Increment(-1)})
        if intent_ref is not None:
            batch.set(intent_ref, {"used": True, "usedAt": firestore.SERVER_TIMESTAMP}, merge=True)
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
    def _read_coupon() -> dict:
        db = _db()
        coupon_ref = db.collection("coupons").document(body.code.upper())
        coupon = coupon_ref.get()
        if not coupon.exists:
            raise HTTPException(status_code=404, detail="Coupon not found")

        data = coupon.to_dict() or {}
        if not data.get("enabled", True):
            raise HTTPException(status_code=400, detail="Coupon is disabled")

        expires_at = data.get("expiresAt")
        if expires_at and expires_at.timestamp() < time.time():
            raise HTTPException(status_code=400, detail="Coupon has expired")

        max_uses = data.get("maxUses")
        used_count = data.get("usedCount", 0)
        if max_uses and used_count >= max_uses:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")

        coupon_type = data.get("type", "fixed")
        coupon_value = data.get("value", 0)
        discount = (body.amount * coupon_value / 100) if coupon_type == "percent" else coupon_value

        return {
            "valid": True,
            "discount": discount,
            "final_amount": max(0, body.amount - discount),
            "code": body.code.upper(),
            "type": coupon_type,
            "value": coupon_value,
        }

    try:
        return await asyncio.to_thread(_read_coupon)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Coupon validation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Validation error")


@app.get("/")
async def health():
    return {"status": "Support Bot Backend Running"}


@app.get("/uptime")
async def uptime_check():
    return "OK"


@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health_check():
    return {"status": "ok"}
