import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddToCartBody, RemoveFromCartParams } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    cart: { productId: number; quantity: number }[];
    memberId?: number;
  }
}

const router = Router();

async function buildCartResponse(cartItems: { productId: number; quantity: number }[]) {
  if (cartItems.length === 0) return { items: [], total: 0 };

  const productIds = cartItems.map(i => i.productId);
  const products = await db.select().from(productsTable);
  const productMap = new Map(products.map(p => [p.id, p]));

  const items = cartItems
    .map(item => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: {
          ...product,
          price: parseFloat(product.price),
          createdAt: product.createdAt.toISOString(),
        },
      };
    })
    .filter(Boolean);

  const total = items.reduce((sum, item) => {
    if (!item) return sum;
    return sum + (item.product.price * item.quantity);
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

    const existing = req.session.cart.find(i => i.productId === parsed.data.productId);
    if (existing) {
      existing.quantity += parsed.data.quantity;
    } else {
      req.session.cart.push({ productId: parsed.data.productId, quantity: parsed.data.quantity });
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
