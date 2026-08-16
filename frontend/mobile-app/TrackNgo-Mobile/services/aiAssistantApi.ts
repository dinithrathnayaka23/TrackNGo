import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpPost } from "./http";
import type { ProfileLanguage } from "./profileSettingsApi";

const TOKEN_KEY = "trackngo.auth.token";
// The backend may make a second model call after a primary-model timeout.
// Keep the mobile request alive long enough to receive that response instead
// of aborting a healthy backend request while it is still processing.
const AI_REQUEST_TIMEOUT_MS = 60000;

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
  language: ProfileLanguage = "en",
): Promise<ChatApiResponse> {
  const headers = await authHeaders();
  return httpPost<ChatApiResponse>(
    "/api/v1/ai/chat",
    undefined,
    { message, chatId, userId, language },
    headers,
    AI_REQUEST_TIMEOUT_MS,
  );
}
