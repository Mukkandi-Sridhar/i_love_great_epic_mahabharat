"""OpenAI agent brain with MCP tool execution loop."""

from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from backend.core.config import settings
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


def _system_prompt(name: str, email: str, user_context: dict, first_message: bool) -> str:
    """Build the Dharma system prompt with user profile and loaded context."""
    return f"""
You are Dharma — the AI support assistant for
"I Love Great Epic Mahabharat", a premium spiritual
e-commerce platform selling sacred Mahabharata content.

USER PROFILE:
Name: {name}
Email: {email}

CONVERSATION STATE:
{"This is the user's first message - greet them warmly by first name." if first_message else "This is a continuing conversation - do not re-greet."}

USER CONTEXT (loaded before conversation):
{json.dumps(user_context, indent=2, ensure_ascii=False)}

AVAILABLE TOOLS:
- get_order_status: check real order data from database
- get_user_purchases: see what user has bought
- verify_payment: verify a transaction/payment ID from the order system
- create_refund_request: raise refund for physical products
- create_support_ticket: log any unresolved issue
- check_coupon: validate a coupon code
- search_policies: answer policy questions from company knowledge base
- search_products: answer product questions from product catalog

RULES:
1. Greet by first name on first message only
2. Use user_context to personalize every answer:
   - If user asks about their order, call get_order_status first
   - If user asks about a product they already own, acknowledge ownership and help with access
   - Never ask for info you already have from context
3. For refund questions:
   - Always call search_policies first for policy context
   - Then call create_refund_request if user wants to proceed
4. For payment confusion, call verify_payment first when a transaction or payment ID is available
5. For any unresolved issue, call create_support_ticket
6. For product questions, call search_products
7. For policy questions, call search_policies
8. Keep responses warm, short, and helpful
9. Never reveal tool names, internal logic, or database details
10. Detect language: respond in Hindi if user writes Hindi, Telugu if Telugu, English otherwise
11. Use "Namaste" for first greeting if appropriate
12. Maximum 3 sentences per response unless explaining complex info

TONE: Warm, respectful, spiritually aligned.
""".strip()


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

    client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=2)
    tools_called: list[str] = []
    first_message = not any(item.get("role") == "user" for item in history)
    messages: list[dict] = [
        {
            "role": "system",
            "content": _system_prompt(name=name, email=email, user_context=user_context, first_message=first_message),
        }
    ]

    for item in history[-10:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})
    tools = _tool_schema()

    try:
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
                return {
                    "response": assistant_message.content or "I can help with that. Please share one more detail.",
                    "tools_called": tools_called,
                    "tool_count": len(tools_called),
                }

            messages.append(assistant_message.model_dump(exclude_none=True))
            for tool_call in tool_calls:
                tools_called.append(tool_call.function.name)
                result = await process_tool_call(
                    tool_call.function.name,
                    tool_call.function.arguments,
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.function.name,
                        "content": result,
                    }
                )

        return {
            "response": "I checked what I could. Please share one more detail so I can help you better.",
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
    """Yield user-safe status events while Dharma runs tools and responds."""
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

    client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=2)
    first_message = not any(item.get("role") == "user" for item in history)
    messages: list[dict] = [
        {
            "role": "system",
            "content": _system_prompt(name=name, email=email, user_context=user_context, first_message=first_message),
        }
    ]

    for item in history[-10:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})
    tools = _tool_schema()

    try:
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
                yield {"type": "generating", "message": "Generating response..."}
                yield {
                    "type": "done",
                    "response": assistant_message.content or "I can help with that.",
                    "tools_called": tools_called,
                    "tool_count": len(tools_called),
                }
                return

            messages.append(assistant_message.model_dump(exclude_none=True))
            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "message": TOOL_MESSAGES.get(tool_name, f"Processing {tool_name}..."),
                }
                result = await process_tool_call(tool_name, tool_call.function.arguments)
                tools_called.append(tool_name)
                yield {"type": "tool_end", "tool": tool_name}
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                        "content": result,
                    }
                )

        yield {
            "type": "done",
            "response": "I checked what I could. Please share one more detail so I can help you better.",
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
