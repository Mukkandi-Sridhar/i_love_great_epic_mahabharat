"""Behavioural tests for /complete-order and /validate-coupon on the free path.

A small in-memory stand-in for Firestore replaces the real client, so these run
without credentials. Only the operations the endpoints use are implemented.
"""

from __future__ import annotations

import itertools
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from backend import main
from backend.core.rate_limit import limiter

_ids = itertools.count(1)


class _Snap:
    def __init__(self, ref, data):
        self.reference = ref
        self.id = ref.id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class _Doc:
    def __init__(self, store, path):
        self._store = store
        self.path = path
        self.id = path.rsplit("/", 1)[-1]

    def collection(self, name):
        return _Col(self._store, f"{self.path}/{name}")

    def get(self, timeout=None, transaction=None):
        return _Snap(self, self._store.get(self.path))

    def set(self, data, merge=False):
        self._store.write(self.path, data, merge)


class _Col:
    def __init__(self, store, path):
        self._store = store
        self.path = path

    def document(self, doc_id=None):
        return _Doc(self._store, f"{self.path}/{doc_id or f'auto{next(_ids)}'}")


class _Batch:
    def __init__(self, store, immediate=False):
        self._store = store
        self._ops = []
        self._immediate = immediate

    def set(self, ref, data, merge=False):
        self._ops.append((ref.path, data, merge, False))
        if self._immediate:
            self.commit()

    def update(self, ref, data):
        self._ops.append((ref.path, data, True, True))
        if self._immediate:
            self.commit()

    def commit(self):
        for path, data, merge, must_exist in self._ops:
            if must_exist and self._store.get(path) is None:
                raise RuntimeError(f"update on missing document {path}")
            self._store.write(path, data, merge)
        self._ops = []


class _Increment:
    def __init__(self, value):
        self.value = value


class FakeFirestore:
    def __init__(self):
        self.docs: dict[str, dict] = {}

    def get(self, path):
        return self.docs.get(path)

    def write(self, path, data, merge):
        current = dict(self.docs.get(path) or {}) if merge else {}
        for key, value in data.items():
            if isinstance(value, _Increment):
                value = (current.get(key) or 0) + value.value
            current[key] = value
        self.docs[path] = current

    def collection(self, name):
        return _Col(self, name)

    def batch(self):
        return _Batch(self)

    def transaction(self):
        # Writes apply immediately; the endpoints only need set/update here.
        return _Batch(self, immediate=True)


@pytest.fixture
def db(monkeypatch):
    fake = FakeFirestore()
    fake.docs["products/pd1"] = {"title": "Pendrive", "type": "pendrive", "price": 999, "stockCount": 5}
    fake.docs["coupons/FREEACCESS"] = {"type": "percent", "value": 100, "enabled": True, "usedCount": 0}

    async def _verified(request, uid, required=False):
        return {"uid": uid}

    monkeypatch.setattr(main, "get_firestore_client", lambda: fake)
    monkeypatch.setattr(main, "verify_request_uid", _verified)
    monkeypatch.setattr(main.firestore, "transactional", lambda fn: fn)
    monkeypatch.setattr(main.firestore, "Increment", _Increment)
    limiter.enabled = False
    yield fake
    limiter.enabled = True


@pytest.fixture
def client():
    return TestClient(main.app)


def _claim_free(client, uid="u1"):
    order = client.post(
        "/create-razorpay-order",
        json={"uid": uid, "product_id": "pd1", "coupon_code": "FREEACCESS"},
    )
    assert order.status_code == 200, order.text
    assert order.json()["free"] is True
    return client.post(
        "/complete-order",
        json={
            "uid": uid, "email": "a@b.c", "phone": "9999999999",
            "product_type": "pendrive", "product_id": "pd1", "base_price": 0,
            "razorpay_order_id": order.json()["order_id"],
        },
    )


def test_free_claim_grants_access_and_counts_the_coupon(db, client):
    res = _claim_free(client)
    assert res.status_code == 200, res.text
    assert db.docs["users/u1/purchases/pd1"]["status"] == "active"
    assert db.docs["products/pd1"]["stockCount"] == 4
    assert db.docs["coupons/FREEACCESS"]["usedCount"] == 1


def test_same_account_cannot_claim_a_free_product_twice(db, client):
    assert _claim_free(client).status_code == 200
    again = _claim_free(client)
    assert again.status_code == 409
    assert db.docs["products/pd1"]["stockCount"] == 4, "second free claim drained stock"


def test_other_accounts_can_still_claim(db, client):
    assert _claim_free(client, "u1").status_code == 200
    assert _claim_free(client, "u2").status_code == 200
    assert db.docs["coupons/FREEACCESS"]["usedCount"] == 2


def test_coupon_max_uses_is_enforced_on_the_intent_path(db, client):
    db.docs["coupons/FREEACCESS"].update({"maxUses": 1})
    assert _claim_free(client, "u1").status_code == 200
    order = client.post(
        "/create-razorpay-order",
        json={"uid": "u2", "product_id": "pd1", "coupon_code": "FREEACCESS"},
    )
    # Exhausted: no discount, so this is a paid order, not a free one.
    assert order.status_code != 200 or order.json()["free"] is False


@pytest.mark.parametrize("code", ["BAD/CODE", "", "x" * 65])
def test_malformed_coupon_codes_are_rejected_cleanly(db, client, code):
    res = client.post("/validate-coupon", json={"code": code, "amount": 100})
    assert res.status_code == 422


def test_fixed_coupon_discount_is_capped_at_the_amount(db, client):
    db.docs["coupons/BIG"] = {"type": "fixed", "value": 500, "enabled": True}
    res = client.post("/validate-coupon", json={"code": "big", "amount": 100})
    assert res.status_code == 200
    assert res.json()["discount"] == 100
    assert res.json()["final_amount"] == 0
