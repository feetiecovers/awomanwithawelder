import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, ShoppingBag, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-base";
import {
  useGetCart,
  useRemoveFromCart,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CartPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueShopping: () => void;
  onOrderSuccess: () => void;
}

const PRODUCT_GRADIENTS = [
  "linear-gradient(135deg, #0d1c2e 0%, #1a3a5c 50%, #0a1525 100%)",
  "linear-gradient(135deg, #1a1a0f 0%, #2a2a18 50%, #0f0f0a 100%)",
  "linear-gradient(135deg, #0f1a1a 0%, #1a3030 50%, #0a1414 100%)",
  "linear-gradient(135deg, #1a0f1a 0%, #2a1a2a 50%, #140a14 100%)",
  "linear-gradient(135deg, #0d1420 0%, #1e3040 50%, #081020 100%)",
];

export function CartPopup({ isOpen, onClose, onContinueShopping, onOrderSuccess }: CartPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { data: cart, isLoading } = useGetCart();
  const removeFromCart = useRemoveFromCart();

  const items = (cart?.items as Array<{ productId: number; quantity: number; shippingLabel?: string; shippingPrice?: number; product: { name: string; price: number; description?: string | null } }>) ?? [];
  const total = cart?.total ?? 0;

  const handleRemove = (productId: number) => {
    removeFromCart.mutate({ productId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to remove item", variant: "destructive" });
      },
    });
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch(buildApiUrl("/api/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Checkout failed");
      }
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again shortly.";
      toast({ title: "Checkout unavailable", description: msg });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cart-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          key="cart-panel"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="w-full max-w-md flex flex-col bg-[#080d14] border border-primary/20 rounded-2xl shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] pointer-events-auto h-[560px] max-h-[calc(100dvh-32px)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-primary/15 shrink-0">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <h2 className="font-mono font-bold tracking-[0.2em] uppercase text-primary text-base">
                Shopping Cart
              </h2>
              {items.length > 0 && (
                <span className="font-mono text-xs text-muted-foreground">
                  ({items.length} {items.length === 1 ? "item" : "items"})
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-16 h-16 rounded-full bg-primary/8 border border-primary/20 flex items-center justify-center">
                  <ShoppingBag className="h-7 w-7 text-primary/40" />
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-sm text-foreground mb-1">Cart is empty</p>
                  <p className="font-mono text-xs text-muted-foreground">Add some items from our offerings</p>
                </div>
                <Button
                  onClick={onContinueShopping}
                  variant="outline"
                  className="font-mono uppercase tracking-widest text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9 mt-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  Browse Offerings
                </Button>
              </div>
            ) : (
              <div className="flex-1 scroll-industrial px-4 py-3 space-y-3">
                <AnimatePresence initial={false}>
                  {items.map((item, idx) => (
                    <motion.div
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
                      transition={{ type: "spring", stiffness: 340, damping: 28 }}
                      className="flex rounded-xl border border-primary/15 bg-[#0d1520]/80 overflow-hidden hover:border-primary/30 transition-colors"
                      style={{ height: "88px" }}
                    >
                      {/* Image strip */}
                      <div
                        className="w-20 shrink-0 flex items-center justify-center relative overflow-hidden"
                        style={{ background: PRODUCT_GRADIENTS[idx % PRODUCT_GRADIENTS.length] }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(26,157,224,0.06) 4px, rgba(26,157,224,0.06) 5px)",
                          }}
                        />
                        <span className="font-mono text-[7px] tracking-[0.2em] uppercase text-primary/25 z-10 rotate-90 whitespace-nowrap">
                          Image
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between p-3 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-bold text-sm text-foreground leading-tight truncate">
                              {item.product.name}
                            </h3>
                            {item.shippingLabel && (
                              <p className="text-[10px] text-primary/80 font-mono mt-0.5 leading-none">
                                + {item.shippingLabel}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemove(item.productId)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5 rounded"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </span>
                          <span className="font-mono text-primary font-bold text-sm">
                            NZ${((item.product.price + (item.shippingPrice ?? 0)) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Footer — sticky, only shown with items */}
          {items.length > 0 && (
            <div className="shrink-0 px-5 py-4 border-t border-primary/15 space-y-3">
              {/* Divider line with total */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Total
                </span>
                <span className="font-mono text-lg font-bold text-foreground">
                  NZ${total.toFixed(2)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={onContinueShopping}
                  variant="outline"
                  className="flex-1 font-mono uppercase tracking-widest text-[10px] border-primary/30 text-muted-foreground hover:text-primary hover:border-primary h-9"
                >
                  <ArrowLeft className="h-3 w-3 mr-1.5" /> Shop
                </Button>
                <Button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="flex-[2] font-mono uppercase tracking-widest text-[10px] h-9 bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(26,157,224,0.35)]"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Checkout with Stripe"
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
