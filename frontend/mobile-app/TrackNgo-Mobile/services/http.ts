import { API_BASE_URL } from "../config/env";

const defaultHeaders = {
  Accept: "application/json",
};

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
      headers: {
        ...defaultHeaders,
        ...(headers ?? {}),
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTP GET] Error ${response.status}:`, errorText);
      throw new Error(`GET ${path} failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`[HTTP GET] Success:`, data);
    return data;
  } catch (err) {
    console.error(`[HTTP GET] Exception:`, err);
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
  console.log(`[HTTP POST] ${url}`, body);
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...defaultHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTP POST] Error ${response.status}:`, errorText);
      throw new Error(`POST ${path} failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`[HTTP POST] Success:`, data);
    return data;
  } catch (err) {
    if (timeoutMs && isAbortError(err)) {
      const timeoutError = new Error(
        `POST ${path} timed out after ${timeoutMs / 1000} seconds`,
      );
      console.error(`[HTTP POST] Exception:`, timeoutError);
      throw timeoutError;
    }
    console.error(`[HTTP POST] Exception:`, err);
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
  console.log(`[HTTP PUT] ${url}`, body);
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...defaultHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTP PUT] Error ${response.status}:`, errorText);
      throw new Error(`PUT ${path} failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`[HTTP PUT] Success:`, data);
    return data;
  } catch (err) {
    console.error(`[HTTP PUT] Exception:`, err);
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
      headers: {
        ...defaultHeaders,
        ...(headers ?? {}),
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTP DELETE] Error ${response.status}:`, errorText);
      throw new Error(
        `DELETE ${path} failed: ${response.status} - ${errorText}`,
      );
    }
    const data = await response.json();
    console.log(`[HTTP DELETE] Success:`, data);
    return data;
  } catch (err) {
    console.error(`[HTTP DELETE] Exception:`, err);
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
      headers: {
        ...defaultHeaders,
        ...(headers ?? {}),
      },
      body: form,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTP POST FORM] Error ${response.status}:`, errorText);
      throw new Error(`POST ${path} failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`[HTTP POST FORM] Success:`, data);
    return data;
  } catch (err) {
    console.error(`[HTTP POST FORM] Exception:`, err);
    throw err;
  }
}

