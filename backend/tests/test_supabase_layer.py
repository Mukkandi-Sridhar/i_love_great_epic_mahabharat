"""Guards for the Supabase auth and data layer.

The backend queries Postgres with the service-role key, which bypasses Row
Level Security. RLS therefore protects the browser client, not this process —
these tests pin the two properties the server must uphold itself:

  1. Only a genuine, unexpired, authenticated-role token is accepted.
  2. Every user-owned read filters by the caller's id.

No Supabase project or network access is required.
"""

from __future__ import annotations

import asyncio
import dataclasses
import sys
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

jwt = pytest.importorskip("jwt", reason="pyjwt is required for the Supabase auth layer")

from backend.core import supabase as sb
from backend.core.config import settings
from backend.db import supabase_repo as repo


SECRET = "test-jwt-secret-at-least-32-characters-long"


@pytest.fixture(autouse=True)
def configured_secret(monkeypatch):
    monkeypatch.setattr(sb, "settings", dataclasses.replace(settings, supabase_jwt_secret=SECRET))


def make_token(secret: str = SECRET, algorithm: str = "HS256", **overrides) -> str:
    now = int(time.time())
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
        "email": "customer@example.com",
    }
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm=algorithm)


# ── Token verification ───────────────────────────────────────────────────────


def test_valid_token_is_accepted_and_returns_claims():
    claims = sb.verify_access_token(make_token())
    assert claims["sub"] == "11111111-1111-1111-1111-111111111111"
    assert claims["email"] == "customer@example.com"


def test_expired_token_is_rejected():
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(make_token(exp=int(time.time()) - 10))


def test_token_signed_with_another_key_is_rejected():
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(make_token(secret="attacker-supplied-key-32-characters"))


def test_anon_key_cannot_authenticate_as_a_user():
    """Supabase's publishable anon key is itself a valid JWT signed with the
    project secret. Without a role check it would pass as a signed-in user."""
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(make_token(role="anon", sub="anon"))


def test_service_role_token_is_not_accepted_as_a_user():
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(make_token(role="service_role", sub="svc"))


def test_unsigned_token_is_rejected():
    """An alg=none token must never be trusted."""
    forged = jwt.encode({"sub": "u", "aud": "authenticated", "exp": int(time.time()) + 99}, key="", algorithm="none")
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(forged)


@pytest.mark.parametrize("token", ["", "   ", "not.a.jwt", "a.b.c"])
def test_malformed_tokens_are_rejected(token):
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(token)


def test_missing_required_claims_are_rejected():
    now = int(time.time())
    no_exp = jwt.encode({"sub": "u", "aud": "authenticated"}, SECRET, algorithm="HS256")
    no_sub = jwt.encode({"aud": "authenticated", "exp": now + 99}, SECRET, algorithm="HS256")
    for token in (no_exp, no_sub):
        with pytest.raises(sb.TokenError):
            sb.verify_access_token(token)


def test_verification_fails_closed_without_a_configured_secret(monkeypatch):
    monkeypatch.setattr(sb, "settings", dataclasses.replace(settings, supabase_jwt_secret=""))
    with pytest.raises(sb.TokenError):
        sb.verify_access_token(make_token())


# ── Query scoping ────────────────────────────────────────────────────────────


class _RecordingQuery:
    """Captures the filters applied to a PostgREST-style query chain."""

    def __init__(self, table: str, log: list):
        self.table = table
        self.filters: dict = {}
        self._log = log

    def select(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def in_(self, column, value):
        self.filters[column] = value
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def upsert(self, payload, **_k):
        self.payload = payload
        return self

    def execute(self):
        self._log.append((self.table, dict(self.filters)))

        class _Response:
            data: list = []
            count = 0

        return _Response()


class _RecordingClient:
    def __init__(self):
        self.calls: list = []

    def table(self, name):
        return _RecordingQuery(name, self.calls)


@pytest.fixture
def recording_client(monkeypatch):
    client = _RecordingClient()
    monkeypatch.setattr(repo, "get_supabase", lambda: client)
    return client


CALLER = "11111111-1111-1111-1111-111111111111"
OTHER = "22222222-2222-2222-2222-222222222222"


@pytest.mark.parametrize(
    "name,call",
    [
        ("get_orders", lambda: repo.get_orders(CALLER)),
        # Even with an explicit id, the caller filter must remain — otherwise a
        # guessed order id would read another customer's order.
        ("get_orders_by_id", lambda: repo.get_orders(CALLER, order_id="not-mine")),
        ("get_purchases", lambda: repo.get_purchases(CALLER)),
        ("get_transaction", lambda: repo.get_transaction(CALLER, "pay_123")),
        ("get_tickets", lambda: repo.get_tickets(CALLER)),
        ("count_open_tickets", lambda: repo.count_open_tickets(CALLER)),
        ("get_chat_messages", lambda: repo.get_chat_messages(CALLER, "session-1")),
    ],
)
def test_user_owned_reads_filter_by_the_caller(recording_client, name, call):
    asyncio.run(call())
    assert recording_client.calls, f"{name} issued no query"
    for table, filters in recording_client.calls:
        assert CALLER in filters.values(), f"{name} queried {table} without scoping to the caller: {filters}"


def test_identity_lookups_are_scoped(recording_client):
    asyncio.run(repo.is_blocked(CALLER))
    asyncio.run(repo.is_admin(CALLER))
    for table, filters in recording_client.calls:
        assert CALLER in filters.values(), f"{table} was queried unscoped: {filters}"


def test_admin_status_is_never_read_from_the_profile_table(recording_client):
    """A user-editable admin flag was the escalation path removed earlier;
    admin status must come from the `admins` table alone."""
    asyncio.run(repo.is_admin(CALLER))
    tables = {table for table, _ in recording_client.calls}
    assert tables == {"admins"}, f"is_admin consulted unexpected tables: {tables}"


def test_transaction_lookup_cannot_reach_another_users_payment(recording_client):
    asyncio.run(repo.get_transaction(CALLER, "pay_belonging_to_someone_else"))
    _, filters = recording_client.calls[0]
    assert filters.get("user_id") == CALLER
    assert filters.get("id") == "pay_belonging_to_someone_else"
    assert OTHER not in filters.values()


@pytest.mark.parametrize(
    "call",
    [
        lambda: repo.get_orders(""),
        lambda: repo.get_purchases(""),
        lambda: repo.get_tickets(""),
        lambda: repo.get_transaction("", "pay_1"),
        lambda: repo.get_chat_messages("", "session-1"),
    ],
)
def test_missing_caller_id_issues_no_query_at_all(recording_client, call):
    """An empty user id must short-circuit rather than run an unfiltered query
    that would return the whole table under the service role."""
    result = asyncio.run(call())
    assert recording_client.calls == []
    assert result in ([], None, 0)
