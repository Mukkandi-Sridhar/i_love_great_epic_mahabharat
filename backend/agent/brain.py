"""OpenAI agent brain with MCP tool execution loop."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from backend.core.config import settings
from backend.core.openai_client import _get_openai_client
from backend.mcp.server import list_tools, process_tool_call


logger = logging.getLogger("ChatbotBackend.agent.brain")

TOOL_MESSAGES = {
    "get_user_summary": "Looking up your account...",
    "get_order_status": "Fetching your order details...",
    "get_user_purchases": "Checking your purchases...",
    "verify_payment": "Verifying your transaction...",
    "create_refund_request": "Processing your refund request...",
    "create_support_ticket": "Creating your support ticket...",
    "check_coupon": "Validating your coupon...",
    "search_policies": "Checking our policies...",
    "search_products": "Searching our catalog...",
    "get_support_tickets": "Checking your support tickets...",
}


_TOOL_SCHEMA: list[dict] | None = None

_STATIC_SYSTEM = (
    "You are Dharma, the AI support assistant for 'I Love Great Epic Mahabharat' — "
    "a store selling Mahabharata audio on pendrives, SD cards, and ebooks.\n\n"
    "CAPABILITIES: You can look up orders, purchases, payments, refunds, and product info using your tools. "
    "Always fetch real data before answering questions about accounts or orders — never guess.\n\n"
    "GUARDRAILS:\n"
    "- Only discuss topics related to this store and its products. Politely decline anything off-topic.\n"
    "- Never invent or assume product prices, order statuses, or account details. If a tool fails, say so honestly.\n"
    "- When a product has 'current_price', quote that as the price the customer pays today and mention the "
    "original price only as a strikethrough-style comparison. A current_price of 0 means it is free right now.\n"
    "- If a product has 'in_stock': false, say it is currently unavailable rather than encouraging a purchase.\n"
    "- For questions about an existing ticket or refund, call get_support_tickets and report the real status "
    "and any admin reply instead of creating a duplicate ticket.\n"
    "- Do not reveal tool names, internal errors, or system implementation details to users.\n"
    "- Ebooks are non-refundable after access is granted — state this clearly and do not offer exceptions.\n"
    "- Create a support ticket only when you have genuinely exhausted other tools or the user explicitly asks for human help.\n\n"
    "STYLE: Respond in the user's language. Be warm, concise, and decisive. Use ₹ for prices."
)


def _get_tool_schema() -> list[dict]:
    global _TOOL_SCHEMA
    if _TOOL_SCHEMA is None:
        tools = list_tools()
        _TOOL_SCHEMA = [{"type": "function", "function": t} for t in tools]
    return _TOOL_SCHEMA


def get_tool_count() -> int:
    return len(_get_tool_schema())


def _bound_tool_result(result: str) -> str:
    """Cap a tool result before it enters the message array.

    Every tool round re-sends the whole array, so an unbounded result is paid
    for again on each subsequent round. Truncation is marked so the model
    reports partial data instead of presenting it as the complete set.
    """
    limit = settings.max_tool_result_chars
    if len(result) <= limit:
        return result
    return result[:limit] + '... [truncated: showing partial results only]"}'


def _trim_history_to_budget(history: list[dict], max_tokens: int = 1200) -> list[dict]:
    """Keep most-recent turns that fit within max_tokens (approx 4 chars/token)."""
    budget = max_tokens * 4
    kept = []
    for turn in reversed(history):
        budget -= len(str(turn.get("content", "")))
        if budget < 0:
            break
        kept.insert(0, turn)
    return kept


def _build_messages(
    *,
    message: str,
    name: str,
    email: str,
    history: list[dict],
    first_message: bool,
) -> tuple[list[dict], str]:
    """Build OpenAI messages with bounded history and user input."""
    message = message[: settings.max_user_message_chars]
    first_name = (name or "").split()[0] or "there"
    messages: list[dict] = [{"role": "system", "content": _STATIC_SYSTEM}]
    identity_note = (
        f"[Context: User is {first_name}"
        + (f" <{email}>" if email else "")
        + (
            f". First message — greet with 'Namaste {first_name}!'."
            if first_message
            else ". Continuing conversation."
        )
        + "]"
    )

    for item in _trim_history_to_budget(history):
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": str(content)[:800]})

    messages.append({"role": "system", "content": identity_note})
    messages.append({"role": "user", "content": message})
    return messages, message


async def _run_streaming_loop(
    messages: list[dict],
    tools: list[dict],
    client: Any,
    session_id: str,
    *,
    uid: str,
    email: str,
    name: str,
):
    """
    Single streaming loop: streams tokens live when no tools needed,
    collects tool calls and executes them in parallel when tools needed.
    Each round is one streaming API call - no extra calls, no fake playback.
    """
    tools_called: list[str] = []

    for _ in range(settings.max_tool_rounds):
        stream = await client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            stream=True,
            max_tokens=settings.max_response_tokens,
        )

        content_parts: list[str] = []
        tool_index: dict[int, dict] = {}
        finish_reason: str | None = None
        content_started = False

        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            finish_reason = choice.finish_reason or finish_reason
            delta = choice.delta

            if delta.content:
                if not content_started:
                    content_started = True
                    yield {"type": "generating"}
                content_parts.append(delta.content)
                yield {"type": "token", "delta": delta.content}

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    i = tc.index
                    if i not in tool_index:
                        tool_index[i] = {"id": "", "name": "", "arguments": ""}
                    if tc.id:
                        tool_index[i]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_index[i]["name"] += tc.function.name
                        if tc.function.arguments:
                            tool_index[i]["arguments"] += tc.function.arguments

        if finish_reason == "stop" or (content_parts and not tool_index):
            full = "".join(content_parts) or "I can help with that."
            yield {
                "type": "done",
                "response": full,
                "tools_called": tools_called,
                "tool_count": len(tools_called),
            }
            return

        if tool_index:
            tc_list = [tool_index[i] for i in sorted(tool_index)]

            messages.append(
                {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        }
                        for tc in tc_list
                    ],
                }
            )

            for tc in tc_list:
                yield {
                    "type": "tool_start",
                    "tool": tc["name"],
                    "message": TOOL_MESSAGES.get(tc["name"], "Working..."),
                }

            results = await asyncio.gather(
                *[
                    process_tool_call(tc["name"], tc["arguments"], uid=uid, email=email, user_name=name)
                    for tc in tc_list
                ]
            )

            for tc, result in zip(tc_list, results):
                tools_called.append(tc["name"])
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": tc["name"],
                        "content": _bound_tool_result(result),
                    }
                )
                yield {"type": "tool_end", "tool": tc["name"]}

    logger.warning("Streaming loop exhausted for session %s", session_id)


async def _create_escalation_ticket(
    *,
    uid: str,
    email: str,
    name: str,
    issue: str,
    tools_called: list[str],
) -> str | None:
    """Create a support ticket for exhausted tool loops and return its id."""
    args = {
        "issue": issue[:500] or "Agent tool loop exhausted before a final response.",
        "category": "other",
    }
    tools_called.append("create_support_ticket")
    result = await process_tool_call(
        "create_support_ticket", json.dumps(args), uid=uid, email=email, user_name=name
    )
    try:
        parsed = json.loads(result)
    except json.JSONDecodeError:
        return None
    return parsed.get("ticket_id")


def _fallback_response(ticket_id: str | None) -> str:
    """Return the escalation fallback with a ticket marker."""
    marker = ticket_id or "pending"
    return f"I've looked into this but need more time. I've created a support ticket so our team can follow up. [{marker}]"


async def run_agent(
    message: str,
    uid: str,
    email: str,
    name: str,
    session_id: str,
    history: list[dict],
) -> dict:
    """Run Dharma with conversation history and MCP tools."""
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY missing; agent cannot run.")
        return {
            "response": "I'm having trouble right now. Please try again shortly.",
            "tools_called": [],
            "tool_count": 0,
        }

    client = _get_openai_client()
    tools_called: list[str] = []
    response_parts: list[str] = []
    messages, message = _build_messages(
        message=message,
        name=name,
        email=email,
        history=history,
        first_message=len(history) == 0,
    )

    try:
        async for event in _run_streaming_loop(
            messages, _get_tool_schema(), client, session_id, uid=uid, email=email, name=name
        ):
            event_type = event.get("type")
            if event_type == "token":
                response_parts.append(event.get("delta", ""))
            elif event_type == "tool_end" and event.get("tool"):
                tools_called.append(event["tool"])
            elif event_type == "done":
                tools_called = event.get("tools_called", tools_called)
                return {
                    "response": event.get("response") or "".join(response_parts) or "I can help with that.",
                    "tools_called": tools_called,
                    "tool_count": len(tools_called),
                }

        ticket_id = await _create_escalation_ticket(
            uid=uid,
            email=email,
            name=name,
            issue=message,
            tools_called=tools_called,
        )
        return {
            "response": _fallback_response(ticket_id),
            "tools_called": tools_called,
            "tool_count": len(tools_called),
        }
    except Exception as exc:
        logger.warning("Agent failed gracefully for session %s: %s", session_id, exc)
        return {
            "response": "I'm having trouble right now. Please try again shortly.",
            "tools_called": tools_called,
            "tool_count": len(tools_called),
        }


async def run_agent_streaming(
    message: str,
    uid: str,
    email: str,
    name: str,
    session_id: str,
    history: list[dict],
):
    """Yield user-safe status, token, and final events while Dharma responds."""
    tools_called: list[str] = []
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY missing; streaming agent cannot run.")
        yield {
            "type": "done",
            "response": "I'm having trouble right now.",
            "tools_called": [],
            "tool_count": 0,
        }
        return

    client = _get_openai_client()
    messages, message = _build_messages(
        message=message,
        name=name,
        email=email,
        history=history,
        first_message=len(history) == 0,
    )

    completed = False
    try:
        async for event in _run_streaming_loop(
            messages, _get_tool_schema(), client, session_id, uid=uid, email=email, name=name
        ):
            if event.get("type") == "tool_end" and event.get("tool"):
                tools_called.append(event["tool"])
            if event.get("type") == "done":
                completed = True
                tools_called = event.get("tools_called", tools_called)
            yield event
        if completed:
            return
    except Exception as exc:
        logger.warning("Streaming agent failed: %s", exc)

    ticket_id = await _create_escalation_ticket(
        uid=uid,
        email=email,
        name=name,
        issue=message,
        tools_called=tools_called,
    )
    yield {
        "type": "done",
        "response": _fallback_response(ticket_id),
        "tools_called": tools_called,
        "tool_count": len(tools_called),
    }
