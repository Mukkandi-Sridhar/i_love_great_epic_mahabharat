"""Shared SlowAPI limiter instance."""

import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _real_ip(request: Request) -> str:
    """Prefer the original client IP when the app is behind a trusted proxy."""
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_real_ip)

_uid_windows: dict[str, Deque[float]] = defaultdict(deque)


def check_uid_rate_limit(uid: str, *, limit: int = 20, window_seconds: int = 60) -> None:
    """Apply a lightweight in-process per-user rate limit for chat traffic."""
    uid = (uid or "").strip()
    if not uid:
        return

    now = time.monotonic()
    window_start = now - window_seconds
    events = _uid_windows[uid]
    while events and events[0] < window_start:
        events.popleft()

    if len(events) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    events.append(now)
