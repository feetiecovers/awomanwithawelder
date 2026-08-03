import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListProductsResponseItem, GetProductParams } from "@workspace/api-zod";
import { mapEntryToCatalogProduct, mapEntryToStockResponse, normalizeWebsiteId, readStockStore } from "../lib/syncedStock";

const router = Router();
const hasDatabase = Boolean(process.env.DATABASE_URL);
const defaultWebsiteId = process.env.WEBSITE_ID || "web-1782561404289";

router.get("/products", async (req, res) => {
  try {
    const websiteId = normalizeWebsiteId(
      req.query.websiteId ?? req.query.website ?? req.query.siteId ?? req.query.site ?? defaultWebsiteId,
    );
    const syncedProducts = (await readStockStore())
      .filter((entry) => entry._sourceType !== "build")
      .filter((entry) => entry.showOnWebsite !== false)
      .map((entry) => mapEntryToStockResponse(entry, websiteId));
    if (syncedProducts.length > 0) {
      return res.json(syncedProducts);
    }
    if (!hasDatabase) {
      return res.json([]);
    }

    const products = await db.select().from(productsTable).where(eq(productsTable.available, true));
    const result = products.map(p => ({
      ...p,
      price: parseFloat(p.price),
      createdAt: p.createdAt.toISOString(),
    }));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const parsed = GetProductParams.safeParse({ id: parseInt(req.params.id) });
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });
    const websiteId = normalizeWebsiteId(
      req.query.websiteId ?? req.query.website ?? req.query.siteId ?? req.query.site ?? defaultWebsiteId,
    );

    const syncedProduct = (await readStockStore())
      .filter((entry) => entry._sourceType !== "build")
      .filter((entry) => entry.showOnWebsite !== false)
      .map((entry) => mapEntryToStockResponse(entry, websiteId))
      .find((entry) => entry.id === parsed.data.id);
    if (syncedProduct) {
      return res.json(syncedProduct);
    }
    if (!hasDatabase) {
      return res.status(404).json({ error: "Not found" });
    }

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.id));
    if (!product) return res.status(404).json({ error: "Not found" });

    return res.json({
      ...product,
      price: parseFloat(product.price),
      createdAt: product.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
