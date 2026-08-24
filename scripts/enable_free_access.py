"""Create/enable the sitewide FREEACCESS coupon (100% off, no cap, no expiry).

The frontend auto-applies this coupon code on every checkout, so every
product is free while it stays enabled. Reversible: disable or delete the
`coupons/FREEACCESS` document in Firestore (or run this script with
--disable) to resume normal pricing — no redeploy needed.

Run from the project root after configuring backend Firebase credentials:
    python scripts/enable_free_access.py            # enable
    python scripts/enable_free_access.py --disable   # disable
"""

from __future__ import annotations

import sys
from pathlib import Path

from firebase_admin import firestore

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.firebase import get_firestore_client

COUPON_CODE = "FREEACCESS"


def main() -> None:
    disable = "--disable" in sys.argv
    db = get_firestore_client()
    if db is None:
        print("Could not connect to Firestore. Check backend Firebase credentials.")
        sys.exit(1)

    ref = db.collection("coupons").document(COUPON_CODE)
    if disable:
        ref.set({"enabled": False, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
        print(f"Disabled {COUPON_CODE}. Checkout resumes normal pricing immediately.")
        return

    ref.set(
        {
            "type": "percent",
            "value": 100,
            "enabled": True,
            "note": "Sitewide free-access promo, auto-applied by the frontend at checkout.",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    print(f"Enabled {COUPON_CODE}: 100% off, no usage cap, no expiry.")
    print("All products are now free at checkout. Run with --disable to revert.")


if __name__ == "__main__":
    main()
