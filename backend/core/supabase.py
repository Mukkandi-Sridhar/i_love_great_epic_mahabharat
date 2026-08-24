"""Supabase client and access-token verification.

The backend talks to Postgres with the **service-role** key, which bypasses
Row Level Security. That is deliberate and is what keeps the security model
from the Firestore work intact: RLS denies clients any write to money or
entitlement tables, and this process is the only writer.

Two consequences follow, and both are enforced here:

* The service-role key never leaves the server. It is not returned by any
  endpoint and is excluded from ``Settings.__repr__``.
* Because RLS is bypassed, *every* query this backend issues must scope by
  ``user_id`` itself. The database will not catch a missing filter.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.core.config import settings


logger = logging.getLogger("ChatbotBackend.supabase")

_client: Any | None = None
_init_attempted = False


def get_supabase() -> Any | None:
    """Return the singleton service-role client, or None when unconfigured."""
    global _client, _init_attempted

    if _client is not None:
        return _client
    if _init_attempted:
        return None

    _init_attempted = True
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase credentials not set; Supabase backend unavailable.")
        return None

    try:
        from supabase import create_client

        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        logger.info("Supabase client initialized")
        return _client
    except Exception as exc:
        logger.warning("Supabase init failed: %s", exc)
        _client = None
        return None


def reset_supabase_client() -> None:
    """Drop the cached client so the next call rebuilds it (used by tests)."""
    global _client, _init_attempted
    _client = None
    _init_attempted = False


class TokenError(Exception):
    """Raised when an access token is missing, malformed, or untrusted."""


def verify_access_token(token: str) -> dict:
    """Verify a Supabase access token and return its claims.

    Supabase signs user access tokens with the project's JWT secret (HS256).
    Verification is strict on purpose:

    * the signature must check out against the project secret;
    * ``exp`` is enforced, so an expired session is rejected;
    * ``aud`` must be ``authenticated``, which rejects anon-role tokens — the
      publishable anon key is itself a valid JWT, and without this check it
      would authenticate as a user;
    * ``sub`` must be present, since it is the user id every query scopes by.

    Raises TokenError on any failure. Callers translate that into a 401.
    """
    token = (token or "").strip()
    if not token:
        raise TokenError("Missing access token")
    if not settings.supabase_jwt_secret:
        # Fail closed: without the secret nothing can be trusted.
        raise TokenError("Token verification is not configured")

    try:
        import jwt
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise TokenError("JWT library unavailable") from exc

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"], "verify_exp": True, "verify_aud": True},
        )
    except Exception as exc:
        raise TokenError(f"Invalid access token: {type(exc).__name__}") from exc

    if not claims.get("sub"):
        raise TokenError("Token has no subject")

    # A token minted for the anon role must never pass as a signed-in user.
    if claims.get("role") not in {"authenticated", None}:
        raise TokenError("Token is not an authenticated user token")

    return claims
