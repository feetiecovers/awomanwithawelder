import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Calendar, ChevronLeft, ChevronRight, ReceiptText, User, Phone, Mail, MapPin, ShoppingBag, Wrench } from "lucide-react";
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

interface ProductsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCart?: () => void;
  onRequireSignIn?: () => void;
  onBookingSuccess?: (bookingData: BookingConfirmationData) => void;
}

const ITEMS_PER_PAGE = 2;
const GST_RATE = 0.15;

const PRODUCT_GRADIENTS = [
  "linear-gradient(135deg, #0d1c2e 0%, #1a3a5c 50%, #0a1525 100%)",
  "linear-gradient(135deg, #1a1a0f 0%, #2a2a18 50%, #0f0f0a 100%)",
  "linear-gradient(135deg, #0f1a1a 0%, #1a3030 50%, #0a1414 100%)",
  "linear-gradient(135deg, #1a0f1a 0%, #2a1a2a 50%, #140a14 100%)",
  "linear-gradient(135deg, #0d1420 0%, #1e3040 50%, #081020 100%)",
];

type ProductCard = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  type: "product" | "service";
  available: boolean;
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
      const type: ProductCard["type"] = (
        rawType === "service"
        || rawType === "stock_service"
        || record.bookingRequired === true
        || record.fulfillmentType === "job"
      ) ? "service" : "product";
      const price = Number(record.price ?? record.displayPrice ?? record.sellPrice ?? record.unitPrice ?? record.sell_price ?? record.unit_price);
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
        id: Number(record.id ?? record.productId ?? index),
        name: String(record.name ?? record.title ?? record.label ?? "Untitled Item"),
        description: typeof record.description === "string" ? record.description : null,
        price: Number.isFinite(price) ? price : 0,
        type,
        available: record.available !== false && record.inStock !== false && record.in_stock !== false,
        bookingFields,
        shippingPresets: Array.isArray(record.shippingPresets) ? record.shippingPresets : undefined,
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
      };
    })
    .filter((item): item is ProductCard => item !== null && Number.isFinite(item.id) && item.id > 0);
}

const getProductShippingPresets = (product: ProductCard) => {
  const rawProduct = product as any;
  if (rawProduct.shippingPresets && Array.isArray(rawProduct.shippingPresets)) {
    return rawProduct.shippingPresets;
  }
  
  if (product.type === "product") {
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

export function ProductsPopup({ isOpen, onClose, onOpenCart, onRequireSignIn, onBookingSuccess }: ProductsPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: productsData, isLoading } = useListProducts();
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
  const [selectedShippingPresetIndex, setSelectedShippingPresetIndex] = useState<number>(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const products = normalizeProducts(productsData);
  const shopItems = products.filter((p) => p.type === "product");
  const serviceItems = products.filter((p) => p.type === "service");
  const totalPages = Math.ceil(shopItems.length / ITEMS_PER_PAGE);
  const currentShopItems = shopItems.slice(shopPage * ITEMS_PER_PAGE, (shopPage + 1) * ITEMS_PER_PAGE);
  const activePrice = (() => {
    if (!selectedService) return 0;
    if (selectedService.hasVariants && selectedService.variants) {
      const variant = selectedService.variants.find((v) => v.id === selectedVariantId);
      if (variant) return variant.sellPrice;
    }
    return selectedService.price;
  })();
  const pricing = selectedService ? getPricingBreakdown(activePrice) : null;

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
    }
  }, [isOpen]);

  const goToPage = (next: number) => {
    setSlideDir(next > shopPage ? 1 : -1);
    setShopPage(next);
  };

  const handleAddToCartWithShipping = (productId: number, shippingLabel?: string, shippingPrice?: number) => {
    addToCart.mutate({ data: { productId, quantity: 1, shippingLabel, shippingPrice } as any }, {
      onSuccess: () => {
        toast({ title: "Added to cart" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setShippingSelectProduct(null);
      },
    });
  };

  const onAddToCartClick = (item: ProductCard) => {
    const presets = getProductShippingPresets(item);
    if (presets.length > 1) {
      setShippingSelectProduct(item);
      setSelectedShippingPresetIndex(0);
    } else {
      const singlePreset = presets[0];
      handleAddToCartWithShipping(item.id, singlePreset?.label, singlePreset?.price);
    }
  };

  const openBookingModal = (service: ProductCard) => {
    setSelectedService(service);
    const defaultVariant = service.variants?.find((v) => v.isDefault) ?? service.variants?.[0];
    setSelectedVariantId(defaultVariant ? defaultVariant.id : null);
    setBookingForm((current) => ({
      ...emptyBookingForm,
      fullName: member?.name ?? current.fullName,
      email: member?.email ?? current.email,
      phone: current.phone,
      address1: current.address1,
      address2: current.address2,
      suburb: current.suburb,
      city: current.city,
      zipCode: current.zipCode,
      customFields: Object.fromEntries((service.bookingFields ?? []).map((field) => [field.id, current.customFields[field.id] ?? ""])),
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

  const updateBookingField = <K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) => {
    setBookingForm((current) => ({ ...current, [field]: value }));
  };

  const handleBookService = () => {
    if (!selectedService || !pricing) return;
    const serviceBookingFields = selectedService.bookingFields ?? [];

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
      onError: () => {
        toast({ title: "Booking failed", description: "We couldn't submit your booking right now.", variant: "destructive" });
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
        className="fixed inset-0 z-40 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="w-full max-w-2xl flex flex-col bg-[#080d14]/85 backdrop-blur-xl border border-primary/20 rounded-[28px] shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] pointer-events-auto h-[680px] max-h-[calc(100dvh-32px)]"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-primary/15 shrink-0">
            <h2 className="font-mono font-bold tracking-[0.2em] uppercase text-primary text-base">
              Offerings
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenCart}
                className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-primary/8 px-2.5 py-1 rounded-full border border-primary/20 hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                <span>{formatCurrency(cart?.total ?? 0)}</span>
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

          <div className="flex shrink-0 px-5 py-3 border-b border-primary/15 bg-[#05080e]/80">
            <div className="w-full flex bg-[#09101a] p-1.5 rounded-full border border-primary/25 shadow-inner">
              {(["shop", "services"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    data-testid={`tab-${tab}`}
                    className={`flex-1 py-2 px-4 rounded-full font-mono text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
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
                    <span>{tab === "shop" ? "Products & Stock" : "Services & Booking"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "shop" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground text-sm">
                    Loading products...
                  </div>
                ) : shopItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground text-sm">
                    No products available yet.
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden relative px-5 pt-4 pb-2" style={{ flex: "1 1 0" }}>
                      <AnimatePresence mode="wait" custom={slideDir}>
                        <motion.div
                          key={shopPage}
                          custom={slideDir}
                          variants={{
                            enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
                            center: { x: 0, opacity: 1 },
                            exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
                          }}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ type: "spring", stiffness: 380, damping: 36 }}
                          className="flex flex-col gap-3 h-full"
                        >
                          {currentShopItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row rounded-[18px] border border-primary/15 bg-[#0d1520]/60 backdrop-blur-md overflow-hidden hover:border-primary/35 transition-colors"
                              style={{ flex: "1 1 0", minHeight: 0 }}
                              data-testid={`card-product-${item.id}`}
                            >
                              <div
                                className="w-full h-24 sm:h-auto sm:w-52 shrink-0 flex items-center justify-center relative overflow-hidden"
                                style={{ background: PRODUCT_GRADIENTS[(shopPage * ITEMS_PER_PAGE + idx) % PRODUCT_GRADIENTS.length] }}
                              >
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(26,157,224,0.06) 4px, rgba(26,157,224,0.06) 5px)",
                                  }}
                                />
                                <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-primary/25 z-10 rotate-90 whitespace-nowrap">
                                  Image
                                </span>
                              </div>

                              <div className="flex flex-col justify-between p-4 flex-1 min-w-0">
                                <div>
                                  <div className="flex justify-between items-start gap-3 mb-2">
                                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight line-clamp-2 sm:truncate">{item.name}</h3>
                                    <span className="font-mono text-primary font-bold text-sm sm:text-base shrink-0">{formatCurrency(item.price)}</span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">{item.description}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 mt-3">
                                  <Button
                                    onClick={() => onAddToCartClick(item)}
                                    className="w-full font-mono uppercase tracking-widest text-[11px] h-9"
                                    disabled={addToCart.isPending || item.available === false}
                                    data-testid={`button-add-to-cart-${item.id}`}
                                  >
                                    {item.available === false ? "Unavailable" : "Add to Cart"}
                                  </Button>
                                  {item.type === "product" && (
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        onClose();
                                        setLocation(`/request-quote?productId=${item.id}`);
                                      }}
                                      className="w-full font-mono uppercase tracking-wider sm:tracking-widest text-[8px] sm:text-[9px] h-auto min-h-8 py-1 px-2 border border-primary/20 text-primary hover:bg-primary/10 hover:text-primary shrink-0 whitespace-normal text-center"
                                    >
                                      Request Quote with Shipping or Modifications
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {totalPages > 1 && (
                      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-primary/10">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(shopPage - 1)}
                          disabled={shopPage === 0}
                          className="h-8 w-8 text-primary disabled:opacity-25"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <div className="flex gap-1.5">
                          {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => goToPage(i)}
                              className={`rounded-full transition-all ${
                                i === shopPage
                                  ? "w-5 h-2 bg-primary"
                                  : "w-2 h-2 bg-primary/25 hover:bg-primary/50"
                              }`}
                              data-testid={`dot-page-${i}`}
                            />
                          ))}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(shopPage + 1)}
                          disabled={shopPage >= totalPages - 1}
                          className="h-8 w-8 text-primary disabled:opacity-25"
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "services" && (
              <div className="flex-1 scroll-industrial px-5 py-4 space-y-4">
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
                      className="rounded-[18px] border border-primary/15 bg-[#0d1520]/60 backdrop-blur-md p-5 hover:border-primary/35 transition-colors"
                      data-testid={`card-service-${item.id}`}
                    >
                      {item.hasVariants && (
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                            Customizable Options Inside
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-base text-foreground">{item.name}</h3>
                        <span className="font-mono text-primary font-bold text-base ml-2 shrink-0">
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
                className="pointer-events-auto w-full max-w-4xl overflow-y-auto scroll-industrial max-h-[calc(100dvh-32px)] rounded-[28px] border border-primary/20 bg-[#080d14]/95 shadow-[0_0_60px_rgba(26,157,224,0.18)]"
              >
                <div className="flex items-center justify-between border-b border-primary/15 bg-[#05080e]/80 px-6 py-4 sm:px-8 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.2em]">
                      <Wrench className="h-3 w-3" />
                      <span>Service Booking</span>
                    </div>
                    <h3 className="font-mono text-base sm:text-lg font-bold uppercase tracking-[0.12em] text-primary">
                      {selectedService.name}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeBookingModal}
                    className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
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
                      <div className="space-y-1.5">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Preferred Date <span className="text-destructive">*</span>
                        </label>
                        <Input
                          required
                          type="date"
                          value={bookingForm.bookingDate}
                          onChange={(e) => updateBookingField("bookingDate", e.target.value)}
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                          data-testid={`input-booking-date-${selectedService.id}`}
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
                                  value={bookingForm.customFields[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...current.customFields, [field.id]: e.target.value },
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
                                  value={bookingForm.customFields[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...current.customFields, [field.id]: e.target.value },
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
                                  value={bookingForm.customFields[field.id] ?? ""}
                                  onChange={(e) => setBookingForm((current) => ({
                                    ...current,
                                    customFields: { ...current.customFields, [field.id]: e.target.value },
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

                  <div className="border-t border-primary/10 bg-[#0d1520]/60 backdrop-blur-md p-6 lg:border-l lg:border-t-0">
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
                      handleAddToCartWithShipping(shippingSelectProduct.id, selected.label, selected.price);
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
      </AnimatePresence>
    </AnimatePresence>
  );
}
