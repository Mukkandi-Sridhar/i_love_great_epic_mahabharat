"""Chat API endpoint for the Dharma support agent."""

import asyncio
import json
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.agent.brain import run_agent, run_agent_streaming
from backend.agent.memory import get_history, get_user_context, save_turn
from backend.core.config import settings
from backend.core.rate_limit import limiter


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


def _latest_message(body: ChatRequestBody) -> str:
    """Extract the latest user message from the new or legacy payload."""
    if body.message and body.message.strip():
        return body.message.strip()
    for item in reversed(body.messages or []):
        if item.role == "user" and item.content.strip():
            return item.content.strip()
    return ""


@router.post("/chat")
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, body: ChatRequestBody = Body(...)) -> dict:
    """Run the Dharma agent and return a friendly response with a session id."""
    message = _latest_message(body)
    session_id = body.session_id or str(uuid4())
    if not message:
        return {"response": "Please send a message so I can help.", "session_id": session_id}

    try:
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
        await asyncio.gather(
            save_turn(body.uid, session_id, "user", message),
            save_turn(body.uid, session_id, "assistant", response),
        )
        return {
            "response": response,
            "session_id": session_id,
            "metadata": {
                "model": settings.openai_chat_model,
                "toolsAvailable": 8,
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

        final_response = "Sorry, I'm having trouble connecting. Please try again."
        try:
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
                    event["session_id"] = session_id
                yield _sse_event(event)

            await asyncio.gather(
                save_turn(body.uid, session_id, "user", message),
                save_turn(body.uid, session_id, "assistant", final_response),
            )
        except Exception as exc:
            logger.warning("Chat stream failed gracefully: %s", exc)
            yield _sse_event({"type": "error", "message": "Sorry, I'm having trouble connecting. Please try again."})
            yield _sse_event({"type": "done", "response": final_response, "session_id": session_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
