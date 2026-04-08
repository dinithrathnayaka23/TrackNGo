import { API_BASE_URL } from "../config/env";

export function resolveAssetUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(https?:|file:|content:|data:)/i.test(trimmed)) {
    return trimmed;
  }

  return new URL(trimmed, API_BASE_URL).toString();
}
