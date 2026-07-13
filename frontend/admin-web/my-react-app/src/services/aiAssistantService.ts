import authService from "./authService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  reply?: string;
  data?: T;
}

const API_BASE = "/api/v1/ai";

export async function sendChatMessage(
  message: string,
  chatId: string,
): Promise<string> {
  const token = authService.getToken();
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      chatId,
    }),
  });

  const body = (await response.json()) as ApiResponse<{ reply: string }>;

  if (!response.ok || !body.reply) {
    throw new Error(body.message || "Failed to get AI response");
  }

  return body.reply;
}
