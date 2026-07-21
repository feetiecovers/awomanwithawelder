import { forwardOrderToDesktop, getDesktopSyncConfig, type OrderForwardLineItem } from "./lib/desktopSync";
import { getStripeCredentials, getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { refreshStockProducts } from "./lib/syncedStock";

function splitFullName(fullName = "") {
  const safeFullName = String(fullName || "").trim();
  if (!safeFullName) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const parts = safeFullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", fullName: safeFullName };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: safeFullName,
  };
}

function toNumber(value: unknown) {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMetadataItems(raw: unknown): OrderForwardLineItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => {
      const isLegacy = item?.productId !== undefined || item?.sku !== undefined || item?.id !== undefined;
      const quantity = Math.max(1, toNumber(isLegacy ? item?.quantity : item?.q) || 1);
      const unitPrice = toNumber(isLegacy ? (item?.unitPrice ?? item?.price) : item?.p);
      return {
        id: String(isLegacy ? (item?.id ?? `line-${index}`) : (item?.i ?? `line-${index}`)),
        productId: isLegacy ? (item?.productId ?? item?.id ?? `product-${index}`) : (item?.i ?? `product-${index}`),
        sku: (isLegacy ? item?.sku : item?.s) !== undefined && (isLegacy ? item?.sku : item?.s) !== null ? String(isLegacy ? item.sku : item.s) : null,
        description: String(item?.description ?? item?.name ?? `Item ${index + 1}`),
        quantity,
        unitPrice,
        total: toNumber(isLegacy ? item?.total : (item?.q * item?.p)) || unitPrice * quantity,
        itemType: (isLegacy ? item?.itemType : item?.t) === "service" ? "service" : "product",
      };
    });
  } catch {
    return [];
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "This usually means express.json() parsed the body before reaching this handler. " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    const stripe = await getUncachableStripeClient();
    const { webhookSecret } = await getStripeCredentials();
    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is missing");
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    if (event.type !== "checkout.session.completed") {
      return;
    }

    const session = (await stripe.checkout.sessions.retrieve(event.data.object.id, {
      expand: ["line_items", "payment_intent"],
    })) as any;

    const paymentIntent = typeof session.payment_intent === "object" && session.payment_intent !== null
      ? session.payment_intent
      : null;
    const paymentIntentShipping = paymentIntent?.shipping?.address || {};
    const shippingAddress = session.shipping_details?.address || paymentIntentShipping || {};
    const customerAddress = session.customer_details?.address || paymentIntentShipping || {};
    const customerNameParts = splitFullName(
      session.shipping_details?.name ||
      session.customer_details?.name ||
      String(session.metadata?.customerName || ""),
    );

    const lineItemsFromMetadata = parseMetadataItems(session.metadata?.items);
    const lineItems = lineItemsFromMetadata.length > 0
      ? lineItemsFromMetadata
      : (session.line_items?.data || []).map((lineItem: any, index: number) => {
          const quantity = Math.max(1, lineItem.quantity || 1);
          const unitPrice = (lineItem.price?.unit_amount || 0) / 100;
          return {
            id: lineItem.id,
            productId: lineItem.price?.product || lineItem.description || `product-${index}`,
            description: lineItem.description || `Item ${index + 1}`,
            quantity,
            unitPrice,
            total: unitPrice * quantity,
            itemType: "product" as const,
            sku: null,
          };
        });

    const amountTotal = session.amount_total ? session.amount_total / 100 : 0;
    const shippingTotal = toNumber(session.metadata?.shippingTotal) || 0;
    const { websiteId: defaultWebsiteId, brandName: defaultBrandName } = getDesktopSyncConfig();
    const customerName = customerNameParts.fullName;
    const customerEmail = session.customer_details?.email || String(session.metadata?.customerEmail || "");
    const customerPhone = session.customer_details?.phone || String(session.metadata?.customerPhone || "");
    const customerAddress1 = String(session.metadata?.customerAddress1 || shippingAddress.line1 || customerAddress.line1 || "");
    const customerAddress2 = String(session.metadata?.customerAddress2 || shippingAddress.line2 || customerAddress.line2 || "");
    const customerCity = String(session.metadata?.customerCity || shippingAddress.city || customerAddress.city || "");
    const customerRegion = String(session.metadata?.customerRegion || shippingAddress.state || customerAddress.state || "");
    const customerPostcode = String(session.metadata?.customerPostcode || shippingAddress.postal_code || customerAddress.postal_code || "");
    const customerCountry = String(session.metadata?.customerCountry || shippingAddress.country || customerAddress.country || "");

    const orderObject = {
      id: `order_${session.id}`,
      websiteId: String(session.metadata?.websiteId || defaultWebsiteId),
      stripeSessionId: session.id,
      customerName,
      customerFirstName: customerNameParts.firstName,
      customerLastName: customerNameParts.lastName,
      customerEmail,
      customerPhone,
      customerAddress1,
      customerAddress2,
      customerCity,
      customerRegion,
      customerPostcode,
      customerCountry,
      shippingAddressText: [customerAddress1, customerAddress2, customerCity, customerRegion, customerPostcode, customerCountry].filter(Boolean).join(", "),
      shipping_address_text: [customerAddress1, customerAddress2, customerCity, customerRegion, customerPostcode, customerCountry].filter(Boolean).join(", "),
      shippingAddress: {
        line1: customerAddress1,
        line2: customerAddress2,
        city: customerCity,
        state: customerRegion,
        postal_code: customerPostcode,
        country: customerCountry,
      },
      shipping_address: {
        line1: customerAddress1,
        line2: customerAddress2,
        city: customerCity,
        state: customerRegion,
        postal_code: customerPostcode,
        country: customerCountry,
      },
      amountTotal,
      amountTotalCents: session.amount_total || 0,
      shipping: shippingTotal,
      shippingCost: shippingTotal,
      shipping_cost: shippingTotal,
      shippingTotal: shippingTotal,
      total: amountTotal,
      currency: session.currency?.toUpperCase() || "NZD",
      paymentStatus: session.payment_status,
      timestamp: new Date().toISOString(),
      memberRegistered: String(session.metadata?.memberRegistered || "false") === "true",
      memberUserId: String(session.metadata?.memberUserId || ""),
      memberName: String(session.metadata?.memberName || ""),
      memberEmail: String(session.metadata?.memberEmail || ""),
      brandName: String(session.metadata?.brandName || defaultBrandName),
      brandDetails: String(session.metadata?.brandDetails || defaultBrandName),
      lineItems,
      items: lineItems.map((item: any) => ({
        productId: item.productId,
        productTitle: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.total,
        sku: item.sku || "",
      })),
      source: "stripe",
      metadata: session.metadata || {},
      deferStockDeduction: true,
    };

    await forwardOrderToDesktop(orderObject);
    await refreshStockProducts();
  }
}
