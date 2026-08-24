"""Production readiness check.

Verifies the things that silently break this app: missing credentials, a
stale backend deploy, an unreachable database, a missing promo coupon, and
CORS that would block the real frontend in the browser.

    python scripts/preflight.py                     # local config + live API
    python scripts/preflight.py --url https://...   # check a specific backend

Exit code is 0 when every required check passes, 1 otherwise, so it can gate
a deploy.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

OK = "PASS"
WARN = "WARN"
FAIL = "FAIL"

# Routes the frontend depends on. A deploy missing any of these has shipped
# stale code, which is exactly how checkout broke without an error anywhere.
REQUIRED_ROUTES = [
    "/chat",
    "/chat/stream",
    "/chat/history",
    "/validate-coupon",
    "/create-razorpay-order",
    "/complete-order",
    "/webhook/razorpay",
    "/admin/grant-access",
]

results: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    results.append((status, name, detail))


def _get(url: str, timeout: int = 20) -> tuple[int, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "ilgem-preflight"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, b""
    except Exception:
        return 0, b""


def check_local_config() -> None:
    """Confirm the backend has the settings it needs to serve real traffic."""
    try:
        from backend.core.config import settings
    except Exception as exc:
        record(FAIL, "backend config imports", str(exc)[:120])
        return

    record(OK, "backend config imports")

    required = {
        "OPENAI_API_KEY": settings.openai_api_key,
        "RAZORPAY_KEY_ID": settings.razorpay_key_id,
        "RAZORPAY_KEY_SECRET": settings.razorpay_key_secret,
        "RAZORPAY_WEBHOOK_SECRET": settings.razorpay_webhook_secret,
    }
    for name, value in required.items():
        if value:
            record(OK, f"{name} set")
        else:
            hint = {
                "RAZORPAY_KEY_SECRET": "payments fail closed with 503",
                "RAZORPAY_WEBHOOK_SECRET": "webhook events are ignored",
                "OPENAI_API_KEY": "the assistant cannot answer",
            }.get(name, "")
            record(FAIL, f"{name} set", hint)

    has_credential_file = settings.firebase_service_account_file.exists()
    if has_credential_file or settings.firebase_credentials:
        record(OK, "Firebase credentials present")
    else:
        record(FAIL, "Firebase credentials present", "no key file and FIREBASE_CREDENTIALS unset")

    origins = settings.cors_origin_list
    non_local = [o for o in origins if "localhost" not in o and "127.0.0.1" not in o]
    if non_local:
        record(OK, "CORS allows a deployed origin", ", ".join(non_local[:3]))
    else:
        record(
            FAIL if settings.app_env == "production" else WARN,
            "CORS allows a deployed origin",
            "localhost only — the browser will block the live frontend",
        )

    if settings.app_env == "production" and settings.allow_payment_bypass:
        record(FAIL, "payment bypass disabled in production", "ALLOW_PAYMENT_BYPASS is on")
    else:
        record(OK, "payment bypass disabled in production")


def check_database() -> None:
    """Confirm Firestore actually answers, and that the promo exists."""
    try:
        from backend.core.firebase import get_firestore_client
    except Exception as exc:
        record(FAIL, "database reachable", str(exc)[:120])
        return

    db = get_firestore_client()
    if db is None:
        record(FAIL, "database reachable", "client could not be created")
        return

    try:
        products = list(db.collection("products").limit(5).stream())
    except Exception as exc:
        # A revoked service-account key surfaces here as invalid_grant.
        record(FAIL, "database reachable", str(exc)[:140])
        return

    record(OK, "database reachable", f"{len(products)} product(s) sampled")

    if not products:
        record(WARN, "catalog populated", "no products — run scripts/seed_products.py")
    else:
        record(OK, "catalog populated")

    try:
        coupon = db.collection("coupons").document("FREEACCESS").get()
    except Exception as exc:
        record(WARN, "FREEACCESS promo", str(exc)[:100])
        return

    if not coupon.exists:
        record(WARN, "FREEACCESS promo", "missing — run scripts/enable_free_access.py")
        return

    data = coupon.to_dict() or {}
    if data.get("enabled", True) and float(data.get("value", 0)) >= 100 and data.get("type") == "percent":
        record(OK, "FREEACCESS promo", "enabled at 100% — books are free")
    elif not data.get("enabled", True):
        record(WARN, "FREEACCESS promo", "exists but disabled — normal pricing applies")
    else:
        record(WARN, "FREEACCESS promo", f"type={data.get('type')} value={data.get('value')}")


def check_live_backend(base_url: str) -> None:
    """Confirm the deployed service is current, not a stale build."""
    base_url = base_url.rstrip("/")

    status, _ = _get(f"{base_url}/health")
    if status != 200:
        record(FAIL, "backend responds", f"{base_url}/health returned {status or 'no response'}")
        return
    record(OK, "backend responds", base_url)

    status, body = _get(f"{base_url}/openapi.json")
    if status != 200 or not body:
        record(WARN, "backend routes readable", f"openapi.json returned {status}")
        return

    try:
        deployed = set(json.loads(body).get("paths", {}))
    except Exception:
        record(WARN, "backend routes readable", "openapi.json was not valid JSON")
        return

    missing = [route for route in REQUIRED_ROUTES if route not in deployed]
    if missing:
        record(
            FAIL,
            "deployed build is current",
            f"{len(missing)} route(s) missing, e.g. {', '.join(missing[:3])} — redeploy",
        )
    else:
        record(OK, "deployed build is current", f"{len(deployed)} routes")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="https://ilgem-backend-y0m3.onrender.com", help="backend base URL")
    parser.add_argument("--skip-live", action="store_true", help="only check local config and database")
    parser.add_argument("--skip-db", action="store_true", help="skip the database checks")
    args = parser.parse_args()

    print("Preflight\n")

    check_local_config()
    if not args.skip_db:
        check_database()
    if not args.skip_live:
        check_live_backend(args.url)

    width = max(len(name) for _, name, _ in results)
    for status, name, detail in results:
        line = f"  [{status}] {name.ljust(width)}"
        if detail:
            line += f"  {detail}"
        print(line)

    failures = sum(1 for status, _, _ in results if status == FAIL)
    warnings = sum(1 for status, _, _ in results if status == WARN)
    print(f"\n{len(results) - failures - warnings} passed, {warnings} warning(s), {failures} failure(s)")

    if failures:
        print("\nNot ready to serve traffic. Address the FAIL rows above.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
