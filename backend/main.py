import os
import json
import logging
import traceback
import time
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import razorpay

# 1. Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
logger = logging.getLogger("ChatbotBackend")

# 2. Load Environment Variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# 3. FastAPI App Setup
app = FastAPI(title="Dharma Divine Chatbot API")

# 4. Rate Limiter Setup (SECURITY)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security: CORS and Trusted Host
# Security: CORS - Allow All for now (or add your frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # CHANGE THIS: Allow all origins for testing
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

# 4. OpenAI Client
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    timeout=30.0,
    max_retries=2
)



# 5. Firebase Setup
db = None
try:
    cred_path = "serviceAccountKey.json"
    cred = None

    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS")
        if firebase_creds_json:
            cred = credentials.Certificate(json.loads(firebase_creds_json))

    if cred:
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        logger.info("Firebase Initialized Successfully")
    else:
        logger.warning("Firebase credentials not found. Database features disabled.")

except Exception as e:
    logger.error(f"Firebase Init Failed: {e}")

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
RESPONSE_CACHE: dict[str, dict] = {}  # {cache_key: {"response": str, "expires": float}}
CACHE_TTL = 3600  # 1 hour cache lifetime

def get_cache_key(message: str) -> str:
    """Generate cache key from user message."""
    normalized = message.lower().strip()
    return hashlib.md5(normalized.encode()).hexdigest()

def get_cached_response(cache_key: str) -> Optional[str]:
    """Retrieve cached response if not expired."""
    if cache_key in RESPONSE_CACHE:
        cached = RESPONSE_CACHE[cache_key]
        if time.time() < cached["expires"]:
            logger.info(f"Cache HIT for key: {cache_key[:8]}...")
            return cached["response"]
        else:
            # Expired, remove it
            del RESPONSE_CACHE[cache_key]
    return None

def set_cached_response(cache_key: str, response: str):
    """Cache a response with TTL."""
    RESPONSE_CACHE[cache_key] = {
        "response": response,
        "expires": time.time() + CACHE_TTL
    }
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

# 10. Routes
@app.post("/chat")
@limiter.limit("20/minute")  # SECURITY: Max 20 requests per minute per IP
def chat_endpoint(request: Request, chat_request: ChatRequest):
    try:
        user_email = chat_request.email
        user_name = chat_request.name or "there"

        # Initialize or retrieve session
        if user_email not in SESSION_MEMORY:
            SESSION_MEMORY[user_email] = []
        
        # Keep last 20 messages context
        session_history = SESSION_MEMORY[user_email][-20:]

        # Get latest user message for caching
        latest_user_msg = None
        for msg in chat_request.messages:
            if msg.role == "user" and msg.content:
                latest_user_msg = msg.content

        # Check cache first (only for simple queries, not support tickets)
        if latest_user_msg and len(session_history) < 2:  # Only cache initial messages
            cache_key = get_cache_key(latest_user_msg)
            cached_response = get_cached_response(cache_key)
            if cached_response:
                SESSION_MEMORY[user_email].append({"role": "assistant", "content": cached_response})
                return {"response": cached_response}

        # Prepare conversation with system context
        system_content = SYSTEM_PROMPT.replace("<name>", user_name)
        system_content += f"\n\nCONTEXT: The user's name is '{user_name}'."
        
        conversation = [{"role": "system", "content": system_content}] + session_history
        
        # Append new user messages
        for msg in chat_request.messages:
            if msg.content:
                conversation.append({"role": msg.role, "content": msg.content})

        # OpenAI Call
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=conversation,
            tools=tools,
            tool_choice="auto",
        )

        message = res.choices[0].message

        # Handle Tool Calls
        if message.tool_calls:
            tool_call = message.tool_calls[0]
            logger.info(f"Tool called: {tool_call.function.name}")

            try:
                args = json.loads(tool_call.function.arguments or "{}")
                data = {
                    "email": user_email,
                    "insta": args.get("instagram_id", "Not provided"),
                    "msg": args.get("issue_description", "No details"),
                    "type": "issue",
                }

                success = save_ticket_to_db(data, uid=chat_request.uid)
                
                # Log result to memory but show friendly message to user
                SESSION_MEMORY[user_email].append({
                    "role": "assistant",
                    "content": "[Ticket Saved]" if success else "[Ticket Save Failed]"
                })
                return {"response": "We received your issue. We will contact you shortly."}

            except Exception as tool_err:
                logger.error(f"Tool execution error: {tool_err}")
                return {"response": "We received your issue. We will contact you shortly."}

        # Handle Normal Response
        ai_msg = message.content or "We received your issue. We will contact you shortly."
        SESSION_MEMORY[user_email].append({"role": "assistant", "content": ai_msg})
        
        # Cache the response for future use (only simple queries)
        if latest_user_msg and len(session_history) < 2:
            cache_key = get_cache_key(latest_user_msg)
            set_cached_response(cache_key, ai_msg)
        
        return {"response": ai_msg}

    except Exception as e:
        logger.error(f"Endpoint Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")


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
def complete_order(request: Request, body: CompleteOrderRequest):
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
def validate_coupon(body: ValidateCouponRequest):
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
def admin_grant_access(body: GrantAccessRequest):
    """Manually grants product access to a user (Admin Only)."""
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
def admin_revoke_access(body: RevokeAccessRequest):
    """Manually revokes product access from a user (Admin Only)."""
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        db.collection("users").document(body.uid).collection("purchases").document(body.product_id).delete()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Revoke failed: {e}")
        raise HTTPException(status_code=500, detail="Revoke failed")

@app.patch("/admin/orders/{order_id}")
def admin_update_order(order_id: str, body: UpdateOrderStatusRequest):
    """Updates order status and tracking info (Admin Only)."""
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
def admin_send_notification(body: SendNotificationRequest):
    """Sends a notification to a specific user or all users (Admin Only)."""
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
def admin_block_user(uid: str, blocked: bool):
    """Blocks or unblocks a user (Admin Only)."""
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


# 12. Health Routes
@app.get("/")
def health():
    return {"status": "Support Bot Backend Running"}

@app.get("/uptime")
def uptime_check():
    return "OK"

@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health_check():
    return {"status": "ok"}
