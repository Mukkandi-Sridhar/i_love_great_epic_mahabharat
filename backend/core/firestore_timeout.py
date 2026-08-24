"""Bounded deadlines for Firestore calls.

The Firestore client's default retry deadline is 300 seconds. A revoked
credential or a transient outage therefore does not fail — it *hangs*, and
every blocked call holds a worker in the shared executor. With a 40-worker
pool, forty such requests stall the whole API while ``/health`` keeps
answering 200, so the service looks up while nothing works.

This was observed directly: after the service-account key was revoked, a
single ``products`` read took the full 300s before surfacing
``invalid_grant``.

Passing an explicit ``timeout`` makes the underlying gRPC call give up early,
so the request fails fast, the worker is returned to the pool, and the caller
gets a normal error response instead of hanging.
"""

from __future__ import annotations

from backend.core.config import settings


# Reads on the request path. Long enough for a slow-but-healthy round trip,
# short enough that a stuck call cannot occupy a worker for minutes.
READ_TIMEOUT = float(settings.firestore_timeout)

# Writes that commit a batch (orders, purchases, tickets) are given more room:
# giving up on a commit that may already have been applied is worse than
# waiting a little longer for confirmation.
WRITE_TIMEOUT = READ_TIMEOUT * 2
