import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDesktopAuthHeaders, getDesktopSyncConfig } from "./desktopSync";

export type SyncedSourceType = "product" | "service" | "build";

export type SyncedStockEntry = Record<string, unknown> & {
  id: number;
  externalId: string;
  _syncKey: string;
  _sourceType: SyncedSourceType;
  websiteIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  type: SyncedSourceType;
  available: boolean;
  createdAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stockStorePath = path.resolve(__dirname, "../../lib/ecommerce-stock-store.json");
const defaultWebsiteId = process.env.WEBSITE_ID || "web-1782561404289";

export function normalizeWebsiteId(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeLabel(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return String(candidate.name ?? candidate.title ?? candidate.label ?? candidate.value ?? "").trim();
  }
  return "";
}

export function pickExternalId(product: Record<string, unknown>): string {
  const candidates = [
    product.id,
    product.productId,
    product.externalId,
    product.external_id,
    product.product_id,
    product.sku,
    product.handle,
    product.slug,
    product.name,
    product.title,
  ];

  for (const candidate of candidates) {
    const label = normalizeLabel(candidate);
    if (label) return label;
  }

  return "";
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapImages(value: unknown): unknown[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flat();
  return [];
}

function rewriteImageUrl(url: unknown): unknown {
  if (typeof url !== "string") return url;
  return url.replace(/^https?:\/\/localhost:\d+\//i, "/");
}

function rewriteImageObject(image: unknown): unknown {
  if (!image) return image;
  if (typeof image === "string") return rewriteImageUrl(image);
  if (typeof image !== "object") return image;

  const record = image as Record<string, unknown>;
  return {
    ...record,
    original: rewriteImageUrl(record.original),
    large: rewriteImageUrl(record.large),
    medium: rewriteImageUrl(record.medium),
    thumb: rewriteImageUrl(record.thumb),
    url: rewriteImageUrl(record.url),
    src: rewriteImageUrl(record.src),
  };
}

function resolveImageCandidate(image: unknown): unknown {
  if (typeof image === "string" && image.trim()) return rewriteImageUrl(image);
  if (!image || typeof image !== "object") return null;

  const record = image as Record<string, unknown>;
  for (const key of ["publishedOriginal", "original", "url", "src", "medium", "large", "thumb"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return rewriteImageUrl(value);
  }

  return null;
}

function getWebsiteImageCandidates(
  websiteImageMap: unknown,
  websiteId?: string,
): unknown[] {
  if (!websiteImageMap || typeof websiteImageMap !== "object" || Array.isArray(websiteImageMap)) {
    return [];
  }

  const record = websiteImageMap as Record<string, unknown>;
  const normalizedWebsiteId = normalizeWebsiteId(websiteId);
  const explicitCandidate = normalizedWebsiteId
    ? Object.entries(record).find(([key]) => normalizeWebsiteId(key) === normalizedWebsiteId)?.[1]
    : undefined;
  const fallbackCandidate = explicitCandidate
    ?? record.default
    ?? record.site
    ?? Object.values(record).find((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));

  return mapImages(fallbackCandidate);
}

function getExplicitAvailability(entry: Record<string, unknown>): boolean | null {
  const candidates = [
    entry.available,
    entry.inStock,
    entry.in_stock,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "boolean") return candidate;
  }
  return null;
}

export function computeAvailability(entry: Record<string, unknown>, sourceType: SyncedSourceType): boolean {
  if (entry.showOnWebsite === false) return false;

  const explicit = getExplicitAvailability(entry);
  if (explicit !== null) return explicit;

  const quantity = entry.quantity ?? entry.stock;
  if (quantity !== undefined && quantity !== null && quantity !== "") {
    return toFiniteNumber(quantity) > 0;
  }

  return sourceType === "service" || sourceType === "build";
}

export function getCollectionIds(product: Record<string, unknown>, effectiveWebsiteId: string): string[] {
  const existingIds = Array.isArray(product.websiteIds)
    ? product.websiteIds.map((id) => String(id).trim()).filter(Boolean)
    : typeof product.websiteId === "string" && product.websiteId.trim()
      ? [product.websiteId.trim()]
      : [];

  if (effectiveWebsiteId && !existingIds.some((id) => normalizeWebsiteId(id) === effectiveWebsiteId)) {
    existingIds.push(effectiveWebsiteId);
  }

  return Array.from(new Set(existingIds));
}

export async function readStockStore(): Promise<SyncedStockEntry[]> {
  try {
    const raw = await fs.readFile(stockStorePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as SyncedStockEntry[];
    }
  } catch {
    // Fall through to the live desktop fallback below.
  }

  const liveProducts = await fetchLiveDesktopStock();
  if (liveProducts.length > 0) {
    await writeStockStore(liveProducts);
  }
  return liveProducts;
}

export async function writeStockStore(products: SyncedStockEntry[]) {
  await fs.mkdir(path.dirname(stockStorePath), { recursive: true });
  await fs.writeFile(stockStorePath, JSON.stringify(products, null, 2), "utf-8");
}

export async function refreshStockProducts() {
  const liveProducts = await fetchLiveDesktopStock();
  if (liveProducts.length > 0) {
    await writeStockStore(liveProducts);
  }
}

function inferSourceType(product: Record<string, unknown>): SyncedSourceType {
  const rawType = normalizeLabel(
    product.type
    ?? product.productType
    ?? product.buildType
    ?? product.serviceType
    ?? product._sourceType,
  ).toLowerCase();

  if (
    rawType === "build"
    || rawType === "build_product"
    || Array.isArray(product.optionGroups)
  ) {
    return "build";
  }

  if (
    rawType === "service"
    || rawType === "stock_service"
    || product.bookingRequired === true
    || product.fulfillmentType === "job"
  ) {
    return "service";
  }

  return "product";
}

function pickLiveProducts(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : null;
  const collections = [
    record.products,
    record.stockProducts,
    record.stockBuilds,
    record.builds,
    record.stockServices,
    record.stockServiceProducts,
    record.serviceProducts,
    record.items,
    record.stock_items,
    data?.products,
    data?.stockProducts,
    data?.stockBuilds,
    data?.builds,
    data?.stockServices,
    data?.stockServiceProducts,
    data?.serviceProducts,
    data?.items,
  ];

  return collections
    .flatMap((collection) => (Array.isArray(collection) ? collection : []))
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}

async function fetchLiveDesktopStock(): Promise<SyncedStockEntry[]> {
  try {
    const { desktopBaseUrl } = getDesktopSyncConfig();
    const liveUrl = new URL("/api/ecommerce/stock", desktopBaseUrl);
    if (defaultWebsiteId) {
      liveUrl.searchParams.set("websiteId", defaultWebsiteId);
    }

    const response = await fetch(liveUrl, {
      headers: {
        accept: "application/json",
        ...getDesktopAuthHeaders(),
      },
    });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const products = pickLiveProducts(payload);

    return products
      .map((product, index) =>
        normalizeIncomingStockProduct(
          product,
          inferSourceType(product),
          defaultWebsiteId,
          undefined,
          index + 1,
        ),
      )
      .filter((product): product is SyncedStockEntry => Boolean(product));
  } catch {
    return [];
  }
}

export function normalizeIncomingStockProduct(
  product: Record<string, unknown>,
  sourceType: SyncedSourceType,
  effectiveWebsiteId: string,
  existing?: SyncedStockEntry,
  nextId?: number,
): SyncedStockEntry | null {
  const externalId = pickExternalId(product);
  if (!externalId) return null;

  const websiteIds = getCollectionIds(product, effectiveWebsiteId);
  const now = new Date().toISOString();

  return {
    ...existing,
    ...product,
    id: existing?.id ?? nextId ?? 0,
    externalId,
    websiteIds,
    _sourceType: sourceType,
    _syncKey: `${sourceType}:${externalId}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function mapEntryToCatalogProduct(entry: SyncedStockEntry): CatalogProduct {
  return {
    id: entry.id,
    name: normalizeLabel(entry.name) || "Untitled Item",
    description: normalizeLabel(entry.description) || null,
    price: toFiniteNumber(
      entry.displayPrice
      ?? entry.price
      ?? entry.sellPrice
      ?? entry.unitPrice
      ?? entry.sell_price
      ?? entry.unit_price,
      0,
    ),
    type: entry._sourceType,
    available: computeAvailability(entry, entry._sourceType),
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
  };
}

export function mapEntryToStockResponse(entry: SyncedStockEntry, websiteId?: string) {
  const websiteImages = getWebsiteImageCandidates(entry.websiteImageMap, websiteId);

  const rawImages = Array.isArray(entry.images) && entry.images.length > 0
    ? entry.images
    : mapImages(entry.image);
  const images = rawImages.length
    ? rawImages.filter(Boolean).map(rewriteImageObject)
    : websiteImages.filter(Boolean).map(rewriteImageObject);

  let shippingPresets: { label: string; price: number }[] | undefined = undefined;
  if (Array.isArray(entry.shippingPresets)) {
    shippingPresets = (entry.shippingPresets as any[]).map((p: any) => ({
      label: String(p.label ?? p.name ?? "Shipping"),
      price: Number(p.price ?? p.shippingPrice ?? p.shippingFee ?? 0)
    }));
  } else if (Array.isArray(entry.shippingOptions)) {
    shippingPresets = (entry.shippingOptions as any[]).map((opt: any) => ({
      label: String(opt.name ?? opt.service ?? opt.carrier ?? "Shipping"),
      price: Number(opt.shippingPrice ?? opt.shippingFee ?? opt.fixedPrice ?? opt.freightPrice ?? 0)
    }));
  } else if (entry.shippingMethod && (entry.shippingPrice !== undefined || entry.shippingFee !== undefined)) {
    shippingPresets = [{
      label: String(entry.shippingMethod),
      price: Number(entry.shippingPrice ?? entry.shippingFee ?? 0)
    }];
  }

  return {
    ...entry,
    id: entry.id,
    productType: entry._sourceType,
    type: entry._sourceType,
    price: toFiniteNumber(
      entry.displayPrice
      ?? entry.price
      ?? entry.sellPrice
      ?? entry.unitPrice
      ?? entry.sell_price
      ?? entry.unit_price,
      0,
    ),
    available: computeAvailability(entry, entry._sourceType),
    inStock: computeAvailability(entry, entry._sourceType),
    images,
    image: resolveImageCandidate(images[0]) ?? resolveImageCandidate(entry.image) ?? resolveImageCandidate(websiteImages[0]),
    shippingPresets,
  };
}
