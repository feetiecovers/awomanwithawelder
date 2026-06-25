import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListProductsResponseItem, GetProductParams } from "@workspace/api-zod";

const router = Router();

router.get("/products", async (req, res) => {
  try {
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
