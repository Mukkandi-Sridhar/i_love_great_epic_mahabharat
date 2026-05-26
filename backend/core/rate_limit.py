"""Shared SlowAPI limiter instance.

UID windows are in-process only. Multi-worker deployments enforce per-user
limits independently in each worker unless replaced with distributed storage.
"""

import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address


RATE_LIMIT_SINGLE_INSTANCE_WARNING = (
    "UID rate limiting is in-process only. Multi-worker deployments enforce "
    "limits independently per worker; use Redis for distributed limits."
)


def _real_ip(request: Request) -> str:
    """Prefer the original client IP when the app is behind a trusted proxy."""
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_real_ip)

# NOTE: _uid_windows is in-process only. In multi-worker deployments each worker
# enforces the limit independently, making the effective limit N x limit per worker.
# For true distributed rate limiting, replace this with a Redis-backed counter.
_uid_windows: dict[str, Deque[float]] = defaultdict(deque)
_MAX_UID_WINDOWS = 10_000


def _evict_oldest(cache: dict, max_size: int) -> None:
    while len(cache) > max_size:
        oldest = next(iter(cache))
        del cache[oldest]


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

    if len(_uid_windows) > _MAX_UID_WINDOWS:
        _evict_oldest(_uid_windows, _MAX_UID_WINDOWS)
