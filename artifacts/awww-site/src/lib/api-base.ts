const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function getConfiguredApiBaseUrl(): string {
  const raw = String(RAW_API_BASE_URL || "").trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getConfiguredApiBaseUrl();

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
