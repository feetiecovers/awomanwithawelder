import { Router, type Request } from "express";
import {
  mapEntryToStockResponse,
  pickExternalId,
  normalizeIncomingStockProduct,
  normalizeWebsiteId,
  readStockStore,
  writeStockStore,
  type SyncedStockEntry,
  type SyncedSourceType,
} from "../lib/syncedStock";

const router = Router();

function inferSourceType(item: Record<string, unknown>): SyncedSourceType {
  const rawType = String(
    item.type
    ?? item.productType
    ?? item.buildType
    ?? item.serviceType
    ?? item._sourceType
    ?? "",
  ).trim().toLowerCase();

  if (
    rawType === "build"
    || rawType === "build_product"
    || Array.isArray(item.optionGroups)
  ) {
    return "build";
  }

  if (
    rawType === "service"
    || rawType === "stock_service"
    || item.bookingRequired === true
    || item.fulfillmentType === "job"
  ) {
    return "service";
  }

  return "product";
}

function pickIncomingProducts(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  const data = payload.data && typeof payload.data === "object"
    ? payload.data as Record<string, unknown>
    : null;
  const collections = [
    payload.products,
    payload.stockProducts,
    payload.stockBuilds,
    payload.builds,
    payload.stockServices,
    payload.stockServiceProducts,
    payload.serviceProducts,
    payload.items,
    payload.stock_items,
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

function getEffectiveWebsiteId(req: Request, payload?: Record<string, unknown>): string {
  const queryWebsiteId = normalizeWebsiteId(
    req.query.websiteId ?? req.query.website ?? req.query.siteId ?? req.query.site,
  );
  const bodyWebsiteId = normalizeWebsiteId(
    payload?.websiteId ?? payload?.website ?? payload?.siteId ?? payload?.site,
  );
  return queryWebsiteId || bodyWebsiteId;
}

function attachPurchaseModeDefinitions(
  stockProducts: unknown,
  configurableProducts: unknown,
  parametricProducts: unknown,
): Record<string, unknown>[] {
  const configurable = Array.isArray(configurableProducts) ? configurableProducts : [];
  const parametric = Array.isArray(parametricProducts) ? parametricProducts : [];
  const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  return (Array.isArray(stockProducts) ? stockProducts : [])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((product) => {
      const productId = normalizeId(product.id ?? product.productId ?? product.externalId);
      const authoredModes = [
        ...configurable
          .filter((definition: any) => normalizeId(definition?.commercialProductId ?? definition?.baseStockProductId) === productId)
          .map((definition: any) => ({ ...definition, purchaseMode: "configurable" })),
        ...parametric
          .filter((definition: any) => normalizeId(definition?.commercialProductId ?? definition?.baseStockProductId) === productId)
          .map((definition: any) => ({ ...definition, purchaseMode: "parametric" })),
      ];
      const existingModes = Array.isArray(product.purchaseModes) ? product.purchaseModes : [];
      const modesByName = new Map<string, Record<string, unknown>>();
      for (const mode of [...existingModes, ...authoredModes]) {
        if (!mode || typeof mode !== "object") continue;
        const record = mode as Record<string, unknown>;
        const modeName = String(record.purchaseMode ?? record.mode ?? "").trim().toLowerCase();
        if (!modeName) continue;
        modesByName.set(modeName, { ...record, purchaseMode: modeName });
      }
      if (!modesByName.has("standard")) {
        modesByName.set("standard", { purchaseMode: "standard", id: product.id });
      }

      return {
        ...product,
        purchaseModes: Array.from(modesByName.values()),
        availablePurchaseModes: Array.from(modesByName.keys()),
      };
    });
}

function normalizeIncomingCollection(
  collection: unknown,
  sourceType: SyncedSourceType,
  effectiveWebsiteId: string,
  existingByKey: Map<string, SyncedStockEntry>,
  nextIdRef: { value: number },
): SyncedStockEntry[] {
  return (Array.isArray(collection) ? collection : [])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const externalId = pickExternalId(item);
      const key = `${sourceType}:${externalId}`;
      const existing = existingByKey.get(key);
      return normalizeIncomingStockProduct(
        item,
        sourceType,
        effectiveWebsiteId,
        existing,
        existing ? undefined : ++nextIdRef.value,
      );
    })
    .filter((item): item is SyncedStockEntry => Boolean(item));
}

router.post("/ecommerce/stock", async (req, res): Promise<void> => {
  const clientToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || req.headers["x-api-key"] || "";
  const expectedToken = process.env.DESKTOP_APP_AUTH_TOKEN;
  if (expectedToken && clientToken !== expectedToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = (req.body ?? {}) as Record<string, unknown>;
  const effectiveWebsiteId = getEffectiveWebsiteId(req, payload);
  const incomingProducts = pickIncomingProducts(payload);
  const incomingProductEntries = incomingProducts.filter((item) => inferSourceType(item) === "product");
  const incomingBuildEntries = incomingProducts.filter((item) => inferSourceType(item) === "build");
  const incomingServiceEntries = incomingProducts.filter((item) => inferSourceType(item) === "service");
  const stockProducts = Array.isArray(payload.stockProducts)
    ? payload.stockProducts
    : incomingProductEntries;
  const configurableProducts = Array.isArray(payload.configurableProducts) ? payload.configurableProducts : [];
  const parametricProducts = Array.isArray(payload.parametricProducts) ? payload.parametricProducts : [];
  const enrichedStockProducts = attachPurchaseModeDefinitions(stockProducts, configurableProducts, parametricProducts);
  const stockBuilds = Array.isArray(payload.stockBuilds)
    ? payload.stockBuilds
    : Array.isArray(payload.builds)
      ? payload.builds
      : incomingBuildEntries;
  const stockServiceProducts = Array.isArray(payload.stockServiceProducts)
    ? payload.stockServiceProducts
    : Array.isArray(payload.stockServices)
      ? payload.stockServices
    : Array.isArray(payload.serviceProducts)
      ? payload.serviceProducts
      : incomingServiceEntries;

  req.log.info({
    effectiveWebsiteId,
    bodyType: Array.isArray(req.body) ? "array" : typeof req.body,
    payloadKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 20) : [],
    incomingProducts: incomingProducts.length,
    stockProducts: enrichedStockProducts.length,
    configurableProducts: configurableProducts.length,
    parametricProducts: parametricProducts.length,
    stockBuilds: Array.isArray(stockBuilds) ? stockBuilds.length : 0,
    stockServiceProducts: Array.isArray(stockServiceProducts) ? stockServiceProducts.length : 0,
  }, "Received ecommerce stock payload");

  const existingProducts = await readStockStore();
  const existingByKey = new Map(existingProducts.map((product) => [product._syncKey, product]));
  const nextIdRef = {
    value: existingProducts.reduce((max, product) => Math.max(max, product.id), 0),
  };

  const normalizedStockProducts = normalizeIncomingCollection(
    enrichedStockProducts,
    "product",
    effectiveWebsiteId,
    existingByKey,
    nextIdRef,
  );
  const normalizedBuildProducts = normalizeIncomingCollection(
    stockBuilds,
    "build",
    effectiveWebsiteId,
    existingByKey,
    nextIdRef,
  );
  const normalizedServiceProducts = normalizeIncomingCollection(
    stockServiceProducts,
    "service",
    effectiveWebsiteId,
    existingByKey,
    nextIdRef,
  );

  const authoritativeEmptyCatalog = payload.authoritativeWebsiteSync === true
    && Array.isArray(payload.stockProducts)
    && Array.isArray(payload.stockBuilds)
    && Array.isArray(payload.stockServices);
  if (normalizedStockProducts.length === 0 && normalizedBuildProducts.length === 0 && normalizedServiceProducts.length === 0 && !authoritativeEmptyCatalog) {
    req.log.warn({
      effectiveWebsiteId,
      payloadKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 20) : [],
      sample: Array.isArray(incomingProducts) && incomingProducts[0] ? Object.keys(incomingProducts[0]).slice(0, 20) : [],
    }, "Rejected ecommerce stock payload");
    res.status(400).json({ error: "Expected products, stockProducts, stockBuilds, builds, stockServiceProducts, or serviceProducts." });
    return;
  }

  for (const product of [...normalizedStockProducts, ...normalizedBuildProducts, ...normalizedServiceProducts]) {
    const existing = existingByKey.get(product._syncKey);
    existingByKey.set(product._syncKey, {
      ...(existing ?? {}),
      ...product,
      websiteIds: Array.from(
        new Set([
          ...((Array.isArray(existing?.websiteIds) ? existing.websiteIds : []) as string[]),
          ...(Array.isArray(product.websiteIds) ? product.websiteIds : []),
        ]),
      ),
    } as SyncedStockEntry);
  }

  if (effectiveWebsiteId) {
    const incomingKeysByType = new Map<SyncedSourceType, Set<string>>([
      ["product", new Set(normalizedStockProducts.map((product) => product._syncKey))],
      ["build", new Set(normalizedBuildProducts.map((product) => product._syncKey))],
      ["service", new Set(normalizedServiceProducts.map((product) => product._syncKey))],
    ]);

    for (const [key, existing] of existingByKey.entries()) {
      const websiteIds = Array.isArray(existing.websiteIds) ? existing.websiteIds : [];
      const matchesWebsite = websiteIds.some((id) => normalizeWebsiteId(id) === effectiveWebsiteId);
      if (!matchesWebsite) continue;

      const authoritativeWebsiteSync = payload.authoritativeWebsiteSync === true;
      const hasIncomingCollection = existing._sourceType === "product"
        ? (authoritativeWebsiteSync ? Array.isArray(payload.stockProducts) : enrichedStockProducts.length > 0)
        : existing._sourceType === "build"
          ? (authoritativeWebsiteSync ? Array.isArray(payload.stockBuilds) : Array.isArray(stockBuilds) && stockBuilds.length > 0)
        : (authoritativeWebsiteSync ? Array.isArray(payload.stockServices) : Array.isArray(stockServiceProducts) && stockServiceProducts.length > 0);
      if (!hasIncomingCollection) continue;

      if (!incomingKeysByType.get(existing._sourceType)?.has(key)) {
        existingByKey.delete(key);
      }
    }
  }

  await writeStockStore(Array.from(existingByKey.values()));
  req.log.info({
    effectiveWebsiteId,
    normalizedProducts: normalizedStockProducts.length,
    normalizedBuilds: normalizedBuildProducts.length,
    normalizedServices: normalizedServiceProducts.length,
    totalStored: existingByKey.size,
  }, "Stored ecommerce stock payload");
  res.json({ success: true });
});

router.get("/ecommerce/stock", async (req, res): Promise<void> => {
  const websiteId = normalizeWebsiteId(
    req.query.websiteId ?? req.query.website ?? req.query.siteId ?? req.query.site,
  );
  const storedProducts = await readStockStore();
  const filtered = storedProducts
    .filter((product) => product.showOnWebsite !== false)
    .filter((product) => {
      if (!websiteId) return true;
      const websiteIds = Array.isArray(product.websiteIds) ? product.websiteIds : [];
      if (websiteIds.length === 0) return true;
      return websiteIds.some((id) => normalizeWebsiteId(id) === websiteId);
    })
    .map((product) => mapEntryToStockResponse(product, websiteId));

  res.json(filtered);
});

router.get("/ecommerce/builds", async (req, res): Promise<void> => {
  const websiteId = normalizeWebsiteId(
    req.query.websiteId ?? req.query.website ?? req.query.siteId ?? req.query.site,
  );
  const storedProducts = await readStockStore();
  const filtered = storedProducts
    .filter((product) => product._sourceType === "build")
    .filter((product) => product.showOnWebsite !== false)
    .filter((product) => {
      if (!websiteId) return true;
      const websiteIds = Array.isArray(product.websiteIds) ? product.websiteIds : [];
      if (websiteIds.length === 0) return true;
      return websiteIds.some((id) => normalizeWebsiteId(id) === websiteId);
    })
    .map((product) => mapEntryToStockResponse(product, websiteId));

  res.json(filtered);
});

export default router;
