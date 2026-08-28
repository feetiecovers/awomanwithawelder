import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import mainLogo from "@assets/A_Woman_With_A_Welder_Center_Logo_Clean_NoCableCAD.png";
import ddIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import { ParticleBackground } from "@/components/ParticleBackground";
import { BrandOrbs } from "@/components/BrandOrbs";
import { SmokeEffect } from "@/components/SmokeEffect";
import { FloatingSocials } from "@/components/FloatingSocials";
import { BottomRightMenu } from "@/components/BottomRightMenu";
import { ProductsPopup } from "@/components/ProductsPopup";
import { TrailerConfiguratorPopup } from "@/components/TrailerConfiguratorPopup";
import { ConfigurableProductPopup } from "@/components/ConfigurableProductPopup";
import { ParametricProductPopup } from "@/components/ParametricProductPopup";
import { CartPopup } from "@/components/CartPopup";
import { MembersModal } from "@/components/MembersModal";
import { OrderSuccessModal } from "@/components/OrderSuccessModal";
import { saveBookingConfirmation, type BookingConfirmationData } from "@/lib/bookingConfirmation";
import { buildApiUrl } from "@/lib/api-base";
import { useGetCart, getGetCartQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [isConfigurableProductOpen, setIsConfigurableProductOpen] = useState(false);
  const [configurableProductId, setConfigurableProductId] = useState<number | null>(null);
  const [isParametricProductOpen, setIsParametricProductOpen] = useState(false);
  const [parametricProductId, setParametricProductId] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);

  const { toast } = useToast();
  const { data: cart } = useGetCart();
  const queryClient = useQueryClient();
  const cartCount = (cart?.items as { id: number }[] | undefined)?.length ?? 0;

  // Pre-warm backend API immediately on page load to spin up Render free instance
  useEffect(() => {
    queryClient.prefetchQuery({ queryKey: getListProductsQueryKey() }).catch(() => {});
  }, [queryClient]);

  // Show welcome notification when site opens
  useEffect(() => {
    const timer = setTimeout(() => {
      toast({
        title: "Click on Logos!",
        description: "They do stuff.",
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Detect Stripe redirect back with ?payment=success or ?payment=cancel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      // Clear cart server-side then show success
      fetch(buildApiUrl("/api/cart/all"), { method: "DELETE", credentials: "include" })
        .catch(() => { })
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        });
      setIsOrderSuccessOpen(true);
      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient]);

  const handleBookingSuccess = (bookingData: BookingConfirmationData) => {
    saveBookingConfirmation(bookingData);
    setLocation("/booking-confirmation");
  };

  const handleOpenCart = () => {
    setIsProductsOpen(false);
    setIsCartOpen(true);
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    setIsProductsOpen(true);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground />
      <BrandOrbs onOpenConfigurator={() => setIsConfiguratorOpen(true)} />
      <SmokeEffect />
      <FloatingSocials />

      {/* Center logo — uninverted original colors, enlarged for desktop */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
        <motion.div
          animate={{
            scale: [1, 1.02, 1],
            filter: [
              "drop-shadow(0 0 12px rgba(26, 157, 224, 0.40)) drop-shadow(0 0 24px rgba(26, 157, 224, 0.20))",
              "drop-shadow(0 0 35px rgba(26, 157, 224, 0.75)) drop-shadow(0 0 50px rgba(96, 200, 255, 0.45))",
              "drop-shadow(0 0 12px rgba(26, 157, 224, 0.40)) drop-shadow(0 0 24px rgba(26, 157, 224, 0.20))",
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-auto cursor-pointer"
          onClick={() => setIsProductsOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-testid="button-center-logo"
        >
          <img
            src={mainLogo}
            alt="A Woman With a Welder"
            className="w-[190px] sm:w-[300px] md:w-[370px] h-auto max-w-[85vw] block"
            data-testid="img-main-logo"
          />
        </motion.div>
      </div>

      {/* Top-left attribution */}
      <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-center md:justify-start gap-2.5 pointer-events-none opacity-75">
        <img src={ddIcon} alt="Denver's Desk" className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(26,157,224,0.4)]" />
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest uppercase text-primary/90 font-semibold drop-shadow-sm">Powered by Denver's Desk</span>
      </div>

      {/* Bottom-center footer */}
      <div className="absolute bottom-3 sm:bottom-5 left-4 right-4 z-10 flex justify-center text-center pointer-events-none">
        <p className="font-mono text-[8px] sm:text-[9px] tracking-[0.2em] uppercase text-white/30 max-w-xs sm:max-w-none leading-relaxed">
          &copy; {new Date().getFullYear()} A Woman With a Welder |<br className="sm:hidden" /> All Rights Reserved | Copyright of Feetie Covers Limited 2026
          <span className="mx-2 text-white/20 hidden sm:inline">|</span>
          <span className="block sm:inline mt-1 sm:mt-0">Built by<span className="text-primary/60"> The Husband</span></span>
        </p>
      </div>

      {/* Floating cart badge — appears above menu button when cart has items */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            whileHover={{ scale: 1.1, boxShadow: "0 0 28px rgba(26,157,224,0.7)" }}
            whileTap={{ scale: 0.92 }}
            onClick={handleOpenCart}
            className="fixed bottom-[148px] right-4 sm:bottom-28 sm:right-6 z-50 w-11 h-11 rounded-full bg-[#080d14] border border-primary/50 flex items-center justify-center shadow-[0_0_18px_rgba(26,157,224,0.45)] cursor-pointer"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-[9px] font-mono font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(26,157,224,0.8)]">
              {cartCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <BottomRightMenu
        onOpenMembers={() => setIsMembersOpen(true)}
        onOpenProducts={() => setIsProductsOpen(true)}
        onOpenConfigurator={() => setIsConfiguratorOpen(true)}
      />

      <ProductsPopup
        isOpen={isProductsOpen}
        onClose={() => setIsProductsOpen(false)}
        onOpenCart={handleOpenCart}
        onRequireSignIn={() => setIsMembersOpen(true)}
        onBookingSuccess={handleBookingSuccess}
        onOpenConfigurator={() => setIsConfiguratorOpen(true)}
        onOpenConfigurableProduct={(id) => {
          setConfigurableProductId(id);
          setIsConfigurableProductOpen(true);
        }}
        onOpenParametricProduct={(id) => {
          setParametricProductId(id);
          setIsParametricProductOpen(true);
        }}
      />

      <TrailerConfiguratorPopup
        isOpen={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
        onRequireSignIn={() => setIsMembersOpen(true)}
      />

      <ConfigurableProductPopup
        isOpen={isConfigurableProductOpen}
        onClose={() => setIsConfigurableProductOpen(false)}
        productId={configurableProductId}
        onRequireSignIn={() => setIsMembersOpen(true)}
      />

      <ParametricProductPopup
        isOpen={isParametricProductOpen}
        onClose={() => setIsParametricProductOpen(false)}
        productId={parametricProductId}
        onRequireSignIn={() => setIsMembersOpen(true)}
      />

      <CartPopup
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onContinueShopping={handleContinueShopping}
        onOrderSuccess={() => setIsOrderSuccessOpen(true)}
      />

      <MembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />

      <OrderSuccessModal
        isOpen={isOrderSuccessOpen}
        onClose={() => setIsOrderSuccessOpen(false)}
      />
    </div>
  );
}
