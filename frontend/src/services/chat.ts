
import { BACKEND_URL, authHeaders } from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatRequestPayload {
  message: string;
  email: string;
  name?: string;
  uid: string;
  session_id?: string;
}

export interface ChatResponse {
  response: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamEvent {
  type: "status" | "tool_start" | "tool_end" | "generating" | "token" | "done" | "error";
  message?: string;
  tool?: string;
  delta?: string;
  response?: string;
  session_id?: string;
  code?: number;
}

export const chatService = {
  async sendMessage(payload: ChatRequestPayload): Promise<ChatResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        response: data.response || data.message || "No response from server",
        session_id: data.session_id,
        metadata: data.metadata,
      };
    } catch (error) {
      throw error;
    }
  },

  async sendMessageStreaming(
    payload: ChatRequestPayload,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    const response = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      onEvent({
        type: "error",
        code: response.status,
        message: `Server error: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventText of events) {
        const line = eventText.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        const parsed = JSON.parse(line.slice(6));
        if (parsed.type === "error" && typeof parsed.code !== "number") {
          const message = String(parsed.message || "").toLowerCase();
          if (message.includes("rate") || message.includes("quickly")) parsed.code = 429;
          if (message.includes("auth") || message.includes("uid") || message.includes("blocked")) parsed.code = 403;
        }
        onEvent(parsed);
      }
    }

    if (buffer.startsWith("data: ")) {
      const parsed = JSON.parse(buffer.slice(6));
      if (parsed.type === "error" && typeof parsed.code !== "number") {
        const message = String(parsed.message || "").toLowerCase();
        if (message.includes("rate") || message.includes("quickly")) parsed.code = 429;
        if (message.includes("auth") || message.includes("uid") || message.includes("blocked")) parsed.code = 403;
      }
      onEvent(parsed);
    }
  },
};

