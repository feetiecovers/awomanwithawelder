import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Calendar, ChevronLeft, ChevronRight, ReceiptText, User, Phone, PhoneCall, Mail, MapPin, ShoppingBag, Wrench, Maximize2 } from "lucide-react";
import { ProductDetailWorkspace } from "./ProductDetailWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListProducts,
  useGetCart,
  useAddToCart,
  useCreateBooking,
  useGetCurrentMember,
  getGetCartQueryKey,
  getListBookingsQueryKey,
  getGetCurrentMemberQueryKey,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { BookingConfirmationData } from "@/lib/bookingConfirmation";
import { buildApiUrl } from "@/lib/api-base";
import ddIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import { BookingCalendar } from "./BookingCalendar";
import { recordLocalBooking, getDateAvailability, getMinimumBookingDateNZString, type WebsiteBookingCapacityProjection } from "@/lib/bookingCache";
import { getProductImages, normalizeImageUrl } from "@/lib/product-images";
import { getCachedProducts, saveProductsToCache } from "@/lib/productsCache";
import { formatCustomerPromise } from "@/lib/promiseFormatting";

interface ProductsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCart?: () => void;
  onRequireSignIn?: () => void;
  onBookingSuccess?: (bookingData: BookingConfirmationData) => void;
  onOpenConfigurator?: () => void;
  onOpenConfigurableProduct?: (id: number) => void;
  onOpenParametricProduct?: (id: number) => void;
  onOpenBuildProduct?: (build: any) => void;
}

const ITEMS_PER_PAGE = 1;
const GST_RATE = 0.15;

const PRODUCT_GRADIENTS = [
  "linear-gradient(135deg, #0d1c2e 0%, #1a3a5c 50%, #0a1525 100%)",
  "linear-gradient(135deg, #1a1a0f 0%, #2a2a18 50%, #0f0f0a 100%)",
  "linear-gradient(135deg, #0f1a1a 0%, #1a3030 50%, #0a1414 100%)",
  "linear-gradient(135deg, #1a0f1a 0%, #2a1a2a 50%, #140a14 100%)",
  "linear-gradient(135deg, #0d1420 0%, #1e3040 50%, #081020 100%)",
];

type WebsiteBookingCapacityProjectionType = WebsiteBookingCapacityProjection;

function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

type ProductCard = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  type: "product" | "service" | "configurable" | "parametric" | "build";
  available: boolean;
  image: string | null;
  bookingFields?: Array<{
    id: string;
    label: string;
    type: "text" | "number" | "select" | "checkbox";
    placeholder?: string;
    required?: boolean;
    options?: Array<{ id: string; label: string; value: string }>;
  }>;
  shippingPresets?: Array<{ label: string; price: number }>;
  hasVariants?: boolean;
  variantLabel?: string;
  variantMode?: string;
  variants?: Array<{
    id: string;
    name: string;
    sellPrice: number;
    code?: string;
    quantity?: number;
    isDefault?: boolean;
  }>;
  optionGroups?: Array<any>;
  commerceActions?: {
    allowCheckout: boolean;
    allowQuoteRequest: boolean;
  };
  customerMessage?: string;
  fulfillmentMode?: string;
  comingSoon?: boolean;
  showComingSoonBanner?: boolean;
  comingSoonLabel?: string;
};

type BookingFormState = {
  fullName: string;
  address1: string;
  address2: string;
  suburb: string;
  city: string;
  zipCode: string;
  phone: string;
  email: string;
  bookingDate: string;
  notes: string;
  customFields: Record<string, string>;
};

const emptyBookingForm: BookingFormState = {
  fullName: "",
  address1: "",
  address2: "",
  suburb: "",
  city: "",
  zipCode: "",
  phone: "",
  email: "",
  bookingDate: "",
  notes: "",
  customFields: {},
};

function getProductImage(record: Record<string, unknown>): string | null {
  const resolved = getProductImages(record, "large")[0];
  if (resolved) return resolved;
  const candidate = record.image ?? record.imageUrl ?? (record as any).defaultImageUrl;
  if (typeof candidate === "string" && candidate.trim()) {
    return normalizeImageUrl(candidate);
  }
  return null;
}

function normalizeProducts(value: unknown): ProductCard[] {
  const collections: unknown[] = [];

  if (Array.isArray(value)) {
    collections.push(value);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    collections.push(
      record.items,
      record.products,
      record.stockProducts,
      record.stockServiceProducts,
      record.serviceProducts,
      record.data,
    );
  }

  const items = collections.flatMap((collection) => (
    Array.isArray(collection) ? collection : []
  ));

  return items
    .map((item, index): ProductCard | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const rawType = String(record.type ?? record.productType ?? record.serviceType ?? record.itemType ?? "").trim().toLowerCase();
      const isParametric = rawType === "parametric_product" || rawType === "parametric"
        || record.parametricProductType === "parametric_product"
        || record.purchaseMode === "parametric";
      const isBuild = rawType === "build"
        || record._sourceType === "build"
        || record.buildType === "build"
        || record.purchaseMode === "build"
        || Boolean(record.buildId || record.build_id);
      const type: ProductCard["type"] = (
        rawType === "service"
        || rawType === "stock_service"
        || record.bookingRequired === true
        || record.fulfillmentType === "job"
      ) ? "service" : isBuild ? "build" : (rawType === "configurable_product" || rawType === "configurable") ? "configurable" : isParametric ? "parametric" : "product";
      const price = Number(record.price ?? record.displayPrice ?? record.sellPrice ?? record.unitPrice ?? record.sell_price ?? record.unit_price);
      const image = getProductImage(record);
      const bookingFields: NonNullable<ProductCard["bookingFields"]> = Array.isArray(record.bookingFields)
        ? record.bookingFields.map((field: any, fieldIndex: number) => ({
            id: String(field?.id ?? `booking-field-${fieldIndex}`),
            label: String(field?.label ?? "Booking Field"),
            type: field?.type === "number" || field?.type === "select" || field?.type === "checkbox" ? field.type : "text",
            placeholder: typeof field?.placeholder === "string" ? field.placeholder : "",
            required: field?.required === true,
            options: Array.isArray(field?.options)
              ? field.options.map((option: any, optionIndex: number) => ({
                  id: String(option?.id ?? `booking-option-${optionIndex}`),
                  label: String(option?.label ?? option?.value ?? "Option"),
                  value: String(option?.value ?? option?.label ?? ""),
                }))
              : [],
          }))
        : [];

      return {
        ...(record as any),
        id: Number(record.id ?? record.productId ?? index),
        name: String(record.name ?? record.title ?? record.label ?? "Untitled Item"),
        description: typeof record.description === "string" ? record.description : null,
        price: Number.isFinite(price) ? price : 0,
        type,
        available: record.available !== false && record.inStock !== false && record.in_stock !== false,
        image,
        bookingFields,
        shippingPresets: Array.isArray(record.shippingPresets) ? record.shippingPresets : (Array.isArray(record.preset_shipping_costs) ? record.preset_shipping_costs : (Array.isArray(record.presetShippingCosts) ? record.presetShippingCosts : undefined)),
        hasVariants: record.hasVariants === true,
        variantLabel: typeof record.variantLabel === "string" ? record.variantLabel : "Option",
        variantMode: typeof record.variantMode === "string" ? record.variantMode : "none",
        variants: Array.isArray(record.variants) ? record.variants.map((v: any) => ({
          id: String(v.id),
          name: String(v.name),
          sellPrice: Number(v.sellPrice ?? v.price ?? v.displayPrice ?? 0),
          code: v.code ? String(v.code) : undefined,
          quantity: v.quantity !== undefined ? Number(v.quantity) : undefined,
          isDefault: v.isDefault === true
        })) : undefined,
        optionGroups: Array.isArray(record.optionGroups) ? record.optionGroups : undefined,
        commerceActions: record.commerceActions && typeof record.commerceActions === "object" ? {
          allowCheckout: (record.commerceActions as any).allowCheckout === true,
          allowQuoteRequest: (record.commerceActions as any).allowQuoteRequest !== false,
        } : undefined,
        customerMessage: (() => {
          const rawMsg = typeof (record.availability as any)?.customerMessage === "string"
            ? (record.availability as any).customerMessage
            : typeof (record.promise as any)?.message === "string"
              ? (record.promise as any).message
              : typeof record.customerMessage === "string"
                ? record.customerMessage
                : typeof (record.promiseSettings as any)?.ownProfile?.availabilityLabel === "string"
                  ? (record.promiseSettings as any).ownProfile.availabilityLabel
                  : typeof (record.promiseSettings as any)?.availabilityLabel === "string"
                    ? (record.promiseSettings as any).availabilityLabel
                    : (type === "parametric" || type === "configurable" || type === "build" ? "Made to Order" : undefined);
          const promiseDate = (record.availability as any)?.promiseDate || (record.promise as any)?.promiseDate;
          const parsedCapacityDays = Number(
            (record.availability as any)?.capacityDays ??
            (record.promiseSettings as any)?.ownProfile?.capacityDays ??
            (record.promiseSettings as any)?.capacityDays ??
            record.capacityDays
          );
          const capacityDays = Number.isFinite(parsedCapacityDays) && parsedCapacityDays > 0
            ? parsedCapacityDays
            : (type === "parametric" || type === "configurable" || type === "build" || rawMsg?.toLowerCase().includes("made to order") ? 10 : undefined);
          const formatted = formatCustomerPromise(rawMsg, promiseDate, capacityDays);
          return formatted || undefined;
        })(),
        fulfillmentMode: typeof (record.availability as any)?.fulfillmentMode === "string"
          ? (record.availability as any).fulfillmentMode
          : undefined,
        comingSoon: Boolean(record.comingSoon),
        showComingSoonBanner: Boolean(record.showComingSoonBanner ?? record.comingSoon),
        comingSoonLabel: typeof record.comingSoonLabel === "string" && record.comingSoonLabel.trim()
          ? record.comingSoonLabel.trim()
          : (record.comingSoon ? "Coming Soon" : undefined),
      };
    })
    .filter((item): item is ProductCard => item !== null && Number.isFinite(item.id) && item.id > 0);
}

const getProductShippingPresets = (product: ProductCard) => {
  const rawProduct = product as any;
  if (rawProduct.shippingPresets && Array.isArray(rawProduct.shippingPresets) && rawProduct.shippingPresets.length > 0) {
    return rawProduct.shippingPresets;
  }
  
  if (product.type === "product" || product.type === "parametric" || product.type === "configurable") {
    if (product.name.toLowerCase().includes("custom") || product.name.toLowerCase().includes("special")) {
      return [{ label: "Flat Rate Shipping", price: 15.00 }];
    }
    return [
      { label: "Local Pickup (Auckland)", price: 0 },
      { label: "Standard Shipping (North Island)", price: 18.00 },
      { label: "Standard Shipping (South Island)", price: 32.00 },
      { label: "Rural Delivery", price: 45.00 }
    ];
  }
  return [];
};

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

function getPricingBreakdown(price: number) {
  const subtotal = Number((price / (1 + GST_RATE)).toFixed(2));
  const gst = Number((price - subtotal).toFixed(2));
  const total = Number(price.toFixed(2));

  return { subtotal, gst, total };
}

export function ProductsPopup({ isOpen, onClose, onOpenCart, onRequireSignIn, onBookingSuccess, onOpenConfigurator, onOpenConfigurableProduct, onOpenParametricProduct, onOpenBuildProduct }: ProductsPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: productsData, isLoading } = useListProducts({
    query: {
      queryKey: getListProductsQueryKey(),
      initialData: getCachedProducts,
      initialDataUpdatedAt: Date.now(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  useEffect(() => {
    if (productsData && Array.isArray(productsData) && productsData.length > 0) {
      saveProductsToCache(productsData);
    }
  }, [productsData]);
  const { data: cart } = useGetCart();
  const { data: member } = useGetCurrentMember();
  const addToCart = useAddToCart();
  const createBooking = useCreateBooking();

  const [activeTab, setActiveTab] = useState<"shop" | "services">("shop");
  const [shopPage, setShopPage] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [selectedService, setSelectedService] = useState<ProductCard | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(emptyBookingForm);
  const [shippingSelectProduct, setShippingSelectProduct] = useState<ProductCard | null>(null);
  const [shippingSelectConfig, setShippingSelectConfig] = useState<any>(null);
  const [selectedShippingPresetIndex, setSelectedShippingPresetIndex] = useState<number>(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [selectedWorkspaceProduct, setSelectedWorkspaceProduct] = useState<ProductCard | null>(null);
  const [bookingCapacity, setBookingCapacity] = useState<WebsiteBookingCapacityProjection | null>(null);
  const [bookingCapacityLoading, setBookingCapacityLoading] = useState(false);
  const [showCustomCallPrompt, setShowCustomCallPrompt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const hasBeenShown = sessionStorage.getItem("awww_custom_call_prompt_dismissed");
      if (!hasBeenShown) {
        setShowCustomCallPrompt(true);
        sessionStorage.setItem("awww_custom_call_prompt_dismissed", "true");
      }
    }
  }, [isOpen]);

  const handleDismissCustomCallPrompt = () => {
    setShowCustomCallPrompt(false);
    sessionStorage.setItem("awww_custom_call_prompt_dismissed", "true");
  };

  const products = useMemo(() => normalizeProducts(productsData), [productsData]);
  const shopItems = useMemo(
    () => products.filter((p) => p.type === "product" || p.type === "configurable" || p.type === "parametric" || p.type === "build"),
    [products]
  );
  const serviceItems = useMemo(
    () => products.filter((p) => p.type === "service"),
    [products]
  );
  const totalPages = Math.ceil(shopItems.length / ITEMS_PER_PAGE);
  const safeShopPage = Math.min(Math.max(0, shopPage), Math.max(0, totalPages - 1));
  const currentShopItems = shopItems.slice(safeShopPage * ITEMS_PER_PAGE, (safeShopPage + 1) * ITEMS_PER_PAGE);
  const activePrice = (() => {
    if (!selectedService) return 0;
    if (selectedService.hasVariants && selectedService.variants) {
      const variant = selectedService.variants.find((v) => v.id === selectedVariantId);
      if (variant) return variant.sellPrice;
    }
    return selectedService.price;
  })();
  const pricing = selectedService ? getPricingBreakdown(activePrice) : null;

  const cartTotal = useMemo(() => {
    if (!cart?.items || (cart.items as any[]).length === 0) return cart?.total ?? 0;
    return (cart.items as any[]).reduce((sum, item) => {
      const itemConfig = item.configuration || {};
      const itemPrice = itemConfig.resolvedPrice ?? item.price ?? (itemConfig.totalPriceAdjustment ? (item.product?.price ?? 0) + itemConfig.totalPriceAdjustment : (item.product?.price ?? 0));
      const shipping = item.shippingPrice ?? 0;
      return sum + (itemPrice + shipping) * item.quantity;
    }, 0);
  }, [cart]);

  useEffect(() => {
    setBookingForm((current) => ({
      ...current,
      fullName: member?.name ?? current.fullName,
      email: member?.email ?? current.email,
    }));
  }, [member]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedService(null);
      setSelectedVariantId(null);
      setBookingForm(emptyBookingForm);
      setBookingCapacity(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedService) {
      setBookingCapacity(null);
      setBookingCapacityLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setBookingCapacityLoading(false);
    }, 6000);

    setBookingCapacityLoading(true);
    const targetUrl = buildApiUrl("/api/booking-availability?days=120");

    void fetch(targetUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Availability request failed: ${response.status}`);
        return response.json() as Promise<WebsiteBookingCapacityProjection>;
      })
      .then((projection) => {
        if (!controller.signal.aborted && projection && Array.isArray(projection.days)) {
          setBookingCapacity(projection);
        }
      })
      .catch((err) => {
        console.warn("Failed to load booking capacity projection, using local availability:", err);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setBookingCapacityLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedService?.id]);

  const goToPage = (next: number) => {
    const target = Math.max(0, Math.min(next, totalPages - 1));
    if (target === safeShopPage) return;
    setSlideDir(target > safeShopPage ? 1 : -1);
    setShopPage(target);
  };

  // Keyboard navigation with Left and Right arrow keys
  useEffect(() => {
    if (!isOpen || activeTab !== "shop" || selectedWorkspaceProduct !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToPage(safeShopPage + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPage(safeShopPage - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeTab, selectedWorkspaceProduct, safeShopPage, totalPages]);

  // Trackpad / mouse horizontal swipe handler
  const lastWheelTimeRef = useRef(0);
  const handleWheel = (e: React.WheelEvent) => {
    // Only capture distinct horizontal trackpad swipe gestures
    if (Math.abs(e.deltaX) > 20 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const now = Date.now();
      if (now - lastWheelTimeRef.current < 380) return;
      if (e.deltaX > 25 && safeShopPage < totalPages - 1) {
        lastWheelTimeRef.current = now;
        goToPage(safeShopPage + 1);
      } else if (e.deltaX < -25 && safeShopPage > 0) {
        lastWheelTimeRef.current = now;
        goToPage(safeShopPage - 1);
      }
    }
  };

  // Mobile / touchscreen swipe gesture handlers
  const touchStartXRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 40 && safeShopPage < totalPages - 1) {
        goToPage(safeShopPage + 1);
      } else if (diff < -40 && safeShopPage > 0) {
        goToPage(safeShopPage - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const handleAddToCartWithShipping = (productId: number, shippingLabel?: string, shippingPrice?: number, configuration?: any) => {
    addToCart.mutate({ data: { productId, quantity: 1, shippingLabel, shippingPrice, configuration } as any }, {
      onSuccess: () => {
        toast({ title: "Added to cart" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setShippingSelectProduct(null);
        setShippingSelectConfig(null);
      },
    });
  };

  const onAddToCartClick = (item: ProductCard, configuration?: any) => {
    const presets = getProductShippingPresets(item);
    const enrichedConfig = {
      ...configuration,
      resolvedPrice: item.price,
      resolvedImage: item.image,
    };
    if (presets.length > 1) {
      setShippingSelectProduct(item);
      setShippingSelectConfig(enrichedConfig);
      setSelectedShippingPresetIndex(0);
    } else {
      const singlePreset = presets[0];
      handleAddToCartWithShipping(item.id, singlePreset?.label, singlePreset?.price, enrichedConfig);
    }
  };

  const openBookingModal = (service: ProductCard) => {
    setSelectedService(service);
    const defaultVariant = service.variants?.find((v) => v.isDefault) ?? service.variants?.[0];
    const minLienDate = getMinimumBookingDateNZString();
    setSelectedVariantId(defaultVariant ? defaultVariant.id : null);
    setBookingForm((current) => ({
      ...emptyBookingForm,
      fullName: member?.name ?? current.fullName,
      email: member?.email ?? current.email,
      phone: current.phone,
      bookingDate: minLienDate,
      address1: current.address1,
      address2: current.address2,
      suburb: current.suburb,
      city: current.city,
      zipCode: current.zipCode,
      customFields: Object.fromEntries((service.bookingFields ?? []).map((field) => [field.id, (current.customFields || {})[field.id] ?? ""])),
    }));
  };

  const closeBookingModal = () => {
    setSelectedService(null);
    setSelectedVariantId(null);
    setBookingForm((current) => ({
      ...emptyBookingForm,
      fullName: member?.name ?? current.fullName,
      email: member?.email ?? current.email,
    }));
  };

  const updateBookingField = useCallback(<K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) => {
    setBookingForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSelectBookingDate = useCallback((dateStr: string) => {
    setBookingForm((current) => ({ ...current, bookingDate: dateStr }));
  }, []);

  const handleBookService = () => {
    if (!selectedService || !pricing) return;
    const serviceBookingFields = selectedService.bookingFields ?? [];

    const minLienDate = getMinimumBookingDateNZString();
    if (!bookingForm.bookingDate || bookingForm.bookingDate < minLienDate) {
      updateBookingField("bookingDate", minLienDate);
      toast({
        title: "7-Day Notice Required",
        description: `Bookings require at least 7 days advance notice. Your date has been set to ${formatBookingDate(minLienDate)}.`,
        variant: "destructive"
      });
      return;
    }

    const dateAvail = getDateAvailability(bookingForm.bookingDate, bookingCapacity);
    if (!dateAvail.available) {
      toast({ title: "Choose an available date", description: dateAvail.reason || "That date is no longer available. Please choose another date from the calendar.", variant: "destructive" });
      return;
    }

    const requiredFields: Array<keyof BookingFormState> = [
      "fullName",
      "address1",
      "suburb",
      "city",
      "zipCode",
      "phone",
      "email",
      "bookingDate"
    ];
    const hasMissingField = requiredFields.some((field) => !String(bookingForm[field] ?? "").trim());
    if (hasMissingField) {
      toast({ title: "Missing details", description: "Please complete all required booking details.", variant: "destructive" });
      return;
    }

    const hasMissingCustomField = serviceBookingFields.some((field) => field.required && !String(bookingForm.customFields[field.id] ?? "").trim());
    if (hasMissingCustomField) {
      toast({ title: "Missing details", description: "Please complete the required booking request fields.", variant: "destructive" });
      return;
    }

    const combinedAddress = [
      bookingForm.address1,
      bookingForm.address2,
      bookingForm.suburb,
      bookingForm.city,
      bookingForm.zipCode
    ].map(s => s.trim()).filter(Boolean).join(", ");

    createBooking.mutate({
      data: {
        serviceId: selectedService.id,
        preferredDate: bookingForm.bookingDate,
        notes: bookingForm.notes,
        fullName: bookingForm.fullName,
        address: combinedAddress,
        phone: bookingForm.phone,
        email: bookingForm.email,
        serviceName: selectedService.hasVariants && selectedVariantId && selectedService.variants
          ? `${selectedService.name} - ${selectedService.variants.find((v) => v.id === selectedVariantId)?.name ?? ""}`
          : selectedService.name,
        servicePrice: pricing.total,
        subtotal: pricing.subtotal,
        gst: pricing.gst,
        total: pricing.total,
        customFields: serviceBookingFields.map((field) => {
          const value = String(bookingForm.customFields[field.id] ?? "");
          return {
            fieldId: field.id,
            label: field.label,
            type: field.type,
            value,
            displayValue: field.type === "checkbox"
              ? value === "true"
                ? "Yes"
                : value === "false"
                  ? "No"
                  : ""
              : field.type === "select"
                ? (field.options ?? []).find((option) => option.value === value)?.label ?? value
                : value,
          };
        }),
      } as any,
    }, {
      onSuccess: (booking) => {
        recordLocalBooking(bookingForm.bookingDate);
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentMemberQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        onClose();
        onBookingSuccess?.({
          bookingId: booking.id,
          fullName: bookingForm.fullName,
          address: combinedAddress,
          phone: bookingForm.phone,
          email: bookingForm.email,
          bookingDate: bookingForm.bookingDate,
          notes: bookingForm.notes,
          serviceName: selectedService.name,
          serviceDescription: selectedService.description,
          estimatedPrice: pricing.total,
          subtotal: pricing.subtotal,
          gst: pricing.gst,
          total: pricing.total,
        });
        closeBookingModal();
      },
      onError: (error) => {
        const bookingError = error as { data?: { error?: string } };
        toast({ title: "Booking failed", description: bookingError.data?.error || "We couldn't submit your booking right now.", variant: "destructive" });
      },
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm sm:backdrop-blur-md"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-2.5 sm:p-4 pointer-events-none">
        
        <AnimatePresence mode="wait">
          {selectedWorkspaceProduct ? (
            <ProductDetailWorkspace
              key="workspace"
              product={selectedWorkspaceProduct}
              onClose={() => setSelectedWorkspaceProduct(null)}
              onAddToCart={(payload) => {
                if (Array.isArray(payload)) {
                  payload.forEach(p => onAddToCartClick(p.product, p.options));
                } else {
                  onAddToCartClick(payload.product, payload.options);
                }
              }}
              onRequestQuote={(payload) => {
                // Now handled internally inside ProductDetailWorkspace
              }}
            />
          ) : (
            <div className="w-full max-w-2xl flex flex-col items-center pointer-events-none">
              <AnimatePresence>
                {showCustomCallPrompt && (
                  <motion.aside
                    key="custom-call-banner"
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="pointer-events-auto w-full mb-2.5 sm:mb-3 z-30 shrink-0 transform-gpu"
                  >
                    <div className="relative overflow-hidden rounded-2xl bg-[#071322]/95 backdrop-blur-md border border-primary/40 px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.7),0_0_30px_rgba(26,157,224,0.35)] flex items-center justify-between gap-3 text-white">
                      {/* Glow ambient decoration */}
                      <div className="absolute -left-10 -top-10 w-28 h-28 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute right-0 bottom-0 w-28 h-28 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />

                      <div className="relative flex items-center gap-3 sm:gap-3.5 min-w-0">
                        <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-[0_0_18px_rgba(26,157,224,0.5)]">
                          <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] sm:text-[11px] text-primary uppercase tracking-widest font-semibold truncate">
                            Custom Fabrication
                          </p>
                          <p className="text-xs sm:text-sm font-medium text-slate-100 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>Do you want something completely customized?</span>
                            <span className="text-blue-200/90 whitespace-nowrap">
                              Call Charlotte on{" "}
                              <a
                                href="tel:035626024"
                                className="font-mono font-bold text-white underline decoration-primary/70 underline-offset-4 hover:decoration-primary hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                                title="Call Charlotte on 03 562 6024"
                              >
                                03 562 6024
                              </a>
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDismissCustomCallPrompt}
                        aria-label="Dismiss custom fabrication banner"
                        className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              <motion.div
                key="offerings"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`w-full flex flex-col bg-[#080d14]/95 backdrop-blur-md border border-primary/20 rounded-[28px] shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] pointer-events-auto h-[680px] transform-gpu will-change-transform ${
                  showCustomCallPrompt
                    ? "max-h-[calc(100dvh-120px)] sm:max-h-[calc(100dvh-130px)]"
                    : "max-h-[calc(100dvh-32px)]"
                }`}
              >

              <div className="flex items-center justify-between px-5 py-4 border-b border-primary/15 shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="font-mono font-bold tracking-[0.2em] uppercase text-primary text-base">
                Offerings
              </h2>
              <div className="hidden xs:flex items-center gap-1.5 opacity-60 ml-2 border-l border-primary/20 pl-3">
                <motion.img 
                  src={ddIcon} 
                  alt="Denver's Desk" 
                  className="w-3.5 h-3.5 object-contain"
                  animate={{ y: [-1, 1, -1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="font-mono text-[9px] tracking-wider uppercase text-primary/80">Powered by Denver's Desk</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenCart}
                className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-primary/8 px-2.5 py-1 rounded-full border border-primary/20 hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                <span>{formatCurrency(cartTotal)}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive"
                data-testid="button-close-popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Header (< sm) */}
          <div className="sm:hidden flex shrink-0 px-2 py-3 border-b border-primary/15 bg-[#05080e]/80 overflow-hidden relative">
            <div className="w-full flex items-center justify-center gap-1.5 px-1">
              {activeTab === "shop" && (
                <>
                  <button
                    onClick={() => setActiveTab("shop")}
                    data-testid="tab-shop-mobile"
                    className="flex-1 max-w-[160px] py-2 px-3 rounded-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(26,157,224,0.6)] flex items-center justify-center gap-1.5 truncate z-10"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Products</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("services")}
                    data-testid="tab-services-mobile-peek"
                    className="w-[85px] py-2 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-tight text-muted-foreground bg-[#09101a] border border-primary/20 hover:text-primary flex items-center gap-1 opacity-75 hover:opacity-100 truncate shrink-0"
                  >
                    <Wrench className="h-3 w-3 shrink-0" />
                    <span className="truncate">Serv...</span>
                  </button>
                  {onOpenConfigurator && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenConfigurator();
                      }}
                      data-testid="tab-configurator-mobile-peek"
                      className="w-[85px] py-2 px-2 rounded-full font-mono text-[10px] uppercase tracking-tight text-[#ff2a8d] bg-[#ff2a8d]/10 border border-[#ff2a8d]/30 flex items-center gap-1 opacity-75 hover:opacity-100 truncate shrink-0"
                    >
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span className="truncate">Config...</span>
                    </button>
                  )}
                </>
              )}

              {activeTab === "services" && (
                <>
                  <button
                    onClick={() => setActiveTab("shop")}
                    data-testid="tab-shop-mobile-peek"
                    className="w-[85px] py-2 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-tight text-muted-foreground bg-[#09101a] border border-primary/20 hover:text-primary flex items-center gap-1 opacity-75 hover:opacity-100 truncate shrink-0"
                  >
                    <ShoppingBag className="h-3 w-3 shrink-0" />
                    <span className="truncate">Prod...</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("services")}
                    data-testid="tab-services-mobile"
                    className="flex-1 max-w-[160px] py-2 px-3 rounded-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(26,157,224,0.6)] flex items-center justify-center gap-1.5 truncate z-10"
                  >
                    <Wrench className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Services</span>
                  </button>
                  {onOpenConfigurator && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenConfigurator();
                      }}
                      data-testid="tab-configurator-mobile-peek"
                      className="w-[85px] py-2 px-2 rounded-full font-mono text-[10px] uppercase tracking-tight text-[#ff2a8d] bg-[#ff2a8d]/10 border border-[#ff2a8d]/30 flex items-center gap-1 opacity-75 hover:opacity-100 truncate shrink-0"
                    >
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span className="truncate">Config...</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Desktop Navigation Header (sm:) */}
          <div className="hidden sm:flex shrink-0 px-5 py-3 border-b border-primary/15 bg-[#05080e]/80">
            <div className="w-full flex bg-[#09101a] p-1.5 rounded-full border border-primary/25 shadow-inner gap-1">
              {(["shop", "services"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    data-testid={`tab-${tab}`}
                    className={`flex-1 py-2 px-3 rounded-full font-mono text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(26,157,224,0.6)] scale-[1.01]"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                    }`}
                  >
                    {tab === "shop" ? (
                      <ShoppingBag className="h-3.5 w-3.5" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5" />
                    )}
                    <span>{tab === "shop" ? "Products" : "Services"}</span>
                  </button>
                );
              })}
              {onOpenConfigurator && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenConfigurator();
                  }}
                  data-testid="tab-configurator"
                  className="flex-1 py-2 px-3 rounded-full font-mono text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 bg-[#ff2a8d]/15 text-[#ff2a8d] hover:bg-[#ff2a8d] hover:text-white hover:shadow-[0_0_20px_rgba(255,42,141,0.7)]"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Trailer Configurator™</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "shop" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {isLoading && shopItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground text-sm">
                    Loading products...
                  </div>
                ) : shopItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground text-sm">
                    No products available yet.
                  </div>
                ) : (
                  <>
                    <div
                      className="overflow-hidden relative px-5 pt-4 pb-2"
                      style={{ flex: "1 1 0" }}
                      onWheel={handleWheel}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                    >
                      {/* Floating illuminated side arrows on medium+ screens */}
                      {safeShopPage > 0 && (
                        <button
                          type="button"
                          onClick={() => goToPage(safeShopPage - 1)}
                          aria-label="Previous product"
                          title="Previous product"
                          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/70 border border-primary/30 text-primary/80 hover:text-white hover:bg-primary/25 hover:border-primary hover:shadow-[0_0_22px_rgba(26,157,224,0.75)] backdrop-blur-md items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                      )}
                      {safeShopPage < totalPages - 1 && (
                        <button
                          type="button"
                          onClick={() => goToPage(safeShopPage + 1)}
                          aria-label="Next product"
                          title="Next product"
                          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/70 border border-primary/30 text-primary/80 hover:text-white hover:bg-primary/25 hover:border-primary hover:shadow-[0_0_22px_rgba(26,157,224,0.75)] backdrop-blur-md items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      )}
                      <AnimatePresence mode="wait" custom={slideDir}>
                        <motion.div
                          key={safeShopPage}
                          custom={slideDir}
                          variants={{
                            enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
                            center: { x: 0, opacity: 1 },
                            exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
                          }}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          className="flex flex-col gap-3 h-full"
                        >
                          {currentShopItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex flex-col rounded-[18px] border border-primary/20 bg-[#0d1520]/90 overflow-hidden hover:border-primary/40 transition-colors h-full"
                              data-testid={`card-product-${item.id}`}
                            >
                              <div
                                className="w-full h-40 xs:h-46 sm:h-56 md:h-64 sm:flex-1 shrink-0 flex items-center justify-center relative overflow-hidden group bg-black/40 cursor-pointer"
                                onClick={() => {
                                  if (item.type === "build") {
                                    if (onOpenBuildProduct) onOpenBuildProduct(item);
                                    else setSelectedWorkspaceProduct(item);
                                  } else {
                                    setSelectedWorkspaceProduct(item);
                                  }
                                }}
                              >
                                  {((item.image && !failedImages[item.id]) || item.code === "AXL-BLDR-01" || item.id === 12) ? (
                                  <>
                                    <img
                                        src={(item.code === "AXL-BLDR-01" || item.id === 12) && (!item.image || failedImages[item.id]) ? "/assets/products/trailer_axle_composite.png" : item.image}
                                      alt={item.name}
                                      className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                                      loading="eager"
                                      decoding="async"
                                      onClick={() => {
                                        if (item.type === "build") {
                                          if (onOpenBuildProduct) onOpenBuildProduct(item);
                                          else setSelectedWorkspaceProduct(item);
                                        } else {
                                          setSelectedWorkspaceProduct(item);
                                        }
                                      }}
                                      onError={() => {
                                        setFailedImages((prev) => ({ ...prev, [item.id]: true }));
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewImage({ url: item.image!, title: item.name });
                                      }}
                                      className="absolute top-3 right-3 bg-black/60 hover:bg-primary/80 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg border border-white/20 transition-all opacity-90 sm:opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-[11px] font-mono shadow-md z-10 cursor-pointer"
                                      title="View Fullscreen"
                                      data-testid={`button-fullscreen-${item.id}`}
                                    >
                                      <Maximize2 className="h-4 w-4" />
                                      <span className="hidden xs:inline">Full Screen</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div
                                      className="absolute inset-0"
                                      style={{
                                        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(26,157,224,0.04) 8px, rgba(26,157,224,0.04) 10px)",
                                      }}
                                    />
                                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary/40 z-10 text-center px-4 leading-relaxed">
                                      Placeholder<br/>Owner Photography Required
                                    </span>
                                  </>
                                )}

                                {((item.showComingSoonBanner && item.comingSoonLabel) || item.code === "AXL-BLDR-01" || item.id === 12) && (
                                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-10 pointer-events-none">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#060e18]/85 backdrop-blur-md border border-cyan-400/50 text-cyan-200 text-xs font-mono shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                                      <span className="relative flex h-2 w-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                                      </span>
                                      <span className="font-medium text-cyan-100 tracking-wide">{item.code === "AXL-BLDR-01" || item.id === 12 ? "Accurately Priced for Quick Purchase" : item.comingSoonLabel}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col sm:flex-row justify-between p-3.5 sm:p-5 gap-2.5 sm:gap-4 bg-[#0a1018]/80 border-t border-primary/10 overscroll-contain">
                                <div className="flex flex-col justify-start gap-1.5 sm:gap-2 flex-1 min-w-0">
                                  <h3 className="font-bold text-base sm:text-xl text-foreground leading-tight truncate sm:whitespace-normal">{item.name}</h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-mono text-[10px] tracking-wider uppercase inline-flex items-center px-2 py-0.5 rounded border shrink-0 ${
                                      item.comingSoon
                                        ? 'text-amber-300 border-amber-400/40 bg-amber-500/10'
                                        : item.available !== false
                                          ? 'text-cyan-100 border-cyan-400/30 bg-cyan-500/10'
                                          : 'text-red-300 border-red-400/30 bg-red-500/10'
                                    }`}>
                                      {item.comingSoon ? "COMING SOON" : (item.available !== false ? "AVAILABLE NOW" : "OUT OF STOCK")}
                                    </span>
                                    {(item.type === "parametric" || item.type === "configurable") && (
                                      <span className="font-mono text-[10px] tracking-wider uppercase inline-flex items-center px-2 py-0.5 rounded border shrink-0 text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/10">
                                        CONFIGURABLE PRODUCT
                                      </span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-xs sm:text-sm text-slate-300/90 leading-snug sm:leading-relaxed line-clamp-5 sm:line-clamp-6 mt-0.5 sm:mt-1 pr-1">
                                      {item.description}
                                    </p>
                                  )}
                                  {item.customerMessage && (
                                    <p className="font-mono text-[10px] sm:text-[11px] text-cyan-100/70 leading-snug sm:leading-relaxed">
                                      {item.customerMessage}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex flex-col gap-2 sm:gap-2.5 shrink-0 sm:w-[180px] pt-1 sm:pt-0">
                                  <div className="text-left sm:text-right">
                                    <span className="font-mono text-cyan-100 font-bold text-lg sm:text-2xl">
                                      {item.type === "parametric" || item.type === "configurable" || item.type === "build"
                                        ? (item.price > 0 ? `From ${formatCurrency(item.price)}` : "Configure for price") 
                                        : formatCurrency(item.price)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex flex-col gap-1.5 sm:gap-2">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (item.type === "build") {
                                          if (onOpenBuildProduct) onOpenBuildProduct(item);
                                          else setSelectedWorkspaceProduct(item);
                                          return;
                                        }
                                        if (item.type === "parametric" || item.type === "configurable") {
                                          setSelectedWorkspaceProduct(item);
                                          return;
                                        }
                                        if (item.comingSoon) {
                                          setSelectedWorkspaceProduct(item);
                                          return;
                                        }
                                        onAddToCartClick(item);
                                      }}
                                      className="w-full font-mono uppercase tracking-widest text-[11px] h-9 sm:h-10"
                                      disabled={addToCart.isPending || (!item.comingSoon && item.type !== "parametric" && item.type !== "build" && item.available === false)}
                                      data-testid={`button-add-to-cart-${item.id}`}
                                    >
                                      {item.comingSoon ? "Coming Soon" : item.type === "build" ? "Build & Quote" : item.type === "parametric" ? "Configure & Quote" : (item.available === false ? "Unavailable" : item.type === "configurable" ? "Configure" : "Add to Cart")}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        if (item.type === "build") {
                                          if (onOpenBuildProduct) onOpenBuildProduct(item);
                                          else setSelectedWorkspaceProduct(item);
                                        } else {
                                          setSelectedWorkspaceProduct(item);
                                        }
                                      }}
                                      className="w-full font-mono uppercase tracking-widest text-[10px] h-8 sm:h-9 border border-primary/50 text-primary bg-primary/5 hover:bg-primary/20 hover:text-white transition-all shadow-[0_0_15px_rgba(26,157,224,0.1)] hover:shadow-[0_0_25px_rgba(26,157,224,0.3)]"
                                      data-testid={`button-view-product-${item.id}`}
                                    >
                                      {item.type === "build" ? "Customize Axle" : "View Product"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            ))}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                    {totalPages > 0 && (
                      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-primary/10">
                        <button
                          type="button"
                          onClick={() => goToPage(safeShopPage - 1)}
                          disabled={safeShopPage === 0}
                          className="h-9 w-9 rounded-full border border-primary/25 bg-[#09121d] text-primary/80 hover:text-white hover:bg-primary/25 hover:border-primary hover:shadow-[0_0_20px_rgba(26,157,224,0.7)] transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:hover:shadow-none disabled:hover:border-primary/25 disabled:hover:bg-[#09121d] disabled:cursor-not-allowed flex items-center justify-center active:scale-95"
                          data-testid="button-prev-page"
                          aria-label="Previous product"
                          title="Previous product (Left Arrow)"
                        >
                          <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
                        </button>

                        <div className="flex items-center gap-1 sm:gap-1.5 py-1">
                          {Array.from({ length: totalPages }).map((_, i) => {
                            const isCurrent = i === safeShopPage;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToPage(i);
                                }}
                                aria-label={`View product ${i + 1} of ${totalPages}`}
                                title={`Product ${i + 1}`}
                                className="p-2.5 -m-1.5 flex items-center justify-center cursor-pointer group focus:outline-none"
                                data-testid={`dot-page-${i}`}
                              >
                                <span
                                  className={`block rounded-full transition-all duration-300 ${
                                    isCurrent
                                      ? "w-7 h-2 bg-primary shadow-[0_0_12px_rgba(26,157,224,0.9)]"
                                      : "w-2.5 h-2 bg-primary/25 group-hover:bg-primary/70 group-hover:scale-125"
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => goToPage(safeShopPage + 1)}
                          disabled={safeShopPage >= totalPages - 1}
                          className="h-9 w-9 rounded-full border border-primary/25 bg-[#09121d] text-primary/80 hover:text-white hover:bg-primary/25 hover:border-primary hover:shadow-[0_0_20px_rgba(26,157,224,0.7)] transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:hover:shadow-none disabled:hover:border-primary/25 disabled:hover:bg-[#09121d] disabled:cursor-not-allowed flex items-center justify-center active:scale-95"
                          data-testid="button-next-page"
                          aria-label="Next product"
                          title="Next product (Right Arrow)"
                        >
                          <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "services" && (
              <div className="flex-1 overflow-y-auto scroll-industrial px-5 py-4 space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 font-mono text-muted-foreground text-sm">
                    Loading services...
                  </div>
                ) : serviceItems.length === 0 ? (
                  <div className="flex items-center justify-center py-8 font-mono text-muted-foreground text-sm">
                    No services available yet.
                  </div>
                ) : (
                  serviceItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-primary/20 bg-[#0d1520]/90 p-5 hover:border-primary/40 transition-colors"
                      data-testid={`card-service-${item.id}`}
                    >
                      {item.hasVariants && (
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                            Customizable Options Inside
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1 sm:gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">{item.name}</h3>
                        <span className="font-mono text-primary font-bold text-sm sm:text-base shrink-0">
                          From {formatCurrency(item.price)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">{item.description}</p>
                      <Button
                        onClick={() => openBookingModal(item)}
                        variant="outline"
                        className="w-full font-mono uppercase tracking-widest text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9"
                        disabled={item.available === false}
                        data-testid={`button-book-service-${item.id}`}
                      >
                        <Calendar className="h-4 w-4 mr-2" /> {item.available === false ? "Unavailable" : "Book Service"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
            </div>
        )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedService && pricing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md"
              onClick={closeBookingModal}
            />
            <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="pointer-events-auto w-full max-w-4xl overflow-y-auto scroll-industrial mobile-no-scrollbar max-h-[calc(100dvh-32px)] rounded-[28px] border border-primary/20 bg-[#080d14]/95 shadow-[0_0_60px_rgba(26,157,224,0.18)]"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-between border-b border-primary/15 bg-[#05080e]/80 px-6 py-4 sm:px-8 shrink-0 relative gap-3 sm:gap-0">
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto text-center sm:text-left">
                    <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary px-2 sm:px-3 py-1 rounded-full font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] whitespace-nowrap shrink-0">
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span>Service Booking</span>
                    </div>
                    <h3 className="font-mono text-[13px] sm:text-lg font-bold uppercase tracking-[0.12em] text-primary truncate w-full sm:w-auto">
                      {selectedService.name}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeBookingModal}
                    className="absolute right-4 top-4 sm:static sm:right-auto sm:top-auto h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="px-6 pt-5 pb-2 sm:px-8 border-b border-primary/10">
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Submit your details to book this service. The Woman with A Welder will get back to you as soon she is able too. If you don't hear back from her in the next 24 Hours - flick us an email at <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-primary font-semibold underline hover:text-primary/80">charlotte@awomanwithawelder.co.nz</a> it may have just got lost somewhere.
                  </p>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4 p-6">
                    {selectedService.hasVariants && selectedService.variants && (
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">
                          Select {selectedService.variantLabel || "Option"}
                        </p>
                        <select
                          value={selectedVariantId ?? ""}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          className="w-full bg-[#0d1520] border border-primary/20 text-foreground rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                        >
                          {selectedService.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({formatCurrency(v.sellPrice)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                          <User className="h-3 w-3" /> Full Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          required
                          value={bookingForm.fullName}
                          onChange={(e) => updateBookingField("fullName", e.target.value)}
                          placeholder="John Doe"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-full-name-${selectedService.id}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Phone Number <span className="text-destructive">*</span>
                        </label>
                        <Input
                          required
                          type="tel"
                          value={bookingForm.phone}
                          onChange={(e) => updateBookingField("phone", e.target.value)}
                          placeholder="021 345 6789"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-phone-${selectedService.id}`}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> Email Address <span className="text-destructive">*</span>
                        </label>
                        <Input
                          required
                          type="email"
                          value={bookingForm.email}
                          onChange={(e) => updateBookingField("email", e.target.value)}
                          placeholder="john@example.com"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-email-${selectedService.id}`}
                        />
                      </div>
                    <div className="space-y-2 sm:col-span-2">
                      <BookingCalendar
                        selectedDate={bookingForm.bookingDate}
                        onSelectDate={handleSelectBookingDate}
                        projection={bookingCapacity}
                        isLoading={bookingCapacityLoading}
                      />
                    </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-2xl border border-primary/10 bg-primary/3">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Booking Location Address <span className="text-destructive">*</span>
                      </label>
                      <div className="grid gap-3">
                        <Input
                          required
                          value={bookingForm.address1}
                          onChange={(e) => updateBookingField("address1", e.target.value)}
                          placeholder="Address Line 1"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-address1-${selectedService.id}`}
                        />
                        <Input
                          value={bookingForm.address2}
                          onChange={(e) => updateBookingField("address2", e.target.value)}
                          placeholder="Address Line 2 (Optional)"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-address2-${selectedService.id}`}
                        />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            required
                            value={bookingForm.suburb}
                            onChange={(e) => updateBookingField("suburb", e.target.value)}
                            placeholder="Suburb"
                            className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                            data-testid={`input-booking-suburb-${selectedService.id}`}
                          />
                          <Input
                            required
                            value={bookingForm.city}
                            onChange={(e) => updateBookingField("city", e.target.value)}
                            placeholder="City"
                            className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                            data-testid={`input-booking-city-${selectedService.id}`}
                          />
                          <Input
                            required
                            value={bookingForm.zipCode}
                            onChange={(e) => updateBookingField("zipCode", e.target.value)}
                            placeholder="Zip Code"
                            className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                            data-testid={`input-booking-zip-${selectedService.id}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                        Notes / Requests / Custom Modifications
                      </label>
                      <Textarea
                        value={bookingForm.notes}
                        onChange={(e) => updateBookingField("notes", e.target.value)}
                        placeholder="Specify any desired changes, dimension mods, custom coatings, or structural requests..."
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 resize-none min-h-[100px] font-mono text-sm"
                        data-testid={`input-booking-notes-${selectedService.id}`}
                      />
                    </div>

                    {(selectedService.bookingFields ?? []).length > 0 && (
                      <div className="space-y-3 rounded-2xl border border-primary/15 bg-[#09111b]/60 p-4">
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Booking Request Fields</p>
                        <div className="grid grid-cols-1 gap-4">
                          {(selectedService.bookingFields ?? []).map((field) => (
                            <div key={field.id} className="w-full">
                              <label className="mb-1.5 block text-xs font-mono text-slate-200 break-words whitespace-normal leading-normal">
                                {field.label}{field.required ? " *" : ""}
                              </label>
                              {field.type === "select" ? (
                                <select
                                  value={(bookingForm.customFields || {})[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...(current.customFields || {}), [field.id]: e.target.value },
                                  }))}
                                  className="input-field w-full bg-[#0d1520] border border-primary/20 text-foreground rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary h-10"
                                >
                                  <option value="">{field.placeholder || `Select ${field.label}`}</option>
                                  {(field.options ?? []).map((option) => (
                                    <option key={option.id} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === "checkbox" ? (
                                <select
                                  value={(bookingForm.customFields || {})[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...(current.customFields || {}), [field.id]: e.target.value },
                                  }))}
                                  className="input-field w-full bg-[#0d1520] border border-primary/20 text-foreground rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary h-10"
                                >
                                  <option value="">{field.placeholder || `Select ${field.label}`}</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              ) : (
                                <Input
                                  type={field.type === "number" ? "number" : "text"}
                                  placeholder={field.placeholder || field.label}
                                  value={(bookingForm.customFields || {})[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...(current.customFields || {}), [field.id]: e.target.value },
                                  }))}
                                  className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-primary/10 bg-[#0d1520]/90 p-6 lg:border-l lg:border-t-0">
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Service Info</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{selectedService.name}</p>
                      {selectedService.description && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedService.description}</p>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-primary/15 bg-[#09111b]/80 p-4">
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-primary" />
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Estimate</p>
                      </div>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Service Price</span>
                          <span>{formatCurrency(pricing.total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Subtotal excl. GST</span>
                          <span>{formatCurrency(pricing.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>GST</span>
                          <span>{formatCurrency(pricing.gst)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-primary/15 pt-3 font-semibold text-foreground">
                          <span>Estimated Total</span>
                          <span className="text-primary">{formatCurrency(pricing.total)}</span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-xs leading-6 text-muted-foreground">
                      Estimates are based on the selected service and may change once final scope and materials are confirmed.
                    </p>

                    <div className="mt-5 flex gap-3">
                      <Button
                        onClick={handleBookService}
                        className="flex-1 font-mono uppercase tracking-widest text-xs h-10"
                        disabled={createBooking.isPending}
                        data-testid={`button-confirm-booking-${selectedService.id}`}
                      >
                        {createBooking.isPending ? "Submitting..." : "Confirm Booking"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={closeBookingModal}
                        className="font-mono uppercase tracking-widest text-xs border-primary/30 h-10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shippingSelectProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
              onClick={() => setShippingSelectProduct(null)}
            />
            <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="pointer-events-auto w-full max-w-lg sm:max-w-xl rounded-2xl border border-primary/30 bg-[#080d14]/95 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_60px_rgba(26,157,224,0.22)] flex flex-col"
              >
                <h3 className="font-mono text-base font-bold uppercase tracking-wider text-primary mb-2">
                  Delivery Location & Options
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
                  Please select a delivery location for <span className="text-foreground font-semibold">{shippingSelectProduct.name}</span>:
                </p>
                
                <select
                  value={selectedShippingPresetIndex}
                  onChange={(e) => setSelectedShippingPresetIndex(Number(e.target.value))}
                  className="w-full bg-[#0d1520] border border-primary/30 text-foreground rounded-xl p-3 text-xs sm:text-sm font-mono mb-6 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 shadow-inner cursor-pointer"
                >
                  {getProductShippingPresets(shippingSelectProduct).map((preset: { label: string; price: number }, idx: number) => (
                    <option key={idx} value={idx} className="bg-[#080d14] text-foreground py-2 font-mono">
                      {preset.label} (+NZ${preset.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      const presets = getProductShippingPresets(shippingSelectProduct);
                      const selected = presets[selectedShippingPresetIndex];
                      handleAddToCartWithShipping(shippingSelectProduct.id, selected.label, selected.price, shippingSelectConfig);
                    }}
                    className="flex-1 font-mono uppercase tracking-widest text-xs h-10 shadow-[0_0_15px_rgba(26,157,224,0.4)]"
                  >
                    Add to Cart
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShippingSelectProduct(null)}
                    className="font-mono uppercase tracking-widest text-xs border-primary/30 hover:border-primary h-10 px-6"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
        {/* Fullscreen Image Lightbox Modal */}
        {previewImage && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md cursor-pointer"
              onClick={() => setPreviewImage(null)}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="pointer-events-auto relative max-w-4xl max-h-[90dvh] w-full rounded-2xl border border-primary/40 bg-[#080d14]/95 backdrop-blur-2xl p-3 sm:p-5 flex flex-col items-center justify-between shadow-[0_0_60px_rgba(26,157,224,0.35)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-full flex items-center justify-between pb-3 border-b border-primary/20 shrink-0">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="h-4 w-4 text-primary" />
                    <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate max-w-[240px] sm:max-w-md">
                      {previewImage.title}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewImage(null)}
                    className="h-8 w-8 rounded-full bg-white/5 border border-primary/30 text-white hover:bg-destructive/30 hover:text-white transition-all shrink-0"
                    data-testid="button-close-image-lightbox"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="relative w-full flex-1 flex items-center justify-center my-2 overflow-hidden rounded-xl bg-black/60 p-2 border border-primary/15 min-h-0">
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    className="max-h-[70dvh] max-w-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
