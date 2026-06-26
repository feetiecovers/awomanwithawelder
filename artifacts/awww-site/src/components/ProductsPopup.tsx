import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListProducts,
  useGetCart,
  useAddToCart,
  useCreateBooking,
  getGetCartQueryKey,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ProductsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 2;

// Placeholder steel-texture image per product slot (CSS gradient — on-brand industrial look)
const PRODUCT_GRADIENTS = [
  "linear-gradient(135deg, #0d1c2e 0%, #1a3a5c 50%, #0a1525 100%)",
  "linear-gradient(135deg, #1a1a0f 0%, #2a2a18 50%, #0f0f0a 100%)",
  "linear-gradient(135deg, #0f1a1a 0%, #1a3030 50%, #0a1414 100%)",
  "linear-gradient(135deg, #1a0f1a 0%, #2a1a2a 50%, #140a14 100%)",
  "linear-gradient(135deg, #0d1420 0%, #1e3040 50%, #081020 100%)",
];

export function ProductsPopup({ isOpen, onClose }: ProductsPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useListProducts();
  const { data: cart } = useGetCart();
  const addToCart = useAddToCart();
  const createBooking = useCreateBooking();

  const [activeTab, setActiveTab] = useState<"shop" | "services">("shop");
  const [shopPage, setShopPage] = useState(0);
  const [slideDir, setSlideDir] = useState(1); // 1 = slide left, -1 = slide right

  const [bookingFormId, setBookingFormId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  const shopItems = products.filter(p => p.type === "product");
  const serviceItems = products.filter(p => p.type === "service");
  const totalPages = Math.ceil(shopItems.length / ITEMS_PER_PAGE);
  const currentShopItems = shopItems.slice(shopPage * ITEMS_PER_PAGE, (shopPage + 1) * ITEMS_PER_PAGE);

  const goToPage = (next: number) => {
    setSlideDir(next > shopPage ? 1 : -1);
    setShopPage(next);
  };

  const handleAddToCart = (productId: number) => {
    addToCart.mutate({ data: { productId, quantity: 1 } }, {
      onSuccess: () => {
        toast({ title: "Added to cart" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
    });
  };

  const handleBookService = (serviceId: number) => {
    createBooking.mutate({ data: { serviceId, preferredDate: bookingDate, notes: bookingNotes } }, {
      onSuccess: () => {
        toast({ title: "Booking requested", description: "We will confirm your date soon." });
        setBookingFormId(null);
        setBookingDate("");
        setBookingNotes("");
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      },
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centered floating popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="w-full max-w-md flex flex-col bg-[#080d14] border border-primary/20 rounded-2xl shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
        style={{ height: "560px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/15 shrink-0">
          <h2 className="font-mono font-bold tracking-[0.2em] uppercase text-primary text-base">
            Offerings
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-primary/8 px-2.5 py-1 rounded-full border border-primary/20">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span>NZ${cart?.total?.toFixed(2) || "0.00"}</span>
            </div>
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

        {/* Tab switcher */}
        <div className="flex shrink-0 border-b border-primary/10">
          {(["shop", "services"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
              className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ── SHOP TAB ── */}
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
                  {/* Sliding product cards — compact, 2 fit without scrolling */}
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
                            className="flex rounded-xl border border-primary/15 bg-[#0d1520]/80 overflow-hidden hover:border-primary/35 transition-colors"
                            style={{ flex: "1 1 0", minHeight: 0 }}
                            data-testid={`card-product-${item.id}`}
                          >
                            {/* Image strip on the left */}
                            <div
                              className="w-24 shrink-0 flex items-center justify-center relative overflow-hidden"
                              style={{ background: PRODUCT_GRADIENTS[(shopPage * ITEMS_PER_PAGE + idx) % PRODUCT_GRADIENTS.length] }}
                            >
                              <div className="absolute inset-0"
                                style={{
                                  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(26,157,224,0.06) 4px, rgba(26,157,224,0.06) 5px)",
                                }}
                              />
                              <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-primary/25 z-10 rotate-90 whitespace-nowrap">
                                Image
                              </span>
                            </div>

                            {/* Right content */}
                            <div className="flex flex-col justify-between p-3 flex-1 min-w-0">
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-1">
                                  <h3 className="font-bold text-sm text-foreground leading-tight truncate">{item.name}</h3>
                                  <span className="font-mono text-primary font-bold text-sm shrink-0">NZ${item.price.toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{item.description}</p>
                              </div>
                              <Button
                                onClick={() => handleAddToCart(item.id)}
                                className="w-full font-mono uppercase tracking-widest text-[10px] h-7 mt-2"
                                disabled={addToCart.isPending}
                                data-testid={`button-add-to-cart-${item.id}`}
                              >
                                Add to Cart
                              </Button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Page navigation */}
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

          {/* ── SERVICES TAB ── */}
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
                serviceItems.map(item => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-primary/15 bg-[#0d1520]/80 p-4 hover:border-primary/35 transition-colors"
                    data-testid={`card-service-${item.id}`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                      <span className="font-mono text-primary font-bold text-sm ml-2 shrink-0">
                        From NZ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{item.description}</p>

                    {bookingFormId === item.id ? (
                      <div className="space-y-2.5 pt-3 border-t border-border">
                        <Input
                          type="date"
                          value={bookingDate}
                          onChange={e => setBookingDate(e.target.value)}
                          className="bg-input font-mono text-sm h-9"
                          data-testid={`input-date-${item.id}`}
                        />
                        <Textarea
                          placeholder="Any specific requirements?"
                          value={bookingNotes}
                          onChange={e => setBookingNotes(e.target.value)}
                          className="bg-input font-mono text-sm resize-none h-16"
                          data-testid={`input-notes-${item.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleBookService(item.id)}
                            className="flex-1 font-mono uppercase tracking-widest text-xs h-8"
                            disabled={createBooking.isPending}
                            data-testid={`button-confirm-booking-${item.id}`}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setBookingFormId(null)}
                            className="font-mono uppercase tracking-widest text-xs border-primary/30 h-8"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setBookingFormId(item.id)}
                        variant="outline"
                        className="w-full font-mono uppercase tracking-widest text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground h-8"
                        data-testid={`button-book-service-${item.id}`}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-2" /> Book Service
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
      </div>
    </AnimatePresence>
  );
}
