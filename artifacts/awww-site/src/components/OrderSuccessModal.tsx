import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderSuccessModal({ isOpen, onClose }: OrderSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="order-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          key="order-panel"
          initial={{ opacity: 0, scale: 0.85, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="w-full max-w-sm bg-[#080d14] border border-primary/35 rounded-2xl shadow-[0_0_90px_rgba(26,157,224,0.3),0_8px_50px_rgba(0,0,0,0.95)] pointer-events-auto overflow-hidden"
        >
          {/* Close button row */}
          <div className="flex justify-end px-4 pt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="px-8 pb-8 pt-3 flex flex-col items-center text-center gap-5">
            {/* Animated success ring + sparks */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.1 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/35 flex items-center justify-center shadow-[0_0_50px_rgba(26,157,224,0.4)]">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>

              {/* Spark particles */}
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-primary"
                  style={{
                    width: i % 2 === 0 ? 6 : 4,
                    height: i % 2 === 0 ? 6 : 4,
                    top: "50%",
                    left: "50%",
                    marginTop: i % 2 === 0 ? -3 : -2,
                    marginLeft: i % 2 === 0 ? -3 : -2,
                  }}
                  animate={{
                    x: Math.cos((i * 45) * (Math.PI / 180)) * (i % 2 === 0 ? 52 : 38),
                    y: Math.sin((i * 45) * (Math.PI / 180)) * (i % 2 === 0 ? 52 : 38),
                    opacity: [0, 1, 0],
                    scale: [0, 1.4, 0],
                  }}
                  transition={{
                    delay: 0.25 + i * 0.04,
                    duration: 0.65,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-2"
            >
              <h2 className="font-mono font-bold text-xl tracking-[0.12em] uppercase text-primary">
                Order Confirmed
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Payment successful. We'll send a confirmation and get your order moving right away.
              </p>
            </motion.div>

            {/* Brand box */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="w-full p-3.5 rounded-xl bg-primary/5 border border-primary/15"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/55 mb-0.5">
                Thank you for supporting
              </p>
              <p className="font-mono text-sm font-bold text-foreground">
                A Woman With a Welder
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full"
            >
              <Button
                onClick={onClose}
                className="w-full font-mono uppercase tracking-widest text-xs h-10 bg-primary hover:bg-primary/90 shadow-[0_0_18px_rgba(26,157,224,0.4)]"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                Continue
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
