"""Firebase Auth dependencies for protected backend routes."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json as _json
import time

from fastapi import HTTPException, Request
from firebase_admin import auth

from backend.core.config import settings
from backend.core.firebase import get_firestore_client


_admin_cache: dict[str, float] = {}
_blocked_cache: dict[str, float] = {}
_token_cache: dict[str, tuple[dict, float]] = {}
_BLOCKED_CACHE_TTL = 300
_BLOCKED_CACHE_MAX = 5000
_TOKEN_CACHE_MAX = 2000


def _evict_oldest(cache: dict, max_size: int) -> None:
    while len(cache) > max_size:
        oldest = next(iter(cache))
        del cache[oldest]


async def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token in a worker thread."""
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = _json.loads(base64.urlsafe_b64decode(payload_b64))
        jti = payload.get("jti") or payload.get("sub", "")
        exp = float(payload.get("exp", 0))
        now = time.time()
        cache_key = f"{jti}:{hashlib.sha256(token.encode('utf-8')).hexdigest()}" if jti else ""

        if cache_key in _token_cache:
            cached_claims, cached_exp = _token_cache[cache_key]
            if cached_exp > now:
                return cached_claims
            del _token_cache[cache_key]
    except Exception:
        jti = ""
        exp = 0
        now = time.time()
        cache_key = ""

    try:
        decoded = await asyncio.to_thread(auth.verify_id_token, token, check_revoked=True)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if cache_key and exp > now:
        ttl = min(exp - now, 1800)
        if len(_token_cache) >= _TOKEN_CACHE_MAX:
            oldest = next(iter(_token_cache))
            del _token_cache[oldest]
        _token_cache[cache_key] = (decoded, now + ttl)

    return decoded


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


async def check_user_not_blocked(uid: str) -> None:
    """Raise 403 if the user is blocked in Firestore."""
    now = time.monotonic()
    cached = _blocked_cache.get(uid)
    if cached is not None and cached > now:
        return

    db = get_firestore_client()
    if db is None:
        return

    def _read() -> bool:
        doc = db.collection("users").document(uid).get()
        return (doc.to_dict() or {}).get("blocked", False) if doc.exists else False

    try:
        is_blocked = await asyncio.to_thread(_read)
        if is_blocked:
            _blocked_cache[uid] = 0
            _evict_oldest(_blocked_cache, _BLOCKED_CACHE_MAX)
            raise HTTPException(status_code=403, detail="Account is blocked")
        _blocked_cache[uid] = now + _BLOCKED_CACHE_TTL
        _evict_oldest(_blocked_cache, _BLOCKED_CACHE_MAX)
    except HTTPException:
        raise
    except Exception:
        pass


def invalidate_blocked_cache(uid: str) -> None:
    """Clear one user's blocked-status cache after an admin status change."""
    _blocked_cache.pop(uid, None)


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

    if len(_admin_cache) > 200:
        expired = [key for key, value in _admin_cache.items() if value <= now]
        if expired:
            for key in expired:
                del _admin_cache[key]
        else:
            oldest = next(iter(_admin_cache))
            del _admin_cache[oldest]

    def _is_admin() -> bool:
        refs = [
            db.collection("admins").document(uid),
            db.collection("users").document(uid),
        ]
        for doc in db.get_all(refs):
            if not doc.exists:
                continue
            if doc.reference.parent.id == "admins":
                return True
            if (doc.to_dict() or {}).get("isAdmin") is True:
                return True
        return False

    if not await asyncio.to_thread(_is_admin):
        raise HTTPException(status_code=403, detail="Not an admin")

    _admin_cache[uid] = now + settings.auth_cache_ttl
    return uid
