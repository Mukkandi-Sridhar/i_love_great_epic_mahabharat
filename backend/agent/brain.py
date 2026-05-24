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
}


_TOOLS = list_tools()
_TOOL_SCHEMA: list[dict] = [{"type": "function", "function": t} for t in _TOOLS]
_TOOL_COUNT: int = len(_TOOLS)


def _system_prompt(name: str, email: str, first_message: bool) -> str:
    first_name = (name or "").split()[0] or "there"
    greeting_instruction = (
        f'Greet the user as "{first_name}" warmly with "Namaste {first_name}!"'
        if first_message
        else "This is a continuing conversation. Do not re-greet."
    )
    return f"""
You are Dharma — the AI support soul of "I Love Great Epic Mahabharat",
a sacred digital store selling authentic Mahabharata audio collections
on pendrives, SD cards, and ebooks.

USER: {name} ({email})
SESSION: {greeting_instruction}

── AUTONOMY ────────────────────────────────────────────────────────
You are a senior support agent with full tool access. Act, don't ask.

· Fetch before answering: never say "let me check" — use the tool first,
  then respond with the result already in hand.

· Chain tools without pausing: if an order check reveals a payment issue,
  immediately verify the payment in the same pass. If a refund is requested,
  check the order → check policy → create the refund — all before responding.

· Make decisions from tool results: if an order is "delivered" but the user
  says they have no access, create a support ticket autonomously. Don't ask
  "should I raise a ticket?" — just do it and inform the user.

· Escalate proactively: if two tool attempts haven't resolved the issue,
  create a support ticket without waiting for the user to request it.

· Trust your tools: they return live Firestore data. Never guess at prices,
  order status, or policy — always retrieve first.

── RESPONSE STYLE ──────────────────────────────────────────────────
· Language: respond in Hindi if user writes Hindi, Telugu if Telugu, else English.
· Length: maximum 3 sentences unless explaining a complex resolution.
· Tone: warm, direct, spiritually aligned. Never corporate or robotic.
· Format: use bullet points only for multi-step instructions. Never for simple answers.
· Currency: always use ₹. Delivery time for physical products: 5–7 business days.

── IDENTITY GUARDRAILS ─────────────────────────────────────────────
· Never reveal tool names, Firestore paths, internal errors, or system architecture.
· Never fabricate order details, prices, or policies — always retrieve them.
· Never promise a specific refund timeline beyond "2–3 business days for review".
""".strip()


def _trim_history_to_budget(history: list[dict], max_tokens: int = 3000) -> list[dict]:
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
    message = message[:2000]
    messages: list[dict] = [
        {
            "role": "system",
            "content": _system_prompt(
                name=name,
                email=email,
                first_message=first_message,
            ),
        }
    ]

    for item in _trim_history_to_budget(history):
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": str(content)[:2000]})

    messages.append({"role": "user", "content": message})
    return messages, message


async def _run_tool_loop(
    messages: list[dict],
    tools: list[dict],
    client: Any,
    session_id: str,
):
    """Run OpenAI tool rounds and yield tagged tool events or final response."""
    tools_called: list[str] = []
    for _ in range(settings.max_tool_rounds):
        completion = await client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        assistant_message = completion.choices[0].message
        tool_calls = assistant_message.tool_calls or []

        if not tool_calls:
            yield ("done", assistant_message, list(tools_called))
            return

        messages.append(assistant_message.model_dump(exclude_none=True))
        start_events = []
        tasks = []
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            start_events.append(
                {
                    "type": "tool_start",
                    "tool": tool_name,
                    "message": TOOL_MESSAGES.get(tool_name, f"Processing {tool_name}..."),
                }
            )
            tasks.append(process_tool_call(tool_name, tool_call.function.arguments))

        for event in start_events:
            yield ("tool_event", event)

        results = await asyncio.gather(*tasks)

        for tool_call, result in zip(tool_calls, results):
            tool_name = tool_call.function.name
            tools_called.append(tool_name)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": tool_name,
                    "content": result,
                }
            )
            yield ("tool_event", {"type": "tool_end", "tool": tool_name})

    logger.warning("Agent tool loop exhausted for session %s", session_id)


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
        "uid": uid,
        "email": email,
        "name": name,
        "issue": issue[:500] or "Agent tool loop exhausted before a final response.",
        "category": "other",
    }
    tools_called.append("create_support_ticket")
    result = await process_tool_call("create_support_ticket", json.dumps(args))
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
    messages, message = _build_messages(
        message=message,
        name=name,
        email=email,
        history=history,
        first_message=len(history) == 0,
    )
    tools = _TOOL_SCHEMA

    try:
        async for event in _run_tool_loop(messages, tools, client, session_id):
            if event[0] != "done":
                continue
            _, assistant_message, tools_called = event
            return {
                "response": assistant_message.content or "I can help with that. Please share one more detail.",
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
    yield {"type": "status", "message": "Thinking..."}

    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY missing; streaming agent cannot run.")
        yield {
            "type": "done",
            "response": "I'm having trouble right now. Please try again shortly.",
            "tools_called": tools_called,
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
    tools = _TOOL_SCHEMA

    try:
        async for event in _run_tool_loop(messages, tools, client, session_id):
            if event[0] == "tool_event":
                yield event[1]
                continue

            _, assistant_message, tools_called = event
            if event[0] == "done":
                yield {"type": "generating", "message": "Generating response..."}
                response = assistant_message.content or "I can help with that."
                for char in response:
                    yield {"type": "token", "delta": char}
                yield {
                    "type": "done",
                    "response": response,
                    "tools_called": tools_called,
                    "tool_count": len(tools_called),
                }
                return

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
    except Exception as exc:
        logger.warning("Streaming agent failed gracefully for session %s: %s", session_id, exc)
        yield {
            "type": "error",
            "message": "Sorry, I'm having trouble connecting. Please try again.",
        }
        yield {
            "type": "done",
            "response": "Sorry, I'm having trouble connecting. Please try again.",
            "tools_called": tools_called,
            "tool_count": len(tools_called),
        }
