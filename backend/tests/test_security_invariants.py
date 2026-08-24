"""Regression guards for the payment and agent-authorization invariants.

These cover the properties that are expensive to get wrong: money computed
from client input, and the chat agent reaching another user's data. They run
without Firebase or OpenAI credentials.

    pytest backend/tests
"""

from __future__ import annotations

import hashlib
import hmac
import sys
from dataclasses import replace
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import main
from backend.agent.brain import _bound_tool_result
from backend.core.config import settings
from backend.main import _coupon_discount_from_snapshot, _verify_razorpay_signature
from backend.mcp.server import _effective_price, _is_broad_product_query, list_tools
from backend.rag.ingest import _chunk_policy_text

from fastapi import HTTPException


# ── Agent authorization ──────────────────────────────────────────────────────
# The model must never choose whose data a tool reads. Identity is injected
# server-side from the verified token, so no tool may accept it as an argument.

IDENTITY_ARGS = {"uid", "user_id", "userId", "email", "name"}


def test_no_tool_accepts_caller_identity_as_an_argument():
    offenders = {
        tool["name"]: sorted(set(tool["parameters"].get("properties", {})) & IDENTITY_ARGS)
        for tool in list_tools()
        if set(tool["parameters"].get("properties", {})) & IDENTITY_ARGS
    }
    assert offenders == {}, (
        f"Tools expose caller identity to the model: {offenders}. "
        "A user could ask the assistant to act on another account."
    )


def test_no_tool_requires_an_identity_argument():
    for tool in list_tools():
        assert not set(tool["parameters"].get("required", [])) & IDENTITY_ARGS


def test_every_tool_declares_a_usable_schema():
    for tool in list_tools():
        params = tool["parameters"]
        assert tool["description"].strip(), f"{tool['name']} has no description"
        assert params["type"] == "object"
        # Anything required must actually be declared as a property.
        assert set(params.get("required", [])) <= set(params.get("properties", {}))


# ── Payment signature verification ───────────────────────────────────────────


def _sign(order_id: str, payment_id: str, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256
    ).hexdigest()


@pytest.fixture
def razorpay_secret(monkeypatch):
    """Point backend.main at a settings copy carrying a known secret.

    Settings is a frozen dataclass, so the module reference is swapped rather
    than the attribute mutated.
    """
    secret = "test_secret_value"
    monkeypatch.setattr(main, "settings", replace(settings, razorpay_key_secret=secret))
    return secret


def test_valid_signature_is_accepted(razorpay_secret):
    _verify_razorpay_signature("order_1", "pay_1", _sign("order_1", "pay_1", razorpay_secret))


def test_forged_signature_is_rejected(razorpay_secret):
    with pytest.raises(HTTPException) as exc:
        _verify_razorpay_signature("order_1", "pay_1", "deadbeef")
    assert exc.value.status_code == 403


def test_signature_from_a_different_order_is_rejected(razorpay_secret):
    """A signature is only valid for the exact order/payment pair it was issued for."""
    stolen = _sign("order_other", "pay_other", razorpay_secret)
    with pytest.raises(HTTPException) as exc:
        _verify_razorpay_signature("order_1", "pay_1", stolen)
    assert exc.value.status_code == 403


@pytest.mark.parametrize(
    "order_id,payment_id,signature",
    [
        (None, "pay_1", "sig"),
        ("order_1", None, "sig"),
        ("order_1", "pay_1", None),
        ("", "", ""),
    ],
)
def test_missing_signature_fields_are_rejected(razorpay_secret, order_id, payment_id, signature):
    with pytest.raises(HTTPException) as exc:
        _verify_razorpay_signature(order_id, payment_id, signature)
    assert exc.value.status_code == 403


def test_verification_fails_closed_when_secret_is_unconfigured(monkeypatch):
    """Without a secret the endpoint must refuse, never skip verification."""
    monkeypatch.setattr(main, "settings", replace(settings, razorpay_key_secret=""))
    with pytest.raises(HTTPException) as exc:
        _verify_razorpay_signature("order_1", "pay_1", "anything")
    assert exc.value.status_code == 503


# ── Credential hygiene ───────────────────────────────────────────────────────


def test_settings_repr_does_not_expose_credentials():
    """A traceback or stray print must not dump live keys into logs."""
    populated = replace(
        settings,
        openai_api_key="sk-proj-CANARY-openai",
        razorpay_key_secret="CANARY-razorpay-secret",
        razorpay_webhook_secret="CANARY-webhook-secret",
        firebase_credentials="CANARY-firebase-json",
    )
    rendered = repr(populated)
    for canary in ("CANARY-openai", "CANARY-razorpay-secret", "CANARY-webhook-secret", "CANARY-firebase-json"):
        assert canary not in rendered, f"{canary} leaked through Settings.__repr__"


# ── Coupon math ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "coupon,price,expected",
    [
        ({"type": "percent", "value": 100}, 1499, 1499),
        ({"type": "percent", "value": 50}, 1000, 500),
        ({"type": "fixed", "value": 200}, 499, 200),
        ({"type": "fixed", "value": 0}, 499, 0),
    ],
)
def test_discount_is_computed_from_the_coupon(coupon, price, expected):
    assert _coupon_discount_from_snapshot(coupon, price) == expected


def test_discount_never_exceeds_the_price():
    """An over-large fixed coupon must not produce a negative total (a refund)."""
    assert _coupon_discount_from_snapshot({"type": "fixed", "value": 99999}, 499) == 499


@pytest.mark.parametrize(
    "coupon",
    [
        {"type": "percent", "value": 100, "enabled": False},
        {"type": "percent", "value": 100, "maxUses": 5, "usedCount": 5},
        {"type": "percent", "value": 100, "maxUses": 5, "usedCount": 9},
    ],
)
def test_unusable_coupons_yield_no_discount(coupon):
    assert _coupon_discount_from_snapshot(coupon, 1000) == 0


def test_expired_coupon_yields_no_discount():
    class _Expired:
        @staticmethod
        def timestamp() -> float:
            return 0.0  # 1970

    assert _coupon_discount_from_snapshot({"type": "percent", "value": 100, "expiresAt": _Expired()}, 1000) == 0


# ── Catalog pricing shown to the assistant ───────────────────────────────────


def test_promo_price_matches_what_checkout_charges():
    assert _effective_price(1499, {"type": "percent", "value": 100}) == 0
    assert _effective_price(1000, {"type": "percent", "value": 50}) == 500


def test_price_is_unchanged_without_an_active_promo():
    assert _effective_price(1499, None) == 1499


def test_effective_price_is_never_negative():
    assert _effective_price(499, {"type": "fixed", "value": 10**6}) == 0


# ── Product query routing ────────────────────────────────────────────────────
# A broad query returns the whole catalog; a specific one runs semantic search.
# Misrouting a specific question wastes tokens and answers with noise.


@pytest.mark.parametrize(
    "query",
    [
        "what products do you have",
        "show me all products",
        "list all your books",
        "what do you sell",
        "your catalog please",
        "everything you offer",
        "show me everything",
    ],
)
def test_catalog_questions_route_to_the_full_listing(query):
    assert _is_broad_product_query(query) is True


@pytest.mark.parametrize(
    "query",
    [
        # Each of these contains a keyword only as a substring — "listen",
        # "playlist" and "offline" all embed "list"/"line".
        "can I listen offline?",
        "I want to listen to Mahabharat in Hindi",
        "do you have an audio playlist",
        "offline access?",
        "which pendrive is best for my father",
        "is the Telugu pendrive in stock",
        "price of the 64GB one",
    ],
)
def test_specific_questions_are_not_misrouted_to_the_full_catalog(query):
    assert _is_broad_product_query(query) is False


# ── Policy retrieval ─────────────────────────────────────────────────────────
# search_policies reports the section a rule came from, so a chunk carrying
# another section's text would attribute the wrong policy to the customer.

POLICY_DOC = """# Knowledge Base

## 1. SHIPPING
- Domestic orders ship in 2 days.

## 2. REFUNDS
### Digital Products:
- Digital sales are final.
### Physical Products:
- Return window is 7 days.

## 3. SUPPORT
- Reply within 24 hours.
"""


def test_every_policy_chunk_is_labelled_with_its_own_section():
    for chunk in _chunk_policy_text(POLICY_DOC):
        headings = {
            line.strip().lstrip("#").strip()
            for line in chunk["text"].splitlines()
            if line.strip().startswith("##") and not line.strip().startswith("###")
        }
        assert headings <= {chunk["section"]}, (
            f"Chunk labelled {chunk['section']!r} contains other sections {headings}"
        )


def test_all_policy_sections_are_represented():
    sections = {chunk["section"] for chunk in _chunk_policy_text(POLICY_DOC)}
    for expected in ("1. SHIPPING", "2. REFUNDS", "3. SUPPORT"):
        assert expected in sections, f"{expected} was dropped from the index"


def test_related_refund_rules_stay_in_one_chunk():
    """Digital and physical refund rules must not be retrieved in isolation."""
    refund = [c for c in _chunk_policy_text(POLICY_DOC) if c["section"] == "2. REFUNDS"]
    assert len(refund) == 1
    assert "Digital sales are final" in refund[0]["text"]
    assert "Return window is 7 days" in refund[0]["text"]


# ── Agent context growth ─────────────────────────────────────────────────────


def test_small_tool_results_are_passed_through_untouched():
    payload = '{"orders": []}'
    assert _bound_tool_result(payload) == payload


def test_large_tool_results_are_capped_and_marked_truncated():
    oversized = '{"purchases": [' + ("x" * 50_000) + "]}"
    bounded = _bound_tool_result(oversized)
    assert len(bounded) < len(oversized)
    assert len(bounded) <= settings.max_tool_result_chars + 64
    # The model must be able to tell the data is partial rather than complete.
    assert "truncated" in bounded
