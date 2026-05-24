"""Chat API endpoint for the Dharma support agent."""

import asyncio
import json
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import StreamingResponse
from firebase_admin import firestore
from pydantic import BaseModel, field_validator

from backend.agent.brain import _TOOL_COUNT, run_agent, run_agent_streaming
from backend.agent.memory import append_fallback_turns, get_history, get_user_context
from backend.core.auth import check_user_not_blocked, verify_request_uid
from backend.core.config import settings
from backend.core.firebase import get_firestore_client
from backend.core.rate_limit import check_uid_rate_limit, limiter


logger = logging.getLogger("ChatbotBackend.api.chat")
router = APIRouter()


class MessageInput(BaseModel):
    """Backward-compatible message shape accepted from older clients."""

    role: str
    content: str


class ChatRequestBody(BaseModel):
    """Request body for the enterprise chat endpoint."""

    message: Optional[str] = None
    uid: str = ""
    email: str = ""
    name: Optional[str] = None
    session_id: Optional[str] = None
    messages: Optional[list[MessageInput]] = None

    @field_validator("uid", mode="before")
    @classmethod
    def uid_must_not_be_whitespace(cls, v):
        """Normalize uid input before endpoint auth checks."""
        return "" if v is None else str(v).strip()


def _latest_message(body: ChatRequestBody) -> str:
    """Extract the latest user message from the new or legacy payload."""
    if body.message and body.message.strip():
        return body.message.strip()
    for item in reversed(body.messages or []):
        if item.role == "user" and item.content.strip():
            return item.content.strip()
    return ""


def _save_chat_messages_task(uid: str, session_id: str, user_message: str, assistant_message: str, tools_called: list[str]) -> None:
    """Persist chat messages in the customer-visible messages collection."""
    if not uid or not session_id:
        return

    db = get_firestore_client()
    if db is None:
        append_fallback_turns(
            uid,
            session_id,
            [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": assistant_message},
            ],
        )
        return

    def _save() -> None:
        session_ref = db.collection("users").document(uid).collection("chat_sessions").document(session_id)
        session_ref.set({"updatedAt": firestore.SERVER_TIMESTAMP, "uid": uid}, merge=True)
        batch = db.batch()
        user_ref = session_ref.collection("messages").document()
        assistant_ref = session_ref.collection("messages").document()
        batch.set(
            user_ref,
            {
                "role": "user",
                "content": user_message,
                "timestamp": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.set(
            assistant_ref,
            {
                "role": "assistant",
                "content": assistant_message,
                "tools_called": tools_called,
                "timestamp": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.commit()

    def _log_failure(task: asyncio.Task) -> None:
        try:
            exc = task.exception()
        except asyncio.CancelledError:
            return
        if exc:
            logger.warning("Background save failed: %s", exc)

    task = asyncio.create_task(asyncio.to_thread(_save))
    task.add_done_callback(_log_failure)


@router.post("/chat")
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, body: ChatRequestBody = Body(...)) -> dict:
    """Run the Dharma agent and return a friendly response with a session id."""
    message = _latest_message(body)
    session_id = body.session_id or str(uuid4())
    if not message:
        return {"response": "Please send a message so I can help.", "session_id": session_id}
    if not body.uid:
        return {"response": "Authentication required.", "session_id": session_id}

    try:
        await verify_request_uid(request, body.uid, required=True)
        await check_user_not_blocked(body.uid)
        check_uid_rate_limit(body.uid)
        history, user_context = await asyncio.gather(
            get_history(body.uid, session_id, limit=10),
            get_user_context(body.uid),
        )
        agent_result = await run_agent(
            message=message,
            uid=body.uid,
            email=body.email,
            name=body.name or (body.email.split("@")[0] if body.email else "there"),
            session_id=session_id,
            history=history,
            user_context=user_context,
        )
        response = agent_result["response"]
        _save_chat_messages_task(body.uid, session_id, message, response, agent_result.get("tools_called", []))
        return {
            "response": response,
            "session_id": session_id,
            "metadata": {
                "model": settings.openai_chat_model,
                "toolsAvailable": _TOOL_COUNT,
                "toolsCalled": agent_result["tools_called"],
                "toolCount": agent_result["tool_count"],
                "cached": False,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Chat endpoint failed gracefully: %s", exc)
        return {
            "response": "Sorry, I'm having trouble connecting. Please try again.",
            "session_id": session_id,
        }


def _sse_event(event: dict) -> str:
    """Serialize a dictionary as one server-sent event data frame."""
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream_endpoint(request: Request, body: ChatRequestBody = Body(...)) -> StreamingResponse:
    """Stream agent status/tool events and the final Dharma response."""
    message = _latest_message(body)
    session_id = body.session_id or str(uuid4())

    async def event_stream():
        if not message:
            yield _sse_event({"type": "done", "response": "Please send a message so I can help.", "session_id": session_id})
            return
        if not body.uid:
            yield _sse_event({"type": "done", "response": "Authentication required.", "session_id": session_id})
            return

        final_response = "Sorry, I'm having trouble connecting. Please try again."
        tools_called: list[str] = []
        try:
            await verify_request_uid(request, body.uid, required=True)
            await check_user_not_blocked(body.uid)
            check_uid_rate_limit(body.uid)
            history, user_context = await asyncio.gather(
                get_history(body.uid, session_id, limit=10),
                get_user_context(body.uid),
            )

            async for event in run_agent_streaming(
                message=message,
                uid=body.uid,
                email=body.email,
                name=body.name or (body.email.split("@")[0] if body.email else "there"),
                session_id=session_id,
                history=history,
                user_context=user_context,
            ):
                if event.get("type") == "done":
                    final_response = event.get("response") or final_response
                    tools_called = event.get("tools_called", [])
                    event["session_id"] = session_id
                yield _sse_event(event)

            _save_chat_messages_task(body.uid, session_id, message, final_response, tools_called)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
            yield _sse_event({"type": "error", "message": detail})
            yield _sse_event({"type": "done", "response": detail, "session_id": session_id})
        except Exception as exc:
            logger.warning("Chat stream failed gracefully: %s", exc)
            yield _sse_event({"type": "error", "message": "Sorry, I'm having trouble connecting. Please try again."})
            yield _sse_event({"type": "done", "response": final_response, "session_id": session_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
