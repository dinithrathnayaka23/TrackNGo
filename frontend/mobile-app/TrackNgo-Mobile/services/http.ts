import { API_BASE_URL } from "../config/env";

const defaultHeaders = {
  Accept: "application/json"
};

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
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
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    method: "GET",
    headers: defaultHeaders
  });
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function httpPost<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    method: "POST",
    headers: {
      ...defaultHeaders,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function httpPut<T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "PUT",
    headers: {
      ...defaultHeaders,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`PUT ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function httpDelete<T>(
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    method: "DELETE",
    headers: defaultHeaders
  });
  if (!response.ok) {
    throw new Error(`DELETE ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function httpPostForm<T>(
  path: string,
  form: FormData,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const response = await fetch(buildUrl(path, query as Record<string, string | number | undefined>), {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status}`);
  }
  return response.json();
}
