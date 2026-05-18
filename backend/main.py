import os
import json
import hashlib
import logging
import traceback
import time
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from firebase_admin import firestore
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from cachetools import TTLCache

from backend.api.chat import router as chat_router
from backend.api.webhook import router as webhook_router
from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.rate_limit import limiter
from backend.mcp.server import list_tools as list_mcp_tools, warm_tool_cache
from backend.rag.ingest import close_chroma, ingest_policies, ingest_products

# 1. Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
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

# 2. Load Environment Variables
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))
CHAT_MODEL = settings.openai_chat_model
KNOWLEDGE_BASE_PATH = str(settings.policies_path)

# 3. FastAPI App Setup
app = FastAPI(title="Dharma Divine Chatbot API", lifespan=lifespan)

# 4. Rate Limiter Setup (SECURITY)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security: CORS and Trusted Host
# Security: CORS - Allow All for now (or add your frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] # CHANGE THIS: Allow all hosts
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(chat_router)
app.include_router(webhook_router)

# 5. Firebase Setup
db = get_firestore_client()

# 6. Models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    email: str
    name: Optional[str] = None
    uid: Optional[str] = None

class CreateOrderRequest(BaseModel):
    product_type: str   # "ebook" | "sdcard" | "pendrive"
    product_id: str
    uid: str
    phone: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    uid: str
    email: str
    name: Optional[str] = None
    phone: str
    product_type: str
    product_id: str
    shipping: Optional[dict] = None

# 7. In-Memory Session Storage (Note: Use Redis/DB for production)
SESSION_MEMORY: dict[str, list[dict]] = {}

# 8. Response Cache (10x speed improvement)
RESPONSE_CACHE: TTLCache = TTLCache(maxsize=512, ttl=3600)

def load_knowledge_base() -> str:
    """Load the RAG knowledge base from disk."""
    try:
        with open(KNOWLEDGE_BASE_PATH, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        logger.warning("Knowledge base file not found: %s", KNOWLEDGE_BASE_PATH)
    except Exception as exc:
        logger.error("Knowledge base load failed: %s", exc)
    return ""

KNOWLEDGE_BASE = load_knowledge_base()

def retrieve_knowledge_snippets(query: str, limit: int = 3) -> list[str]:
    """Small dependency-free retrieval layer for policy/product grounding."""
    if not query or not KNOWLEDGE_BASE:
        return []

    query_terms = {
        token.strip(".,!?;:()[]{}\"'").lower()
        for token in query.split()
        if len(token.strip(".,!?;:()[]{}\"'")) > 2
    }

    sections = [section.strip() for section in KNOWLEDGE_BASE.split("---") if section.strip()]
    scored_sections = []
    for section in sections:
        normalized = section.lower()
        score = sum(1 for term in query_terms if term in normalized)
        if score:
            scored_sections.append((score, section))

    scored_sections.sort(key=lambda item: item[0], reverse=True)
    return [section for _, section in scored_sections[:limit]]

def should_cache_message(message: str) -> bool:
    """Avoid caching identity, memory, payment, and support workflows."""
    sensitive_terms = {
        "name", "earlier", "previous", "first message", "payment", "refund",
        "issue", "problem", "access", "not received", "instagram", "ticket",
        "order", "contact", "agent"
    }
    normalized = message.lower()
    return not any(term in normalized for term in sensitive_terms)

def get_cache_key(email: str, message: str) -> str:
    """Generate cache key from user and message."""
    normalized = f"{email.lower().strip()}::{message.lower().strip()}"
    return hashlib.md5(normalized.encode()).hexdigest()

def get_cached_response(cache_key: str) -> Optional[str]:
    """Retrieve cached response; TTLCache handles expiry."""
    cached = RESPONSE_CACHE.get(cache_key)
    if cached:
        logger.info(f"Cache HIT for key: {cache_key[:8]}...")
    return cached

def set_cached_response(cache_key: str, response: str):
    """Cache a response using the configured TTLCache."""
    RESPONSE_CACHE[cache_key] = response
    logger.info(f"Cache SET for key: {cache_key[:8]}...")

# 9. Tools Configuration
tools = [
    {
        "type": "function",
        "function": {
            "name": "save_ticket",
            "description": "Save a support ticket when the user provides their Instagram ID for an issue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "instagram_id": {"type": "string", "description": "User's Instagram ID"},
                    "issue_description": {"type": "string", "description": "Summary of the issue"}
                },
                "required": ["instagram_id", "issue_description"]
            }
        }
    }
]

SYSTEM_PROMPT = """
You are the support bot for "I Love Great Epic Mahabharat".

You help with:
- Product questions
- Order / access issues
- Basic agent-service contact requests

PRODUCT DATA:
- Vijnana Bhairava Tantra Ebook: ₹499, PDF, instant download, lifetime access.
- Mahabharata SD Card: coming soon.

BEHAVIOUR:

1) GREETING
   - Start by wishing the user with their name (e.g., "Hello <name>!" or "Hi <name>!").
   - Then ask how you can assist them.
   - Do NOT say "Your name is <name>" as a greeting.

2) NAME QUESTIONS (STRICT)
   - ONLY if the user explicitly asks "What is my name?" or similar direct variants:
       Reply: "Your name is <name>."
   - Do NOT use this answer for any other type of question.

3) CHAT HISTORY QUESTIONS
   - If the user asks what they said earlier (first message, previous message, etc.),
     answer from the visible conversation history, not using the name rule.

4) PRODUCT QUERIES
   - Answer short and natural using PRODUCT DATA.
   - Rephrase in your own wording, do not copy product lines exactly.

5) ISSUES OR AGENT REQUESTS (STRICT 3-STEP FLOW)
   - If the user reports a problem (payment, not received, access, refund, etc.)
     or asks for help building an agent or wants to be contacted:

     STEP 1: Ask for Instagram ID:
         "Please share your Instagram ID."

     STEP 2: After Instagram ID is given, ask for issue details:
         "Please share the details of the issue you are facing."

     STEP 3: Once BOTH Instagram ID and issue details are present:
         - CALL the tool `save_ticket` with:
             instagram_id, issue_description
         - After the tool runs, reply exactly:
             "We received your issue. We will contact you shortly."

STYLE:
- Very short replies (1–2 sentences).
- Friendly, simple, natural.
- Use the user's name naturally in the conversation when appropriate.
- Never reveal technical details or internal logic.
"""

# 9. Helper Functions
def save_ticket_to_db(data: dict, uid: Optional[str] = None) -> bool:
    """Saves ticket to Firestore. Returns True on success."""
    if not db:
        logger.warning("DB not initialized. Skipping save.")
        return False

    try:
        data["createdAt"] = firestore.SERVER_TIMESTAMP
        data["status"] = "open"

        if uid:
            db.collection("users").document(uid).collection("tickets").add(data)
            logger.info(f"Ticket saved to users/{uid}/tickets")
        else:
            db.collection("tickets").add(data)
            logger.info("Ticket saved to root tickets")
        return True
    except Exception as e:
        logger.error(f"Error saving ticket: {e}")
        return False

# 11b. Admin Management Models
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
    uid: Optional[str] = None  # if None, send to all (caution!)

class AdminReplyRequest(BaseModel):
    reply: str

def require_admin_secret(request: Request) -> None:
    """Require the configured admin secret for every admin backend route."""
    provided = request.headers.get("X-Admin-Secret", "")
    if not settings.admin_secret or provided != settings.admin_secret:
        raise HTTPException(status_code=401, detail="Invalid admin secret")

# 11. Simple Order Completion Route (no payment gateway)
class CompleteOrderRequest(BaseModel):
    uid: str
    email: str
    name: Optional[str] = None
    phone: str
    product_type: str   # "ebook" | "sdcard" | "pendrive"
    product_id: str
    base_price: float   # The original price of the product
    coupon_code: Optional[str] = None
    shipping: Optional[dict] = None

@app.post("/complete-order")
@limiter.limit("20/minute")
async def complete_order(request: Request, body: CompleteOrderRequest):
    """Instantly completes an order, applying coupons if present, and grants product access."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        base_price = body.base_price
        final_amount = base_price
        discount_value = 0
        product_type = body.product_type.lower()
        product_title = f"{product_type.title()} - {body.product_id}"

        # 1. Process Coupon if provided
        if body.coupon_code:
            coupon_ref = db.collection("coupons").document(body.coupon_code.upper())
            coupon = coupon_ref.get()
            
            if coupon.exists:
                c_data = coupon.to_dict()
                is_enabled = c_data.get("enabled", True)
                expires_at = c_data.get("expiresAt")
                max_uses = c_data.get("maxUses")
                used_count = c_data.get("usedCount", 0)

                # Security & Validity Checks
                valid = is_enabled
                if valid and expires_at and expires_at.timestamp() < time.time():
                    valid = False
                if valid and max_uses and used_count >= max_uses:
                    valid = False

                if valid:
                    if c_data["type"] == "percent":
                        discount_value = (base_price * c_data["value"]) / 100
                    else:
                        discount_value = c_data["value"]
                    
                    final_amount = max(0, base_price - discount_value)
                    
                    # Increment usage count
                    coupon_ref.update({"usedCount": firestore.Increment(1)})
                    logger.info(f"Coupon {body.coupon_code} applied. Discount: ₹{discount_value}")

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
            "shipping": body.shipping or {},
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        # Write 1: User's personal order history
        user_order_ref = db.collection("users").document(body.uid).collection("orders").add(order_data)
        order_doc_id = user_order_ref[1].id
        logger.info(f"Order saved: users/{body.uid}/orders/{order_doc_id}")

        # Write 2: Admin flat index
        db.collection("orders_index").document(order_doc_id).set(order_data)

        # Write 3: Grant product access
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).set({
            "productId": body.product_id,
            "type": product_type,
            "title": product_title,
            "price": final_amount,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        logger.info(f"Purchase access granted: users/{body.uid}/purchases/{body.product_id}. Final Price: ₹{final_amount}")

        return {"status": "success", "order_id": order_doc_id, "final_amount": final_amount}

    except Exception as e:
        logger.error(f"Order completion failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not complete order")
# 11c. Coupon & Admin Control Endpoints

@app.post("/validate-coupon")
async def validate_coupon(body: ValidateCouponRequest):
    """Validates a coupon code and returns the discount."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        coupon_ref = db.collection("coupons").document(body.code.upper())
        coupon = coupon_ref.get()
        
        if not coupon.exists:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        data = coupon.to_dict()
        if not data.get("enabled", True):
            raise HTTPException(status_code=400, detail="Coupon is disabled")
        
        # Check expiry
        expires_at = data.get("expiresAt")
        if expires_at and expires_at.timestamp() < time.time():
            raise HTTPException(status_code=400, detail="Coupon has expired")
        
        # Check usage limit
        max_uses = data.get("maxUses")
        used_count = data.get("usedCount", 0)
        if max_uses and used_count >= max_uses:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        
        # Calculate discount
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
            "value": data["value"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Coupon validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation error")

@app.post("/admin/grant-access")
@limiter.limit("10/minute")
async def admin_grant_access(request: Request, body: GrantAccessRequest):
    """Manually grants product access to a user (Admin Only)."""
    require_admin_secret(request)
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # 1. Add to purchases collection
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).set({
            "productId": body.product_id,
            "type": body.product_type,
            "title": body.title,
            "price": body.price,
            "grantedBy": "admin",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        
        # 2. Add a notification
        db.collection("users").document(body.uid).collection("notifications").add({
            "title": "Access Granted! 🎉",
            "message": f"An administrator has granted you access to: {body.title}",
            "type": "system",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False
        })
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Manual grant failed: {e}")
        raise HTTPException(status_code=500, detail="Grant failed")

@app.post("/admin/revoke-access")
@limiter.limit("10/minute")
async def admin_revoke_access(request: Request, body: RevokeAccessRequest):
    """Manually revokes product access from a user (Admin Only)."""
    require_admin_secret(request)
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).delete()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Revoke failed: {e}")
        raise HTTPException(status_code=500, detail="Revoke failed")

@app.patch("/admin/orders/{order_id}")
@limiter.limit("10/minute")
async def admin_update_order(request: Request, order_id: str, body: UpdateOrderStatusRequest):
    """Updates order status and tracking info (Admin Only)."""
    require_admin_secret(request)
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        update_data = {
            "status": body.status,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
        if body.tracking_number: update_data["trackingNumber"] = body.tracking_number
        if body.admin_note: update_data["adminNote"] = body.admin_note
        
        # Update both locations
        db.collection("orders_index").document(order_id).update(update_data)
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Order update failed: {e}")
        raise HTTPException(status_code=500, detail="Update failed")

@app.post("/admin/send-notification")
@limiter.limit("10/minute")
async def admin_send_notification(request: Request, body: SendNotificationRequest):
    """Sends a notification to a specific user or all users (Admin Only)."""
    require_admin_secret(request)
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        notif_data = {
            "title": body.title,
            "message": body.message,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False
        }
        
        if body.uid:
            db.collection("users").document(body.uid).collection("notifications").add(notif_data)
        else:
            # BROADCAST
            users = db.collection("users").stream()
            for user in users:
                db.collection("users").document(user.id).collection("notifications").add(notif_data)
                
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Notification failed: {e}")
        raise HTTPException(status_code=500, detail="Notification failed")

@app.patch("/admin/users/{uid}/block")
@limiter.limit("10/minute")
async def admin_block_user(request: Request, uid: str, blocked: bool):
    """Blocks or unblocks a user (Admin Only)."""
    require_admin_secret(request)
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        db.collection("users").document(uid).update({
            "blocked": blocked,
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
        return {"status": "success"}
    except Exception as e:
        logger.error(f"User block failed: {e}")
        raise HTTPException(status_code=500, detail="Block failed")

@app.post("/admin/tickets/{ticket_id}/reply")
@limiter.limit("10/minute")
async def admin_reply_ticket(request: Request, ticket_id: str, body: AdminReplyRequest):
    """Reply to a support ticket, mark it resolved, and notify the user."""
    require_admin_secret(request)
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
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
            db.collection("users").document(uid).collection("notifications").add({
                "title": "Support Ticket Updated",
                "message": body.reply,
                "type": "support",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "read": False,
            })

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ticket reply failed: {e}")
        raise HTTPException(status_code=500, detail="Ticket reply failed")


# 12. Health Routes
@app.get("/")
async def health():
    return {"status": "Support Bot Backend Running"}

@app.get("/uptime")
async def uptime_check():
    return "OK"

@app.get("/ai/status")
async def ai_status():
    """Interview-friendly AI system status endpoint."""
    return {
        "status": "ready",
        "model": CHAT_MODEL,
        "knowledge_base_loaded": bool(KNOWLEDGE_BASE),
        "retrieval": "semantic ChromaDB RAG with graceful keyword fallback artifacts",
        "tool_calling": [tool["name"] for tool in list_mcp_tools()],
        "rate_limit": "20/minute on chat and order completion; 10/minute on admin routes",
    }

@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health_check():
    return {"status": "ok"}
