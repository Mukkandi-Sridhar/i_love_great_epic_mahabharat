"""Firebase Auth dependencies for protected backend routes."""

from __future__ import annotations

import asyncio
import time

from fastapi import HTTPException, Request
from firebase_admin import auth

from backend.core.config import settings
from backend.core.firebase import get_firestore_client


_admin_cache: dict[str, float] = {}


async def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token in a worker thread."""
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")
    try:
        return await asyncio.to_thread(auth.verify_id_token, token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def verify_request_uid(request: Request, uid: str, *, required: bool = False) -> dict | None:
    """Verify an optional bearer token and ensure it matches the requested uid."""
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Missing auth token")
        return None

    decoded = await verify_firebase_token(token)
    if decoded.get("uid") != uid:
        raise HTTPException(status_code=403, detail="UID mismatch")
    return decoded


async def require_admin(request: Request) -> str:
    """Verify a Firebase ID token and require an admin marker in Firestore."""
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    decoded = await verify_firebase_token(token)
    uid = decoded["uid"]
    now = time.monotonic()
    if _admin_cache.get(uid, 0) > now:
        return uid

    def _is_admin() -> bool:
        if db.collection("admins").document(uid).get().exists:
            return True
        user_doc = db.collection("users").document(uid).get()
        return user_doc.exists and (user_doc.to_dict() or {}).get("isAdmin") is True

    if not await asyncio.to_thread(_is_admin):
        raise HTTPException(status_code=403, detail="Not an admin")

    _admin_cache[uid] = now + settings.auth_cache_ttl
    return uid
