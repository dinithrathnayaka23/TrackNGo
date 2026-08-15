import Constants from "expo-constants";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

function getDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri) return null;
  const host = hostUri
    .replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "")
    .split(":")[0];
  return host || null;
}

const devHost = getDevHost();

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

function getAPIPort(): string {
  return env.EXPO_PUBLIC_API_PORT?.trim() || "8080";
}

// Dynamically determine API URL based on environment
function getAPIBaseUrl(): string {
  // If explicitly set in env
  if (env.EXPO_PUBLIC_API_BASE_URL) {
    return normalizeBaseUrl(env.EXPO_PUBLIC_API_BASE_URL);
  }
  
  // If dev host detected (running from Expo Go), use same host
  if (devHost) {
    return `http://${devHost}:${getAPIPort()}`;
  }
  
  // Fallback to localhost for dev/testing
  return `http://localhost:${getAPIPort()}`;
}

export const API_BASE_URL = getAPIBaseUrl();
export const ADMIN_SUPPORT_USER_ID = Number(
  env.EXPO_PUBLIC_ADMIN_SUPPORT_USER_ID ?? "1",
);

export const SOCKJS_ENDPOINT = "/chat";
export const STOMP_APP_PREFIX = "/app";
export const STOMP_TOPIC_PREFIX = "/topic";

// Google Maps / Places API key
// Used in the booking screen for location autocomplete suggestions
export const GOOGLE_MAPS_API_KEY = "AIzaSyBRhufBdrtOBau-epFGsCQvy2xIvOfosPs";
