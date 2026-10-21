const SHARED_IMAGE_BASE_URL = "https://denver-s-desk.onrender.com";

export type ProductImageVariant = "original" | "large" | "medium" | "thumb";

const VARIANT_KEYS: Record<ProductImageVariant, string[]> = {
  original: ["publishedOriginal", "original", "url", "src", "publishedLarge", "large", "publishedMedium", "medium", "thumb"],
  large: ["publishedLarge", "large", "publishedMedium", "medium", "publishedOriginal", "original", "url", "src", "thumb"],
  medium: ["publishedMedium", "medium", "publishedLarge", "large", "publishedOriginal", "original", "url", "src", "thumb"],
  thumb: ["publishedThumb", "thumb", "publishedMedium", "medium", "publishedOriginal", "original", "url", "src"],
};

export function normalizeImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("/assets/") || trimmed.startsWith("assets/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  if (/^https?:\/\/localhost:\d+\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}/${trimmed.replace(/^https?:\/\/localhost:\d+\//i, "")}`;
  }

  if (/^\/(?:api\/)?images\/products\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}${trimmed}`;
  }

  if (/^images\/products\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}/${trimmed}`;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${SHARED_IMAGE_BASE_URL}${trimmed}`;
  }

  return trimmed;
}

export function resolveImageCandidate(candidate: unknown, variant: ProductImageVariant = "original"): string {
  if (typeof candidate === "string") return normalizeImageUrl(candidate);
  if (!candidate || typeof candidate !== "object") return "";

  const record = candidate as Record<string, unknown>;
  for (const key of VARIANT_KEYS[variant]) {
    const resolved = normalizeImageUrl(record[key]);
    if (resolved) return resolved;
  }

  return "";
}

export function getProductImages(record: Record<string, unknown> | null | undefined, variant: ProductImageVariant = "original"): string[] {
  if (!record || typeof record !== "object") return [];

  const rawImages = Array.isArray(record.images) && record.images.length > 0
    ? record.images
    : [record.image, record.imageUrl, record.image_url, (record as any).defaultImageUrl, (record as any).default_image_url];

  const urls = rawImages
    .map((candidate) => resolveImageCandidate(candidate, variant))
    .filter(Boolean);

  return Array.from(new Set(urls));
}
