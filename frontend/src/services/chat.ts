
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

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
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
  async getHistory(uid: string, sessionId: string, limit = 50): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({
      uid,
      session_id: sessionId,
      limit: String(limit),
    });
    const response = await fetch(`${BACKEND_URL}/chat/history?${params.toString()}`, {
      method: "GET",
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`History error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      session_id: data.session_id || sessionId,
      messages: (data.messages || []).map((item: ChatMessage) => ({
        ...item,
        timestamp: item.timestamp || Date.now(),
      })),
    };
  },

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
        try {
          const parsed = JSON.parse(line.slice(6));
          onEvent(parsed);
        } catch {
          // Malformed SSE frame; wait for the next valid event.
        }
      }
    }

    if (buffer.startsWith("data: ")) {
      try {
        const parsed = JSON.parse(buffer.slice(6));
        onEvent(parsed);
      } catch {
        // Malformed SSE frame; skip silently.
      }
    }
  },
};

