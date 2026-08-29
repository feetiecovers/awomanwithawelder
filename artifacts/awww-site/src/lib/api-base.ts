const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AWWAW_PRODUCTION_API_BASE_URL = "https://awomanwithawelder.onrender.com";

function getRuntimeProductionApiBaseUrl(): string {
  if (typeof window === "undefined" || !window.location?.hostname) return "";
  const hostname = String(window.location.hostname).trim().toLowerCase();
  if (
    hostname === "www.awomanwithawelder.co.nz"
    || hostname === "awomanwithawelder.co.nz"
    || hostname === "awomanwithawelder.shop-4a5.workers.dev"
  ) {
    return AWWAW_PRODUCTION_API_BASE_URL;
  }
  return "";
}

export function getConfiguredApiBaseUrl(): string {
  const raw = String(RAW_API_BASE_URL || "").trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }

  const productionFallback = getRuntimeProductionApiBaseUrl();
  if (productionFallback) return productionFallback;

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
