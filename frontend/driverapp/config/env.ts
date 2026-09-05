import Constants from 'expo-constants';
import { Platform } from 'react-native';

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
};

function getDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri) return null;
  const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
  return host || null;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function getAPIBaseUrl(): string {
  // If explicitly set in env, or baked into the manifest by app.config.js
  // (EAS Build's Metro step does not always inline EXPO_PUBLIC_* vars, so
  // this is the reliable path for a production build).
  const explicit = env.EXPO_PUBLIC_API_BASE_URL || expoExtra.apiBaseUrl;
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const devHost = getDevHost();
  if (devHost) {
    const androidEmulatorHost =
      Platform.OS === 'android' &&
      (devHost === 'localhost' || devHost === '127.0.0.1')
        ? '10.0.2.2'
        : devHost;
    return `http://${androidEmulatorHost}:8080`;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8080'
    : 'http://localhost:8080';
}

export const API_BASE_URL = getAPIBaseUrl();
export const ADMIN_SUPPORT_USER_ID = Number(
  env.EXPO_PUBLIC_ADMIN_SUPPORT_USER_ID ?? '1'
);

/* Chat websocket wiring. These must match StompWebSocketConfig on the backend and
   the passenger app's own constants, since all three apps share one broker. */
export const SOCKJS_ENDPOINT = '/chat';
export const STOMP_APP_PREFIX = '/app';
export const STOMP_TOPIC_PREFIX = '/topic';

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
