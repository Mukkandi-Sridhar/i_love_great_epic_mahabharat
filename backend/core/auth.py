"""Firebase Auth dependencies for protected backend routes."""

from __future__ import annotations

import asyncio

from fastapi import HTTPException, Request
from firebase_admin import auth

from backend.core.firebase import get_firestore_client


async def require_admin(request: Request) -> str:
    """Verify a Firebase ID token and require an admin marker in Firestore."""
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        decoded = await asyncio.to_thread(auth.verify_id_token, token)
        uid = decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    def _is_admin() -> bool:
        if db.collection("admins").document(uid).get().exists:
            return True
        user_doc = db.collection("users").document(uid).get()
        return user_doc.exists and (user_doc.to_dict() or {}).get("isAdmin") is True

    if not await asyncio.to_thread(_is_admin):
        raise HTTPException(status_code=403, detail="Not an admin")

    return uid
