
import { BACKEND_URL, jsonHeaders } from "@/services/api";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ChatMetadata {
  model?: string;
  retrievedKnowledge?: number;
  toolsAvailable?: number;
  cached?: boolean;
  toolCalled?: string | null;
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
  metadata?: ChatMetadata;
}

export const chatService = {
  async sendMessage(payload: ChatRequestPayload): Promise<ChatResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: jsonHeaders(),
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
  }
};

