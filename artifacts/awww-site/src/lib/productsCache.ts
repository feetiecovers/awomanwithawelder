import fallbackRaw from "../../live-raw.json";

export const PRODUCTS_CACHE_KEY = "awww_products_offerings_cache_v2";

/**
 * Returns cached products from localStorage if available.
 * If not yet in localStorage, immediately returns the bundled snapshot
 * so offerings are ALWAYS instantly available on website load with zero delay.
 */
export function getCachedProducts(): any[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read cached products from localStorage", e);
    }
  }

  // Fall back to bundled snapshot so offerings are never empty
  return Array.isArray(fallbackRaw) ? fallbackRaw : [];
}

/**
 * Persists fresh products to localStorage for instant loading across visits.
 */
export function saveProductsToCache(products: unknown): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!Array.isArray(products) || products.length === 0) return;

  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch (e) {
    console.warn("Failed to save products to localStorage cache", e);
  }
}
