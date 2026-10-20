import { Router } from "express";
import { db, membersTable, productsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { mapEntryToCatalogProduct, readStockStore, type CatalogProduct } from "../lib/syncedStock";
import { getDesktopSyncConfig } from "../lib/desktopSync";

const router = Router();
const hasDatabase = Boolean(process.env.DATABASE_URL);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getFrontendBaseUrl(req: any): string {
  const configuredBaseUrl = String(process.env.FRONTEND_BASE_URL || "").trim();
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      return trimTrailingSlash(new URL(referer).origin);
    } catch {}
  }

  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) {
    return `https://${domains}`;
  }

  return `${req.protocol}://${req.get("host")}`;
}

router.post("/checkout", async (req: any, res) => {
  const directItems = req.body?.items?.length
    ? req.body.items
    : req.body?.directItem
    ? [req.body.directItem]
    : null;
  const cart: { productId: number; quantity: number; shippingLabel?: string; shippingPrice?: number; configuration?: any }[] =
    directItems ?? req.session.cart ?? [];

  if (cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  try {
    const productIds = cart.map(i => i.productId);
    const syncedEntries = (await readStockStore()).filter((entry) => entry.showOnWebsite !== false);
    const syncedProducts = syncedEntries.map(mapEntryToCatalogProduct);
    const productList = syncedProducts.length > 0
      ? syncedProducts.filter((product) => productIds.includes(product.id))
      : hasDatabase
        ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
        : [];
    const productMap = new Map<number, CatalogProduct>(
      productList.map((product) => [
        product.id,
        "createdAt" in product
          ? {
              id: product.id,
              name: product.name,
              description: product.description ?? null,
              price: Number(product.price),
              type: product.type,
              available: product.available,
              createdAt: typeof product.createdAt === "string"
                ? product.createdAt
                : product.createdAt.toISOString(),
            }
          : product,
      ]),
    );
    const syncedEntryMap = new Map(syncedEntries.map((entry) => [entry.id, entry]));

    const totalShipping = cart.reduce((sum, item) => sum + (item.shippingPrice ?? 0) * item.quantity, 0);

    const lineItems: any[] = [];
    for (const item of cart) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const syncedEntry = syncedEntryMap.get(item.productId);
      const itemPrice = Number(product.price);
      const configAdj = Number((item as any).configuration?.totalPriceAdjustment || 0);
      const resolvedPrice = (item as any).configuration?.resolvedPrice;
      const finalPrice = resolvedPrice !== undefined ? Number(resolvedPrice) : (itemPrice + configAdj);
      const config = (item as any).configuration;

      // Check if item is a custom build with individual build features to sell
      if (config?.type === "build" && Array.isArray(config?.buildFeatures) && config.buildFeatures.length > 0) {
        const buildFeatures: Array<{ groupName: string; optionName: string; price?: number; description?: string }> = config.buildFeatures;
        const pricedFeatures = buildFeatures.filter(f => Number(f.price || 0) > 0);
        const pricedFeaturesSum = pricedFeatures.reduce((sum, f) => sum + Number(f.price || 0), 0);
        const parametricPrice = Number(config.parametricPrice || 0);
        
        // Base beam / axle assembly price
        const beamPrice = parametricPrice > 0 
          ? parametricPrice 
          : Math.max(0, finalPrice - pricedFeaturesSum);

        const includedZeroFeatures = buildFeatures
          .filter(f => !f.price || Number(f.price) <= 0)
          .map(f => `${f.groupName}: ${f.optionName}`)
          .join(", ");

        if (beamPrice > 0) {
          lineItems.push({
            price_data: {
              currency: "nzd",
              unit_amount: Math.round(beamPrice * 100),
              product_data: {
                name: `${config.buildName || product.name} - ${config.parametricSummary || 'Beam Assembly'}`,
                description: includedZeroFeatures ? `Includes: ${includedZeroFeatures}` : "Custom fabricated track width",
              },
            },
            quantity: item.quantity,
          });
        }

        // Output each individual build feature as its own line item
        for (const feat of pricedFeatures) {
          lineItems.push({
            price_data: {
              currency: "nzd",
              unit_amount: Math.round(Number(feat.price) * 100),
              product_data: {
                name: `${feat.groupName}: ${feat.optionName}`,
                description: feat.description || `Build component for ${config.buildName || product.name}`,
              },
            },
            quantity: item.quantity,
          });
        }
      } else {
        // Standard product or single-line configurable
        lineItems.push({
          price_data: {
            currency: "nzd",
            unit_amount: Math.round(finalPrice * 100),
            product_data: {
              name: product.name,
              metadata: {
                sku: typeof syncedEntry?.sku === "string" ? syncedEntry.sku : "",
                productId: String(syncedEntry?.externalId ?? item.productId),
                configuration: (item as any).configuration ? JSON.stringify({
                  selections: (item as any).configuration.selections,
                  selectedOptionIds: (item as any).configuration.selectedOptionIds,
                  totalPriceAdjustment: (item as any).configuration.totalPriceAdjustment
                }).substring(0, 500) : "",
              },
            },
          },
          quantity: item.quantity,
        });
      }
    }

    if (totalShipping > 0) {
      lineItems.push({
        price_data: {
          currency: "nzd",
          unit_amount: Math.round(totalShipping * 100),
          product_data: {
            name: "Shipping & Delivery",
            description: "Shipping fee for your order",
          },
        },
        quantity: 1,
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "No valid cart items" });
    }

    const stripe = await getUncachableStripeClient();
    const { websiteId, brandName } = getDesktopSyncConfig();
    const baseUrl = getFrontendBaseUrl(req);

    const [member] = hasDatabase && req.session.memberId
      ? await db.select().from(membersTable).where(inArray(membersTable.id, [req.session.memberId]))
      : [];
    const directCustomerEmail = typeof req.body?.customerEmail === "string" && req.body.customerEmail.includes("@")
      ? req.body.customerEmail.trim()
      : undefined;
    const metadataItems = cart.map((item) => {
      const product = productMap.get(item.productId);
      const syncedEntry = syncedEntryMap.get(item.productId);
      const unitPrice = Number(product?.price ?? 0);
      const configAdj = Number((item as any).configuration?.totalPriceAdjustment || 0);
      const resolvedPrice = (item as any).configuration?.resolvedPrice;
      const finalUnitPrice = resolvedPrice !== undefined ? Number(resolvedPrice) : (unitPrice + configAdj);
      const itemName = product?.name ?? `Product ${item.productId}`;
      return {
        id: String(item.productId),
        productId: syncedEntry?.externalId ?? item.productId,
        sku: typeof syncedEntry?.sku === "string" ? syncedEntry.sku : null,
        name: itemName,
        description: product?.description ?? itemName,
        quantity: item.quantity,
        unitPrice: finalUnitPrice,
        total: finalUnitPrice * item.quantity,
        itemType: product?.type === "service" ? "service" : "product",
        configuration: (item as any).configuration ?? undefined,
      };
    });

    const hasPhysicalProduct = metadataItems.some((item) => item.itemType === "product");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems as any,
      mode: "payment",
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancel`,
      customer_email: directCustomerEmail || member?.email || undefined,
      billing_address_collection: "required",
      phone_number_collection: {
        enabled: true,
      },
      ...(hasPhysicalProduct
        ? {
            shipping_address_collection: {
              allowed_countries: ["NZ"],
            },
          }
        : {}),
      metadata: {
        websiteId,
        brandName,
        brandDetails: brandName,
        memberRegistered: String(Boolean(member)),
        memberUserId: member ? String(member.id) : "",
        memberName: (typeof req.body?.customerName === "string" ? req.body.customerName : member?.name) || "",
        memberEmail: directCustomerEmail || member?.email || "",
        shippingTotal: String(totalShipping),
        items: JSON.stringify(
          metadataItems.map((item) => ({
            i: item.productId,
            s: item.sku,
            q: item.quantity,
            p: item.unitPrice,
            t: item.itemType === "service" ? "service" : undefined,
          }))
        ),
      },
    });

    res.json({ url: session.url });
    return;
  } catch (error: any) {
    req.log.error({ error: error.message }, "Checkout session creation failed");
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
    return;
  }
});

router.delete("/cart/all", async (req: any, res) => {
  req.session.cart = [];
  res.json({ items: [], total: 0 });
});

export default router;
