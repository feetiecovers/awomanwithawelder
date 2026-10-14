import liveCatalogSnapshot from "@/content/currentLiveCatalog.json";

export const PRODUCTS_CACHE_KEY = "awww_products_offerings_cache_v4";

/**
 * Purge outdated/stale cache keys from previous deployments
 */
function purgeLegacyCaches() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem("awww_products_offerings_cache_v1");
    localStorage.removeItem("awww_products_offerings_cache_v2");
    localStorage.removeItem("awww_products_offerings_cache_v3");
  } catch {}
}

/**
 * Validates that an array contains legitimate products and no old test data
 */
function isValidProductsList(items: unknown): items is any[] {
  if (!Array.isArray(items) || items.length === 0) return false;
  // Discard any cache containing old dummy items like "Dancing in Space"
  return !items.some((p: any) =>
    typeof p?.name === "string" && (
      p.name.toLowerCase().includes("dancing in space") ||
      p.name.toLowerCase().includes("dummy")
    )
  );
}

/**
 * Returns cached products from localStorage if valid.
 * Automatically wipes any old or corrupt caches containing test stock.
 * Falls back to currentLiveCatalog.json snapshot so real offerings are instantly visible.
 */
export function getCachedProducts(): any[] {
  purgeLegacyCaches();

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidProductsList(parsed)) {
          return parsed;
        }
        localStorage.removeItem(PRODUCTS_CACHE_KEY);
      }
    } catch (e) {
      console.warn("Failed to read cached products from localStorage", e);
    }
  }

  // Fall back to authoritative live catalog snapshot
  return Array.isArray(liveCatalogSnapshot) ? (liveCatalogSnapshot as any[]) : [];
}

/**
 * Persists fresh live products to localStorage for instant loading across visits.
 */
export function saveProductsToCache(products: unknown): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!isValidProductsList(products)) return;

  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch (e) {
    console.warn("Failed to save products to localStorage cache", e);
  }
}
