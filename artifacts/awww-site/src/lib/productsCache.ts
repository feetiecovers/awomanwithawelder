import liveCatalogSnapshot from "@/content/currentLiveCatalog.json";

export const PRODUCTS_CACHE_KEY = "awww_products_offerings_cache_v13";

/**
 * Purge outdated/stale cache keys from previous deployments
 */
function purgeLegacyCaches() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem("awww_products_offerings_cache_v1");
    localStorage.removeItem("awww_products_offerings_cache_v2");
    localStorage.removeItem("awww_products_offerings_cache_v3");
    localStorage.removeItem("awww_products_offerings_cache_v4");
    localStorage.removeItem("awww_products_offerings_cache_v5");
    localStorage.removeItem("awww_products_offerings_cache_v6");
    localStorage.removeItem("awww_products_offerings_cache_v7");
    localStorage.removeItem("awww_products_offerings_cache_v8");
    localStorage.removeItem("awww_products_offerings_cache_v9");
    localStorage.removeItem("awww_products_offerings_cache_v10");
    localStorage.removeItem("awww_products_offerings_cache_v11");
    localStorage.removeItem("awww_products_offerings_cache_v12");
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
 * Ensures build items from snapshot are preserved if remote products payload hasn't synced builds yet,
 * and enriches remote build records with images/badges if remote payload is missing them.
 */
function mergeWithBuildSnapshots(items: any[]): any[] {
  if (!Array.isArray(liveCatalogSnapshot)) return items;
  const snapshotBuilds = (liveCatalogSnapshot as any[]).filter(
    (item) => item?.type === "build" || item?._sourceType === "build" || item?.buildType === "build" || Boolean(item?.buildId)
  );
  if (snapshotBuilds.length === 0) return items;

  const result = [...items];
  for (const buildItem of snapshotBuilds) {
    const buildId = buildItem.buildId || buildItem.id;
    const existingIndex = result.findIndex(
      (p) => (p.buildId && p.buildId === buildId) || (p.id && p.id === buildItem.id) || p.name === buildItem.name
    );
    if (existingIndex === -1) {
      result.push(buildItem);
    } else {
      // Enrich existing build item with image & badges if remote payload has null/empty image
      const existing = result[existingIndex];
      if ((!existing.image && !existing.imageUrl) || existing.image === "/placeholder.svg") {
        result[existingIndex] = {
          ...buildItem,
          ...existing,
          image: buildItem.image || existing.image,
          imageUrl: buildItem.imageUrl || existing.imageUrl,
          primaryImageUrl: buildItem.primaryImageUrl || existing.primaryImageUrl,
          images: Array.isArray(buildItem.images) && buildItem.images.length > 0 ? buildItem.images : existing.images,
          badgeLabel: buildItem.badgeLabel || existing.badgeLabel,
          comingSoonLabel: buildItem.comingSoonLabel || existing.comingSoonLabel,
        };
      }
    }
  }
  return result;
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
          return mergeWithBuildSnapshots(parsed);
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
    const merged = mergeWithBuildSnapshots(products);
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("Failed to save products to localStorage cache", e);
  }
}

