import Constants from 'expo-constants';

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
  const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
  return host || null;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function getAPIBaseUrl(): string {
  if (env.EXPO_PUBLIC_API_BASE_URL) {
    return normalizeBaseUrl(env.EXPO_PUBLIC_API_BASE_URL);
  }

  const devHost = getDevHost();
  if (devHost) {
    return `http://${devHost}:8080`;
  }

  return 'http://localhost:8080';
}

export const API_BASE_URL = getAPIBaseUrl();

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
