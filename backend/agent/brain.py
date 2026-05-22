"""OpenAI agent brain with MCP tool execution loop."""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.core.config import settings
from backend.core.openai_client import _get_openai_client
from backend.mcp.server import list_tools, process_tool_call


logger = logging.getLogger("ChatbotBackend.agent.brain")

TOOL_MESSAGES = {
    "get_order_status": "Fetching your order details...",
    "get_user_purchases": "Checking your purchases...",
    "verify_payment": "Verifying your transaction...",
    "create_refund_request": "Processing your refund request...",
    "create_support_ticket": "Creating your support ticket...",
    "check_coupon": "Validating your coupon...",
    "search_policies": "Checking our policies...",
    "search_products": "Searching our products...",
}


def _tool_schema() -> list[dict]:
    """Convert internal MCP tool specs to OpenAI tool format."""
    return [{"type": "function", "function": tool} for tool in list_tools()]


def _summarize_context(ctx: dict) -> str:
    """Return a bounded user-context summary for the system prompt."""
    orders = ctx.get("recent_orders", []) or []
    purchases = ctx.get("purchases", []) or []
    tickets = ctx.get("open_tickets_count", 0)
    order_lines = [
        f"  - {o.get('order_id', 'unknown')}: {o.get('product_title', 'Unknown product')} ({o.get('status', 'unknown')})"
        for o in orders[:3]
    ]
    purchase_lines = [
        f"  - {p.get('product_id', 'unknown')}: {p.get('title', 'Unknown product')}"
        for p in purchases[:5]
    ]
    return (
        f"Orders ({len(orders)}):\n" + ("\n".join(order_lines) or "  none") + "\n"
        f"Purchases ({len(purchases)}):\n" + ("\n".join(purchase_lines) or "  none") + "\n"
        f"Open tickets: {tickets}"
    )


def _system_prompt(name: str, email: str, user_context: dict, first_message: bool) -> str:
    """Build the Dharma system prompt with user profile and loaded context."""
    return f"""
You are Dharma - the AI support assistant for
"I Love Great Epic Mahabharat", a premium spiritual
e-commerce platform selling sacred Mahabharata content.

USER PROFILE:
Name: {name}
Email: {email}

CONVERSATION STATE:
{"This is the user's first message - greet them warmly by first name." if first_message else "This is a continuing conversation - do not re-greet."}

USER CONTEXT (loaded before conversation):
{_summarize_context(user_context)}

CAPABILITIES: You can look up orders, verify payments, process refunds, create support tickets,
validate coupons, and answer questions about products and policies using your available tools.

RULES:
1. Greet by first name on first message only
2. Use user_context to personalize every answer:
   - If user asks about their order, call the relevant available capability first
   - If user asks about a product they already own, acknowledge ownership and help with access
   - Never ask for info you already have from context
3. For refund questions:
   - Always check policy context first
   - Then create a refund request if user wants to proceed
4. For payment confusion, verify payment first when a transaction or payment ID is available
5. For any unresolved issue, create a support ticket
6. For product questions, search product information
7. For policy questions, search policy information
8. Keep responses warm, short, and helpful
9. Never reveal tool names, internal logic, or database details
10. Detect language: respond in Hindi if user writes Hindi, Telugu if Telugu, English otherwise
11. Use "Namaste" for first greeting if appropriate
12. Maximum 3 sentences per response unless explaining complex info

TONE: Warm, respectful, spiritually aligned.
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
    user_context: dict,
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
                user_context=user_context,
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


async def _run_tool_loop(messages: list[dict], tools: list[dict], client: Any, session_id: str):
    """Run OpenAI tool rounds and yield each assistant decision."""
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
            yield assistant_message, tool_calls, list(tools_called)
            return

        messages.append(assistant_message.model_dump(exclude_none=True))
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            tools_called.append(tool_name)
            result = await process_tool_call(tool_name, tool_call.function.arguments)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": tool_name,
                    "content": result,
                }
            )
        yield assistant_message, tool_calls, list(tools_called)

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
    user_context: dict,
) -> dict:
    """Run Dharma with conversation history, user context, and MCP tools."""
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
        user_context=user_context,
        first_message=len(history) == 0,
    )
    tools = _tool_schema()

    try:
        async for assistant_message, tool_calls, tools_called in _run_tool_loop(messages, tools, client, session_id):
            if not tool_calls:
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
    user_context: dict,
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
        user_context=user_context,
        first_message=len(history) == 0,
    )
    tools = _tool_schema()

    try:
        async for assistant_message, tool_calls, tools_called in _run_tool_loop(messages, tools, client, session_id):
            if not tool_calls:
                yield {"type": "generating", "message": "Generating response..."}
                parts: list[str] = []
                stream = await client.chat.completions.create(
                    model=settings.openai_chat_model,
                    messages=messages,
                    stream=True,
                )
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta.content or ""
                    if not delta:
                        continue
                    parts.append(delta)
                    yield {"type": "token", "delta": delta}

                response = "".join(parts) or assistant_message.content or "I can help with that."
                yield {
                    "type": "done",
                    "response": response,
                    "tools_called": tools_called,
                    "tool_count": len(tools_called),
                }
                return

            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "message": TOOL_MESSAGES.get(tool_name, f"Processing {tool_name}..."),
                }
                yield {"type": "tool_end", "tool": tool_name}

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
