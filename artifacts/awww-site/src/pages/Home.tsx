import { useState } from "react";
import { motion } from "framer-motion";
import mainLogo from "@assets/Logo_-_Main_Logo_1782352742134.png";
import { ParticleBackground } from "@/components/ParticleBackground";
import { BrandOrbs } from "@/components/BrandOrbs";
import { SmokeEffect } from "@/components/SmokeEffect";
import { BottomRightMenu } from "@/components/BottomRightMenu";
import { ProductsPopup } from "@/components/ProductsPopup";
import { MembersModal } from "@/components/MembersModal";

export default function Home() {
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  return (
    <div className="relative w-full h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground />
      <BrandOrbs />
      <SmokeEffect />

      {/* Center logo — no border */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
        <motion.div
          animate={{
            scale: [1, 1.02, 1],
            filter: [
              "drop-shadow(0 0 6px rgba(26, 157, 224, 0.2))",
              "drop-shadow(0 0 22px rgba(26, 157, 224, 0.55))",
              "drop-shadow(0 0 6px rgba(26, 157, 224, 0.2))",
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
            className="w-[280px] h-auto max-w-[80vw] block"
            data-testid="img-main-logo"
          />
        </motion.div>
      </div>

      {/* Top-left wordmark */}
      <div className="absolute top-6 left-6 z-10 hidden md:block pointer-events-none opacity-50">
        <h1 className="font-mono text-xs tracking-[0.3em] uppercase text-primary">A Woman With a Welder</h1>
        <p className="font-mono text-[10px] text-muted-foreground mt-1 tracking-widest">Industrial Steel Fabrication</p>
      </div>

      {/* Bottom-center footer */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/20">
          &copy; {new Date().getFullYear()} A Woman With a Welder. All rights reserved.
          <span className="mx-2 text-white/10">|</span>
          Built with <span className="text-primary/40">Replit</span>
        </p>
      </div>

      <BottomRightMenu
        onOpenMembers={() => setIsMembersOpen(true)}
        onOpenProducts={() => setIsProductsOpen(true)}
      />

      <ProductsPopup
        isOpen={isProductsOpen}
        onClose={() => setIsProductsOpen(false)}
      />

      <MembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />
    </div>
  );
}
