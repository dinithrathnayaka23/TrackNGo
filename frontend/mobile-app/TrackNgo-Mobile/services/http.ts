import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/env";

export const TOKEN_KEY = "trackngo.auth.token";

const defaultHeaders = {
  Accept: "application/json",
};

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * Pulls the backend's own `message` out of a failed request so screens can show why
 * something was rejected instead of a generic failure notice. Errors carry the raw
 * response body appended to their message, e.g.
 * `POST /api/complaints failed: 400 - {"success":false,"message":"...","data":null}`.
 */
export function extractApiMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const start = error.message.indexOf("{");
  if (start === -1) return fallback;
  try {
    const parsed = JSON.parse(error.message.slice(start));
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
    return message || fallback;
  } catch {
    return fallback;
  }
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Reads the `exp` claim without verifying the signature. The device only needs to
 * know whether the backend will still accept this token; the backend remains the
 * authority on validity. A token we cannot parse is treated as expired so a
 * corrupt value fails closed rather than producing a request that 401s.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(
      decodeURIComponent(
        atob(padded)
          .split("")
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      ),
    );
    if (typeof claims?.exp !== "number") return true;
    return claims.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/** The stored token, or null when it is missing or has already expired. */
export async function getValidAuthToken(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token || isTokenExpired(token)) return null;
  return token;
}

// Callers used to build the Authorization header themselves in each service
// module, which meant any request that forgot it silently came back as an empty
// 403. The token is attached here instead so every request carries it, while an
// explicit Authorization header passed by the caller still wins.
async function withAuth(headers?: Record<string, string>) {
  const merged: Record<string, string> = { ...defaultHeaders, ...(headers ?? {}) };
  if (!merged.Authorization) {
    const token = await getAuthToken();
    if (token) {
      merged.Authorization = `Bearer ${token}`;
    }
  }
  return merged;
}

// Listeners are notified when the backend rejects our credentials so the app can
// drop the stale session and send the user back to the login screen from one place.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(status: number, path: string) {
  if (status !== 401 && status !== 403) return;
  // Auth endpoints answer 401/403 for bad credentials; that is a failed login,
  // not an expired session, so it must not log the user out.
  if (path.startsWith("/api/auth/")) return;
  unauthorizedListeners.forEach((listener) => listener());
}

// Field names whose values must never reach the console. Request bodies are
// logged to help debugging, and the login body carries the user's password in
// clear text, so it is replaced before the line is written.
const SENSITIVE_FIELDS = [
  "password",
  "newPassword",
  "currentPassword",
  "confirmPassword",
  "token",
  "trustedDeviceToken",
  "twoFactorToken",
  "otp",
  "code",
];

function redactForLog(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const safe: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  SENSITIVE_FIELDS.forEach((field) => {
    if (field in safe && safe[field] !== undefined && safe[field] !== null) {
      safe[field] = "***";
    }
  });
  return safe;
}

/**
 * Reports a request the backend refused.
 *
 * A 4xx is the backend answering the question that was asked - wrong password,
 * seat already taken, validation failed - and the screen turns it into a message
 * for the user. Logging those through console.error made React Native raise them
 * as red runtime errors with a stack trace, which read like crashes for what are
 * ordinary outcomes. Only faults the user cannot resolve, meaning server errors,
 * are reported at error level.
 */
function logResponseFailure(method: string, path: string, status: number, detail: string) {
  const line = `[HTTP ${method}] ${status} ${path}: ${detail}`;
  if (status >= 500) {
    console.error(line);
  } else {
    console.warn(line);
  }
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String((error as { name?: unknown }).name) === "AbortError"
  );
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function httpGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(path, query);
  console.log(`[HTTP GET] ${url}`);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: await withAuth(headers),
    });
    if (!response.ok) {
      const errorText = await response.text();
      logResponseFailure("GET", path, response.status, errorText);
      notifyUnauthorized(response.status, path);
      throw new HttpError(`GET ${path} failed: ${response.status} - ${errorText}`, response.status);
    }
    const data = await response.json();
    console.log(`[HTTP GET] Success: ${path}`);
    return data;
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(`[HTTP GET] ${path} failed:`, err);
    throw err;
  }
}

export async function httpPost<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown,
  headers?: Record<string, string>,
  timeoutMs?: number,
): Promise<T> {
  const url = buildUrl(path, query);
  console.log(`[HTTP POST] ${url}`, redactForLog(body));
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await withAuth({
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      }),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      logResponseFailure("POST", path, response.status, errorText);
      notifyUnauthorized(response.status, path);
      throw new HttpError(`POST ${path} failed: ${response.status} - ${errorText}`, response.status);
    }
    const data = await response.json();
    console.log(`[HTTP POST] Success: ${path}`);
    return data;
  } catch (err) {
    if (timeoutMs && isAbortError(err)) {
      const timeoutError = new Error(
        `POST ${path} timed out after ${timeoutMs / 1000} seconds`,
      );
      console.error(`[HTTP POST] Exception:`, timeoutError);
      throw timeoutError;
    }
    if (!(err instanceof HttpError)) console.error(`[HTTP POST] ${path} failed:`, err);
    throw err;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function httpPut<T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(path);
  console.log(`[HTTP PUT] ${url}`, redactForLog(body));
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: await withAuth({
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      }),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      logResponseFailure("PUT", path, response.status, errorText);
      notifyUnauthorized(response.status, path);
      throw new HttpError(`PUT ${path} failed: ${response.status} - ${errorText}`, response.status);
    }
    const data = await response.json();
    console.log(`[HTTP PUT] Success: ${path}`);
    return data;
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(`[HTTP PUT] ${path} failed:`, err);
    throw err;
  }
}

export async function httpDelete<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(path, query);
  console.log(`[HTTP DELETE] ${url}`);
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: await withAuth(headers),
    });
    if (!response.ok) {
      const errorText = await response.text();
      logResponseFailure("DELETE", path, response.status, errorText);
      notifyUnauthorized(response.status, path);
      throw new HttpError(
        `DELETE ${path} failed: ${response.status} - ${errorText}`,
        response.status,
      );
    }
    const data = await response.json();
    console.log(`[HTTP DELETE] Success: ${path}`);
    return data;
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(`[HTTP DELETE] ${path} failed:`, err);
    throw err;
  }
}

export async function httpPostForm<T>(
  path: string,
  form: FormData,
  query?: Record<string, string | boolean | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(
    path,
    query as Record<string, string | number | undefined>,
  );
  console.log(`[HTTP POST FORM] ${url}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await withAuth(headers),
      body: form,
    });
    if (!response.ok) {
      const errorText = await response.text();
      logResponseFailure("POST FORM", path, response.status, errorText);
      notifyUnauthorized(response.status, path);
      throw new HttpError(`POST ${path} failed: ${response.status} - ${errorText}`, response.status);
    }
    const data = await response.json();
    console.log(`[HTTP POST FORM] Success: ${path}`);
    return data;
  } catch (err) {
    console.error(`[HTTP POST FORM] Exception:`, err);
    throw err;
  }
}

