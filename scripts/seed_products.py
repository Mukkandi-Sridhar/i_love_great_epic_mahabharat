"""Seed Firestore /products with the current fallback catalog.

Run from the project root after configuring backend Firebase credentials:
    python scripts/seed_products.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from firebase_admin import firestore

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.firebase import get_firestore_client


PRODUCTS = [
    {
        "id": "ebook-1",
        "image": "product-1.png",
        "title": "Vijnana Bhairava Tantra (Ebook)",
        "subtitle": "Complete Digital Edition - English",
        "rating": 4.9,
        "reviewCount": 1247,
        "price": 499,
        "originalPrice": 999,
        "tag": "Bestseller",
        "type": "ebook",
        "language": "English",
        "totalSales": 1200,
        "description": "A profound exploration of the Vijnana Bhairava Tantra with 112 meditation techniques.",
        "highlights": [
            {"icon": "book", "text": "112 Meditation Techniques"},
            {"icon": "language", "text": "Sanskrit + English"},
            {"icon": "download", "text": "Instant PDF Download"},
            {"icon": "clock", "text": "Lifetime Access"},
        ],
        "driveLink": "https://drive.google.com/file/d/example-ebook-link/view",
        "isPhysical": False,
        "stockCount": 999,
    },
    {
        "id": "ebook-2",
        "image": "ebook-2.jpeg",
        "title": "Mahabharatam (Complete Telugu Edition)",
        "subtitle": "18 Parvas - Simple Telugu - Digital",
        "rating": 5.0,
        "reviewCount": 42,
        "price": 299,
        "originalPrice": 599,
        "tag": "New Arrival",
        "type": "ebook",
        "language": "Telugu",
        "totalSales": 150,
        "description": "Complete digital Telugu edition covering all 18 Parvas.",
        "highlights": [
            {"icon": "book", "text": "All 18 Parvas Included"},
            {"icon": "language", "text": "Simple Modern Telugu"},
            {"icon": "mobile", "text": "Mobile Optimized PDF"},
            {"icon": "download", "text": "Instant Download"},
        ],
        "isPhysical": False,
        "stockCount": 999,
    },
    {
        "id": "pd-1",
        "image": "pendrive 1.jpeg",
        "title": "Sri Mahabharatam (Telugu - Complete)",
        "subtitle": "All Main Episodes - Crystal Clear Audio",
        "rating": 4.9,
        "reviewCount": 342,
        "price": 1499,
        "originalPrice": 2999,
        "tag": "Bestseller",
        "type": "pendrive",
        "language": "Telugu",
        "totalSales": 890,
        "description": "Complete Sri Mahabharatam in Telugu on 32GB pendrive.",
        "highlights": [
            {"icon": "usb", "text": "32GB Sandisk Drive"},
            {"icon": "audio", "text": "Complete Series"},
            {"icon": "language", "text": "Pure Telugu"},
            {"icon": "gift", "text": "Free OTG Adapter"},
        ],
        "isPhysical": True,
        "stockCount": 45,
    },
    {
        "id": "pd-2",
        "image": "pendrive 2.jpeg",
        "title": "Sri Mahabharatam (Telugu - Unseen)",
        "subtitle": "Rare & Untold Stories - Deep Wisdom",
        "rating": 4.8,
        "reviewCount": 156,
        "price": 1299,
        "originalPrice": 2499,
        "tag": "Exclusive",
        "type": "pendrive",
        "language": "Telugu",
        "totalSales": 420,
        "description": "Rare and unseen Telugu Mahabharatam stories on 16GB pendrive.",
        "highlights": [
            {"icon": "usb", "text": "16GB Metal Drive"},
            {"icon": "eye", "text": "Rare Episodes"},
            {"icon": "star", "text": "Untold Stories"},
            {"icon": "audio", "text": "HD Audio"},
        ],
        "isPhysical": True,
        "stockCount": 22,
    },
    {
        "id": "pd-3",
        "image": "pendrive 3.jpeg",
        "title": "Sri Mahabharatam (Telugu - Ultimate)",
        "subtitle": "Complete + Unseen Episodes - 64GB",
        "rating": 5.0,
        "reviewCount": 520,
        "price": 1999,
        "originalPrice": 3999,
        "tag": "Premium Choice",
        "type": "pendrive",
        "language": "Telugu",
        "totalSales": 650,
        "description": "Ultimate collection with complete and unseen episodes on 64GB pendrive.",
        "highlights": [
            {"icon": "usb", "text": "64GB Premium Drive"},
            {"icon": "collection", "text": "All + Unseen Pack"},
            {"icon": "value", "text": "Best Value"},
            {"icon": "gift", "text": "Free OTG Cable"},
        ],
        "isPhysical": True,
        "stockCount": 15,
    },
    {
        "id": "pd-4",
        "image": "pendrive 4.jpeg",
        "title": "Sri Mahabharat (Hindi - Complete)",
        "subtitle": "Full Series - Hindi Narration",
        "rating": 4.9,
        "reviewCount": 210,
        "price": 1499,
        "originalPrice": 2999,
        "tag": "Hindi Edition",
        "type": "pendrive",
        "language": "Hindi",
        "totalSales": 310,
        "description": "Complete Sri Mahabharat narration in Hindi on 32GB pendrive.",
        "highlights": [
            {"icon": "usb", "text": "32GB Metal Drive"},
            {"icon": "language", "text": "Shuddh Hindi"},
            {"icon": "audio", "text": "Studio Quality"},
            {"icon": "plug", "text": "Plug & Play"},
        ],
        "isPhysical": True,
        "stockCount": 30,
    },
]


def main() -> None:
    """Write product documents with merge=True so manual admin edits survive."""
    db = get_firestore_client()
    if db is None:
        raise SystemExit("Firestore is unavailable. Check backend Firebase credentials.")

    batch = db.batch()
    for product in PRODUCTS:
        product_id = product["id"]
        batch.set(
            db.collection("products").document(product_id),
            {**product, "updatedAt": firestore.SERVER_TIMESTAMP},
            merge=True,
        )
    batch.commit()
    print(f"Seeded {len(PRODUCTS)} products into /products.")


if __name__ == "__main__":
    main()
