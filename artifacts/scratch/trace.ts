import fetch from "node-fetch";

const DESKTOP_BASE_URL = "https://denver-s-desk.onrender.com";
const AUTH_TOKEN = "td_sec_tok_f8d4e9c1b3a2";
const WEBSITE_ID = "web-1782561404289";
const BRAND_NAME = "A Woman With a Welder";

async function postToDesktop(url: string, payload: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "x-api-key": AUTH_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  
  let data;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status,
    data,
  };
}

async function traceBooking() {
  console.log("=== TRACING BOOKING 1 ===");
  const booking1 = {
    id: Date.now(),
    bookingNumber: `BOOK-${Date.now()}`,
    stockServiceId: "srv-123",
    serviceId: "srv-123",
    serviceName: "Test Service 1",
    serviceDescription: "Test",
    websiteId: WEBSITE_ID,
    brandName: BRAND_NAME,
    brandDetails: BRAND_NAME,
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: "pending",
    preferredDate: "2026-09-01",
    notes: "Test notes",
    customFields: [],
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "123456789",
    customerAddress: "123 Test St",
    member: {
      id: 0,
      name: "Test Customer",
      email: "test@example.com",
    },
    service: {
      id: 123,
      name: "Test Service 1",
      description: "Test",
      price: 100,
    },
    source: "website-booking",
  };
  
  const res1 = await postToDesktop(`${DESKTOP_BASE_URL}/api/ecommerce/bookings`, booking1);
  console.log("Response 1:", JSON.stringify(res1, null, 2));

  console.log("=== TRACING BOOKING 2 ===");
  const booking2 = {
    ...booking1,
    id: Date.now() + 1000,
    bookingNumber: `BOOK-${Date.now() + 1000}`,
  };
  const res2 = await postToDesktop(`${DESKTOP_BASE_URL}/api/ecommerce/bookings`, booking2);
  console.log("Response 2:", JSON.stringify(res2, null, 2));
}

async function traceQuote() {
  console.log("=== TRACING QUOTE ===");
  const quote = {
    id: `order_quote_${Date.now()}`,
    websiteId: WEBSITE_ID,
    stripeSessionId: `quote_${Date.now()}`,
    customerName: "Quote Test",
    customerFirstName: "Quote",
    customerLastName: "Test",
    customerEmail: "quote@example.com",
    customerPhone: "987654321",
    customerAddress1: "123 Quote St",
    customerCity: "Quoteville",
    customerRegion: "Quoteregion",
    customerPostcode: "1234",
    customerCountry: "NZ",
    shippingAddressText: "123 Quote St, Quoteville, Quoteregion, 1234, NZ",
    shipping_address_text: "123 Quote St, Quoteville, Quoteregion, 1234, NZ",
    amountTotal: 500,
    amountTotalCents: 50000,
    total: 500,
    currency: "NZD",
    paymentStatus: "unpaid",
    payment_status: "unpaid",
    timestamp: new Date().toISOString(),
    memberRegistered: false,
    brandName: BRAND_NAME,
    brandDetails: BRAND_NAME,
    lineItems: [
      {
        id: "line-prod-999",
        productId: "999",
        description: "Test Configurable Product",
        quantity: 1,
        unitPrice: 500,
        total: 500,
        itemType: "product",
        sku: "TEST-SKU",
      }
    ],
    items: [
      {
        productId: "999",
        productTitle: "Test Configurable Product",
        quantity: 1,
        price: 500,
        total: 500,
        sku: "TEST-SKU"
      }
    ],
    source: "quote-request",
    notes: "Quote notes",
    metadata: {
      notes: "Quote notes",
      quoteRequested: "true"
    },
    deferStockDeduction: true
  };
  
  // Note: Quote requests are sent to /api/ecommerce/orders based on webhookHandlers.ts and bookings.ts (line 490)
  // "forwardOrderToDesktop" uses ordersUrl
  const res = await postToDesktop(`${DESKTOP_BASE_URL}/api/ecommerce/orders`, { orders: [quote] });
  console.log("Quote Response:", JSON.stringify(res, null, 2));
}

async function main() {
  await traceBooking();
  await traceQuote();
}

main().catch(console.error);
