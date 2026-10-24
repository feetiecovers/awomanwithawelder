import { useState, useEffect, useMemo } from "react";
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
import { AxleBuilderPopup } from "@/components/AxleBuilderPopup";
import { ConfigurableProductPopup } from "@/components/ConfigurableProductPopup";
import { ParametricProductPopup } from "@/components/ParametricProductPopup";
import { CartPopup } from "@/components/CartPopup";
import { MembersModal } from "@/components/MembersModal";
import { OrderSuccessModal } from "@/components/OrderSuccessModal";
import { saveBookingConfirmation, type BookingConfirmationData } from "@/lib/bookingConfirmation";
import { buildApiUrl } from "@/lib/api-base";
import { useGetCart, useListProducts, getGetCartQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { saveProductsToCache, getCachedProducts } from "@/lib/productsCache";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [isConfigurableProductOpen, setIsConfigurableProductOpen] = useState(false);
  const [configurableProductId, setConfigurableProductId] = useState<number | null>(null);
  const [isParametricProductOpen, setIsParametricProductOpen] = useState(false);
  const [parametricProductId, setParametricProductId] = useState<number | null>(null);
  const [isAxleBuilderOpen, setIsAxleBuilderOpen] = useState(false);
  const [selectedAxleBuild, setSelectedAxleBuild] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Keep each workspace alive after its first use so its close/reopen behavior
  // is unchanged, but avoid mounting closed modal trees during the initial load.
  const [hasMountedProducts, setHasMountedProducts] = useState(false);
  const [hasMountedConfigurator, setHasMountedConfigurator] = useState(false);
  const [hasMountedAxleBuilder, setHasMountedAxleBuilder] = useState(false);
  const [hasMountedConfigurableProduct, setHasMountedConfigurableProduct] = useState(false);
  const [hasMountedParametricProduct, setHasMountedParametricProduct] = useState(false);
  const [hasMountedCart, setHasMountedCart] = useState(false);
  const [hasMountedMembers, setHasMountedMembers] = useState(false);

  const { toast } = useToast();
  const { data: cart } = useGetCart();
  const { data: liveProducts } = useListProducts({
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
    if (liveProducts && Array.isArray(liveProducts) && liveProducts.length > 0) {
      saveProductsToCache(liveProducts);
    }
  }, [liveProducts]);

  const activeAxleBuild = useMemo(() => {
    if (Array.isArray(liveProducts)) {
      const match = liveProducts.find((p: any) => p.id === 12 || p.type === "build" || Boolean(p.buildId));
      if (match) return match;
    }
    return selectedAxleBuild;
  }, [liveProducts, selectedAxleBuild]);
  const queryClient = useQueryClient();
  const cartCount = (cart?.items as { id: number }[] | undefined)?.length ?? 0;

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

  // Preload offerings images during idle so opening offerings is instantaneous
  useEffect(() => {
    const preload = () => {
      const urls = [
        "/assets/products/product_1_lawnmower_trailer.jpg",
        "/assets/products/product_9_drawbar_boxes.jpg",
        "/assets/products/product_10_coffee_tables.jpg",
        "/assets/products/product_11_planter_boxes.jpg",
        "/assets/products/trailer_axle_composite.jpg",
      ];
      urls.forEach((u) => {
        const img = new Image();
        img.src = u;
      });
    };
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(preload);
      } else {
        setTimeout(preload, 1200);
      }
    }
  }, []);

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
    setHasMountedCart(true);
    setIsProductsOpen(false);
    setIsCartOpen(true);
  };

  const handleContinueShopping = () => {
    setHasMountedProducts(true);
    setIsCartOpen(false);
    setIsProductsOpen(true);
  };

  const handleOpenProducts = () => {
    setHasMountedProducts(true);
    setIsProductsOpen(true);
  };

  const handleOpenConfigurator = () => {
    setHasMountedConfigurator(true);
    setIsConfiguratorOpen(true);
  };

  const handleOpenMembers = () => {
    setHasMountedMembers(true);
    setIsMembersOpen(true);
  };

  const isAnyModalOpen =
    isProductsOpen ||
    isConfiguratorOpen ||
    isAxleBuilderOpen ||
    isConfigurableProductOpen ||
    isParametricProductOpen ||
    isCartOpen ||
    isMembersOpen ||
    isOrderSuccessOpen ||
    isMenuOpen;

  return (
    <div className="relative w-full h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground isPaused={isAnyModalOpen} />
      <BrandOrbs onOpenConfigurator={handleOpenConfigurator} isPaused={isAnyModalOpen} />
      <SmokeEffect isPaused={isAnyModalOpen} />
      <FloatingSocials isPaused={isAnyModalOpen} />

      {/* Center logo — uninverted original colors, hardware-accelerated breathing */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
        <motion.div
          animate={
            isAnyModalOpen
              ? { scale: 1 }
              : { scale: [1, 1.025, 1] }
          }
          transition={{ duration: 4, repeat: isAnyModalOpen ? 0 : Infinity, ease: "easeInOut" }}
          className="pointer-events-auto cursor-pointer relative flex items-center justify-center"
          onClick={handleOpenProducts}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-testid="button-center-logo"
        >
          {/* Hardware-accelerated compositor glow layer behind logo */}
          <motion.div
            animate={
              isAnyModalOpen
                ? { opacity: 0.3 }
                : { opacity: [0.3, 0.75, 0.3] }
            }
            transition={{ duration: 4, repeat: isAnyModalOpen ? 0 : Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-primary/25 blur-2xl pointer-events-none scale-110"
          />
          <img
            src={mainLogo}
            alt="A Woman With a Welder"
            className="w-[190px] sm:w-[300px] md:w-[370px] h-auto max-w-[85vw] block relative z-10 drop-shadow-[0_0_18px_rgba(26,157,224,0.45)]"
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
        onOpenMembers={handleOpenMembers}
        onOpenProducts={handleOpenProducts}
        onOpenConfigurator={handleOpenConfigurator}
        onOpenChange={setIsMenuOpen}
      />

      {hasMountedProducts && <ProductsPopup
        isOpen={isProductsOpen}
        onClose={() => setIsProductsOpen(false)}
        onOpenCart={handleOpenCart}
        onRequireSignIn={handleOpenMembers}
        onBookingSuccess={handleBookingSuccess}
        onOpenConfigurator={handleOpenConfigurator}
        onOpenConfigurableProduct={(id) => {
          setConfigurableProductId(id);
          setHasMountedConfigurableProduct(true);
          setIsConfigurableProductOpen(true);
        }}
        onOpenParametricProduct={(id) => {
          setParametricProductId(id);
          setHasMountedParametricProduct(true);
          setIsParametricProductOpen(true);
        }}
        onOpenBuildProduct={(build) => {
          setSelectedAxleBuild(build);
          setHasMountedAxleBuilder(true);
          setIsAxleBuilderOpen(true);
        }}
      />}

      {hasMountedConfigurator && <TrailerConfiguratorPopup
        isOpen={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
        onRequireSignIn={handleOpenMembers}
      />}

      {hasMountedAxleBuilder && <AxleBuilderPopup
        isOpen={isAxleBuilderOpen}
        onClose={() => setIsAxleBuilderOpen(false)}
        build={activeAxleBuild}
        onRequireSignIn={handleOpenMembers}
      />}

      {hasMountedConfigurableProduct && <ConfigurableProductPopup
        isOpen={isConfigurableProductOpen}
        onClose={() => setIsConfigurableProductOpen(false)}
        productId={configurableProductId}
        onRequireSignIn={handleOpenMembers}
      />}

      {hasMountedParametricProduct && <ParametricProductPopup
        isOpen={isParametricProductOpen}
        onClose={() => setIsParametricProductOpen(false)}
        productId={parametricProductId}
        onRequireSignIn={handleOpenMembers}
      />}

      {hasMountedCart && <CartPopup
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onContinueShopping={handleContinueShopping}
        onOrderSuccess={() => setIsOrderSuccessOpen(true)}
      />}

      {hasMountedMembers && <MembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />}

      <OrderSuccessModal
        isOpen={isOrderSuccessOpen}
        onClose={() => setIsOrderSuccessOpen(false)}
      />
    </div>
  );
}
