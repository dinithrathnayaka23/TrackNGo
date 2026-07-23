import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpPost } from "./http";

const TOKEN_KEY = "trackngo.auth.token";
const AI_REQUEST_TIMEOUT_MS = 30000;

interface ChatApiResponse {
  reply: string;
  chatId: string;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function sendAiAssistantMessage(
  message: string,
  chatId: string,
  userId?: number,
): Promise<ChatApiResponse> {
  const headers = await authHeaders();
  return httpPost<ChatApiResponse>(
    "/api/v1/ai/chat",
    undefined,
    { message, chatId, userId },
    headers,
    AI_REQUEST_TIMEOUT_MS,
  );
}
