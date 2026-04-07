const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

export const API_BASE_URL =
  env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.43.45:8080";
export const ADMIN_SUPPORT_USER_ID = Number(
  env.EXPO_PUBLIC_ADMIN_SUPPORT_USER_ID ?? "1",
);

export const SOCKJS_ENDPOINT = "/chat";
export const STOMP_APP_PREFIX = "/app";
export const STOMP_TOPIC_PREFIX = "/topic";
