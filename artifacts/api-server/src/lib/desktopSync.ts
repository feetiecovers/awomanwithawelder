type SyncConfig = {
  websiteId: string;
  brandName: string;
  desktopBaseUrl: string;
  authToken: string;
  ordersUrl: string;
  bookingsUrl: string;
};

export type OrderForwardLineItem = {
  id: string;
  productId: string | number;
  sku?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType: "product" | "service";
};

export type BookingForwardPayload = {
  id: number;
  bookingNumber?: string;
  stockServiceId?: string;
  serviceId?: string;
  serviceName?: string;
  serviceDescription?: string | null;
  websiteId: string;
  brandName: string;
  brandDetails: string;
  timestamp: string;
  createdAt?: string;
  status: string;
  preferredDate: string | null;
  notes: string | null;
  customFields?: Array<{
    fieldId: string;
    label: string;
    type: "text" | "number" | "select" | "checkbox";
    value: string;
    displayValue?: string;
  }>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  member: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
  service: {
    id: number;
    externalId?: string | null;
    name: string;
    description: string | null;
    price: number;
    subtotal?: number | null;
    gst?: number | null;
    total?: number | null;
  };
  source: "website-booking";
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveDesktopBaseUrl(): string {
  const configuredBaseUrl = trimTrailingSlash(process.env.DESKTOP_APP_BASE_URL || "");
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DESKTOP_APP_BASE_URL environment variable is required in production");
  }

  return "http://localhost:4028";
}

export function getDesktopSyncConfig(): SyncConfig {
  const desktopBaseUrl = resolveDesktopBaseUrl();
  const websiteId = process.env.WEBSITE_ID || "web-1782561404289";
  const brandName = process.env.BRAND_NAME || "A Woman With a Welder";
  const authToken = process.env.DESKTOP_APP_AUTH_TOKEN || process.env.NEXT_PUBLIC_DESKTOP_APP_AUTH_TOKEN || "";

  return {
    websiteId,
    brandName,
    desktopBaseUrl,
    authToken,
    ordersUrl: process.env.DESKTOP_APP_ORDERS_URL || `${desktopBaseUrl}/api/ecommerce/orders`,
    bookingsUrl: process.env.DESKTOP_APP_BOOKINGS_URL || `${desktopBaseUrl}/api/ecommerce/bookings`,
  };
}

export function getDesktopAuthHeaders(): Record<string, string> {
  const { authToken } = getDesktopSyncConfig();
  if (!authToken) return {};

  return {
    Authorization: `Bearer ${authToken}`,
    "x-api-key": authToken,
  };
}

export async function postToDesktop(url: string, payload: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...getDesktopAuthHeaders(),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Desktop sync failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export async function forwardOrderToDesktop(orderObject: Record<string, unknown>) {
  const { ordersUrl } = getDesktopSyncConfig();
  return postToDesktop(ordersUrl, { orders: [orderObject] });
}

export async function forwardBookingToDesktop(bookingPayload: BookingForwardPayload) {
  const { bookingsUrl } = getDesktopSyncConfig();
  return postToDesktop(bookingsUrl, bookingPayload);
}
