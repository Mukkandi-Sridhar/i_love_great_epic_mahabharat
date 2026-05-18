"""Firebase Admin SDK singleton helpers."""

from __future__ import annotations

import json
import logging
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

from .config import settings


logger = logging.getLogger("ChatbotBackend.firebase")
_db: Any | None = None
_initialized = False


def _get_credential() -> credentials.Certificate | None:
    """Build a Firebase credential from a file path or JSON environment value."""
    try:
        service_account_file = settings.firebase_service_account_file
        if service_account_file.exists():
            return credentials.Certificate(str(service_account_file))

        if settings.firebase_credentials:
            return credentials.Certificate(json.loads(settings.firebase_credentials))
    except Exception as exc:
        logger.warning("Firebase credential load failed: %s", exc)
    return None


def init_firebase() -> Any | None:
    """Initialize Firebase Admin once and return a Firestore client if available."""
    global _db, _initialized

    if _db is not None:
        return _db
    if _initialized:
        return None

    _initialized = True
    try:
        try:
            firebase_admin.get_app()
        except ValueError:
            cred = _get_credential()
            if not cred:
                logger.warning("Firebase credentials not found. Database features disabled.")
                return None
            firebase_admin.initialize_app(cred)

        _db = firestore.client()
        logger.info("Firebase initialized successfully")
        return _db
    except Exception as exc:
        logger.warning("Firebase init failed. Database features disabled: %s", exc)
        _db = None
        return None


def get_firestore_client() -> Any | None:
    """Return the singleton Firestore client or None when unavailable."""
    return init_firebase()
