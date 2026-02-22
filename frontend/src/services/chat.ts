
const API_URL = "https://ilgem-backend-y0m3.onrender.com";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ChatRequestPayload {
  messages: { role: string; content: string }[];
  email: string;
  name?: string;
  uid?: string;
}

export const chatService = {
  async sendMessage(payload: ChatRequestPayload): Promise<string> {
    try {
      console.log("Sending message to:", `${API_URL}/chat`);
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend Error:", response.status, response.statusText, errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || data.message || "No response from server";
    } catch (error) {
      console.error("Chat Service Error:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        console.error("Possible CORS issue or server is unreachable.");
      }
      throw error;
    }
  }
};

