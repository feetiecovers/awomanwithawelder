import { Router } from "express";
import { db, bookingsTable, membersTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";
import { mapEntryToCatalogProduct, readStockStore, refreshStockProducts } from "../lib/syncedStock";
import { forwardBookingToDesktop, forwardOrderToDesktop, getDesktopSyncConfig } from "../lib/desktopSync";

const router = Router();
const hasDatabase = Boolean(process.env.DATABASE_URL);

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.memberId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
}

router.get("/bookings", requireAuth, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.json([]);
    }
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.memberId, req.session.memberId!));
    return res.json(bookings.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const parsed = CreateBookingBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const memberId = hasDatabase ? (req.session?.memberId ?? null) : null;
    const bookingCustomer = {
      fullName: parsed.data.fullName?.trim() || null,
      address: parsed.data.address?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
    };
    const pricing = {
      serviceName: parsed.data.serviceName?.trim() || null,
      servicePrice: typeof parsed.data.servicePrice === "number" ? parsed.data.servicePrice : null,
      subtotal: typeof parsed.data.subtotal === "number" ? parsed.data.subtotal : null,
      gst: typeof parsed.data.gst === "number" ? parsed.data.gst : null,
      total: typeof parsed.data.total === "number" ? parsed.data.total : null,
    };

    const syncedEntries = (await readStockStore())
      .filter((entry) => entry.showOnWebsite !== false);
    const syncedServiceEntry = syncedEntries.find((entry) => entry.id === parsed.data.serviceId);
    const syncedService = syncedEntries
      .filter((entry) => entry.showOnWebsite !== false)
      .map(mapEntryToCatalogProduct)
      .find((entry) => entry.id === parsed.data.serviceId);
    const serviceBookingFields = Array.isArray((syncedServiceEntry as any)?.bookingFields)
      ? (syncedServiceEntry as any).bookingFields
      : [];
    const rawCustomFields = Array.isArray((req.body as any)?.customFields)
      ? (req.body as any).customFields
      : [];
    const rawCustomFieldMap = new Map(
      rawCustomFields.map((field: any) => [
        String(field?.fieldId ?? field?.id ?? "").trim(),
        field,
      ]),
    );
    const customFields = (serviceBookingFields.length > 0 ? serviceBookingFields : rawCustomFields)
      .map((field: any, index: number) => {
        const fieldId = String(field?.fieldId ?? field?.id ?? "").trim();
        const payload = rawCustomFieldMap.get(fieldId) ?? rawCustomFields[index] ?? {};
        const type = field?.type === "number" || field?.type === "select" || field?.type === "checkbox"
          ? field.type
          : "text";
        const value = typeof payload?.value === "string"
          ? payload.value
          : payload?.value == null
            ? ""
            : String(payload.value);
        const displayValue = type === "checkbox"
          ? value === "true"
            ? "Yes"
            : value === "false"
              ? "No"
              : ""
          : type === "select"
            ? (Array.isArray(field?.options) ? field.options : []).find((option: any) => option?.value === value)?.label ?? value
            : value;
        return {
          fieldId: fieldId || `booking-field-${index}`,
          label: String(field?.label ?? payload?.label ?? `Booking Field ${index + 1}`).trim(),
          type,
          value,
          displayValue,
        };
      })
      .filter((field: any) => field.fieldId && field.label);

    let dbService: {
      id: number;
      name: string;
      description: string | null;
      price: string;
      type: string;
      available: boolean;
    } | null = null;

    if (syncedService) {
      if (syncedService.type !== "service" || !syncedService.available) {
        return res.status(400).json({ error: "Service is not available" });
      }
    } else {
      if (!hasDatabase) {
        return res.status(400).json({ error: "Service is not available" });
      }
      const [service] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.serviceId));
      dbService = service ?? null;
      if (!dbService || dbService.type !== "service" || !dbService.available) {
        return res.status(400).json({ error: "Service is not available" });
      }
    }

    const notesSections = [
      parsed.data.notes?.trim() ? `Notes / Requests:\n${parsed.data.notes.trim()}` : null,
      customFields.length > 0
        ? [
            "Booking Request Fields:",
            ...customFields.map((field: any) => `${field.label}: ${field.displayValue || field.value || "-"}`),
          ].join("\n")
        : null,
      [
        bookingCustomer.fullName ? `Full Name: ${bookingCustomer.fullName}` : null,
        bookingCustomer.address ? `Address: ${bookingCustomer.address}` : null,
        bookingCustomer.phone ? `Phone: ${bookingCustomer.phone}` : null,
        bookingCustomer.email ? `Email: ${bookingCustomer.email}` : null,
      ].filter(Boolean).join("\n"),
      [
        pricing.serviceName ? `Service: ${pricing.serviceName}` : null,
        pricing.servicePrice !== null ? `Service Price: NZ$${pricing.servicePrice.toFixed(2)}` : null,
        pricing.subtotal !== null ? `Subtotal excl. GST: NZ$${pricing.subtotal.toFixed(2)}` : null,
        pricing.gst !== null ? `GST: NZ$${pricing.gst.toFixed(2)}` : null,
        pricing.total !== null ? `Estimated Total: NZ$${pricing.total.toFixed(2)}` : null,
      ].filter(Boolean).join("\n"),
    ].filter((section): section is string => Boolean(section && section.trim()));

    const bookingNotes = notesSections.length > 0 ? notesSections.join("\n\n") : null;

    const createdAt = new Date();
    const booking = hasDatabase
      ? (await db.insert(bookingsTable).values({
          memberId,
          serviceId: parsed.data.serviceId,
          preferredDate: parsed.data.preferredDate ?? null,
          notes: bookingNotes,
          status: "pending",
        }).returning())[0]
      : {
          id: Date.now(),
          memberId: null,
          serviceId: parsed.data.serviceId,
          preferredDate: parsed.data.preferredDate ?? null,
          notes: bookingNotes,
          status: "pending" as const,
          createdAt,
        };

    const [member] = hasDatabase && memberId
      ? await db.select().from(membersTable).where(eq(membersTable.id, memberId))
      : [];
    const servicePayload = syncedService
      ? {
          id: syncedService.id,
          externalId: syncedServiceEntry?.externalId ?? null,
          name: syncedService.name,
          description: syncedService.description,
          price: syncedService.price,
          subtotal: pricing.subtotal,
          gst: pricing.gst,
          total: pricing.total,
        }
      : dbService
        ? {
            id: dbService.id,
            externalId: null,
            name: dbService.name,
            description: dbService.description,
            price: parseFloat(dbService.price),
            subtotal: pricing.subtotal,
            gst: pricing.gst,
            total: pricing.total,
          }
        : null;

    let desktopSyncError: string | null = null;

    if (servicePayload) {
      const { websiteId, brandName } = getDesktopSyncConfig();
      try {
        await forwardBookingToDesktop({
          id: booking.id,
          bookingNumber: `BOOK-${String(booking.id).padStart(4, "0")}`,
          stockServiceId: String(servicePayload.externalId ?? servicePayload.id),
          serviceId: String(servicePayload.externalId ?? servicePayload.id),
          serviceName: servicePayload.name,
          serviceDescription: servicePayload.description,
          websiteId,
          brandName,
          brandDetails: brandName,
          timestamp: new Date().toISOString(),
          createdAt: booking.createdAt.toISOString(),
          status: booking.status,
          preferredDate: booking.preferredDate,
          notes: booking.notes,
          customFields,
          customerName: bookingCustomer.fullName ?? member?.name ?? "Guest customer",
          customerEmail: bookingCustomer.email ?? member?.email ?? "",
          customerPhone: bookingCustomer.phone,
          customerAddress: bookingCustomer.address,
          member: {
            id: member?.id ?? 0,
            name: bookingCustomer.fullName ?? member?.name ?? "Guest customer",
            email: bookingCustomer.email ?? member?.email ?? "",
            phone: bookingCustomer.phone,
            address: bookingCustomer.address,
          },
          service: servicePayload,
          source: "website-booking",
        });
      } catch (syncErr) {
        desktopSyncError = syncErr instanceof Error ? syncErr.message : "Failed to forward booking to desktop";
        req.log.error({ err: syncErr, bookingId: booking.id }, "Failed to forward booking to desktop");
      }
    }

    if (!hasDatabase && desktopSyncError) {
      return res.status(502).json({
        error: "Booking could not be saved because the database is not configured and desktop sync failed",
        desktopSyncError,
      });
    }

    return res.status(201).json({
      ...booking,
      createdAt: booking.createdAt.toISOString(),
      desktopSynced: !desktopSyncError,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", requireAuth, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.status(404).json({ error: "Not found" });
    }
    const parsed = GetBookingParams.safeParse({ id: parseInt(req.params.id) });
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [booking] = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.id, parsed.data.id), eq(bookingsTable.memberId, req.session.memberId!))
    );
    if (!booking) return res.status(404).json({ error: "Not found" });

    return res.json({ ...booking, createdAt: booking.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

router.post("/quote-request", async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      fullName = "",
      phone = "",
      email = "",
      address1 = "",
      address2 = "",
      suburb = "",
      city = "",
      zipCode = "",
      notes = "",
      shippingLabel = "",
      shippingPrice = 0
    } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // 1. Fetch product details
    const syncedEntries = (await readStockStore())
      .filter((entry) => entry.showOnWebsite !== false);
    const syncedProductEntry = syncedEntries.find((entry) => entry.id === productId);
    const syncedProduct = syncedEntries
      .filter((entry) => entry.showOnWebsite !== false)
      .map(mapEntryToCatalogProduct)
      .find((entry) => entry.id === productId);

    let dbProduct: {
      id: number;
      name: string;
      description: string | null;
      price: string;
      type: string;
      available: boolean;
    } | null = null;

    if (!syncedProduct) {
      if (hasDatabase) {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
        dbProduct = product ?? null;
      }
      if (!dbProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
    }

    const productName = syncedProduct ? syncedProduct.name : (dbProduct ? dbProduct.name : `Product ${productId}`);
    const productPrice = syncedProduct ? syncedProduct.price : (dbProduct ? parseFloat(dbProduct.price) : 0);
    const productDesc = syncedProduct ? syncedProduct.description : (dbProduct ? dbProduct.description : "");
    const productExternalId = syncedProductEntry?.externalId ?? productId;

    // 2. Build line items
    const lineItems: any[] = [
      {
        id: `line-prod-${productId}`,
        productId: String(productExternalId),
        description: productName,
        quantity: Number(quantity),
        unitPrice: Number(productPrice),
        total: Number(productPrice * quantity),
        itemType: "product",
        sku: String((syncedProductEntry as any)?.sku ?? "")
      }
    ];

    if (shippingPrice > 0) {
      lineItems.push({
        id: `line-shipping-${Date.now()}`,
        productId: "shipping-fee",
        description: `Shipping: ${shippingLabel}`,
        quantity: 1,
        unitPrice: Number(shippingPrice),
        total: Number(shippingPrice),
        itemType: "product",
        sku: "shipping"
      });
    }

    const subtotal = lineItems.reduce((acc, item) => acc + item.total, 0);
    const gstAmount = subtotal * 0.15; // 15% GST
    const total = subtotal + gstAmount;

    const { websiteId, brandName } = getDesktopSyncConfig();
    const nameParts = splitFullName(fullName);

    // 3. Form Order Object for Desktop
    const orderObject = {
      id: `order_quote_${Date.now()}`,
      websiteId,
      stripeSessionId: `quote_${Date.now()}`,
      customerName: fullName,
      customerFirstName: nameParts.firstName,
      customerLastName: nameParts.lastName,
      customerEmail: email,
      customerPhone: phone,
      customerAddress1: address1,
      customerAddress2: address2,
      customerCity: city,
      customerRegion: suburb,
      customerPostcode: zipCode,
      customerCountry: "NZ",
      shippingAddressText: [address1, address2, suburb, city, zipCode, "NZ"].filter(Boolean).join(", "),
      shipping_address_text: [address1, address2, suburb, city, zipCode, "NZ"].filter(Boolean).join(", "),
      shippingAddress: {
        line1: address1,
        line2: address2,
        city: city,
        state: suburb,
        postal_code: zipCode,
        country: "NZ"
      },
      shipping_address: {
        line1: address1,
        line2: address2,
        city: city,
        state: suburb,
        postal_code: zipCode,
        country: "NZ"
      },
      amountTotal: total,
      amountTotalCents: Math.round(total * 100),
      total: total,
      currency: "NZD",
      paymentStatus: "unpaid",
      payment_status: "unpaid",
      timestamp: new Date().toISOString(),
      memberRegistered: false,
      brandName,
      brandDetails: brandName,
      lineItems,
      items: lineItems.map((item) => ({
        productId: item.productId,
        productTitle: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.total,
        sku: item.sku || "",
      })),
      source: "quote-request",
      notes: notes,
      metadata: {
        notes,
        quoteRequested: "true"
      },
      deferStockDeduction: true
    };

    // 4. Forward to Desktop
    await forwardOrderToDesktop(orderObject);
    await refreshStockProducts();

    return res.status(201).json({
      success: true,
      orderId: orderObject.id,
      total: orderObject.total
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create quote request");
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
