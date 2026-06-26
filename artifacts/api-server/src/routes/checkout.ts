import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

router.post("/checkout", async (req: any, res) => {
  const cart: { productId: number; quantity: number }[] = req.session.cart ?? [];

  if (cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  try {
    const productIds = cart.map(i => i.productId);
    const productList = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    const productMap = new Map(productList.map(p => [p.id, p]));

    const lineItems = cart
      .map(item => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        return {
          price_data: {
            currency: "nzd",
            unit_amount: Math.round(parseFloat(product.price) * 100),
            product_data: {
              name: product.name,
              ...(product.description ? { description: product.description } : {}),
            },
          },
          quantity: item.quantity,
        };
      })
      .filter(Boolean);

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "No valid cart items" });
    }

    const stripe = await getUncachableStripeClient();

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = domains ? `https://${domains}` : `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems as Parameters<typeof stripe.checkout.sessions.create>[0]["line_items"],
      mode: "payment",
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    req.log.error({ error: error.message }, "Checkout session creation failed");
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

router.delete("/cart/all", async (req: any, res) => {
  req.session.cart = [];
  res.json({ items: [], total: 0 });
});

export default router;
