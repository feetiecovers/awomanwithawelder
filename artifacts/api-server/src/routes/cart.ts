import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { AddToCartBody, RemoveFromCartParams } from "@workspace/api-zod";
import { mapEntryToCatalogProduct, readStockStore, type CatalogProduct } from "../lib/syncedStock";

declare module "express-session" {
  interface SessionData {
    cart: { productId: number; quantity: number; shippingLabel?: string; shippingPrice?: number }[];
    memberId?: number;
  }
}

const router = Router();

async function buildCartResponse(cartItems: { productId: number; quantity: number; shippingLabel?: string; shippingPrice?: number }[]) {
  if (cartItems.length === 0) return { items: [], total: 0 };

  const syncedProducts = (await readStockStore())
    .filter((entry) => entry.showOnWebsite !== false)
    .map(mapEntryToCatalogProduct);
  const syncedMap = new Map(syncedProducts.map((product) => [product.id, product]));

  const dbProducts = syncedProducts.length === 0
    ? await db.select().from(productsTable)
    : [];
  const productMap = new Map<number, CatalogProduct>();
  for (const product of dbProducts) {
    productMap.set(product.id, {
      ...product,
      price: parseFloat(product.price),
      createdAt: product.createdAt.toISOString(),
    });
  }
  for (const [id, product] of syncedMap) {
    productMap.set(id, product);
  }

  const items = cartItems
    .map(item => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return {
        productId: item.productId,
        quantity: item.quantity,
        shippingLabel: item.shippingLabel,
        shippingPrice: item.shippingPrice,
        product,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const total = items.reduce((sum, item) => {
    if (!item) return sum;
    const basePrice = item.product.price;
    const shipping = item.shippingPrice ?? 0;
    return sum + ((basePrice + shipping) * item.quantity);
  }, 0);

  return { items, total };
}

router.get("/cart", async (req, res) => {
  try {
    const cart = req.session.cart ?? [];
    const response = await buildCartResponse(cart);
    return res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to get cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cart", async (req, res) => {
  try {
    const parsed = AddToCartBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(i => i.productId === parsed.data.productId && i.shippingLabel === parsed.data.shippingLabel);
    if (existing) {
      existing.quantity += parsed.data.quantity;
    } else {
      req.session.cart.push({
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        shippingLabel: parsed.data.shippingLabel,
        shippingPrice: parsed.data.shippingPrice
      });
    }

    const response = await buildCartResponse(req.session.cart);
    return res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to add to cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cart/:productId", async (req, res) => {
  try {
    const parsed = RemoveFromCartParams.safeParse({ productId: parseInt(req.params.productId) });
    if (!parsed.success) return res.status(400).json({ error: "Invalid product ID" });

    if (!req.session.cart) req.session.cart = [];
    req.session.cart = req.session.cart.filter(i => i.productId !== parsed.data.productId);

    const response = await buildCartResponse(req.session.cart);
    return res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to remove from cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
