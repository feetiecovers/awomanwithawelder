import { motion, AnimatePresence } from "framer-motion";
import { Calendar, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName?: string;
}

export function BookingSuccessModal({ isOpen, onClose, serviceName }: BookingSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="booking-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          key="booking-panel"
          initial={{ opacity: 0, scale: 0.85, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="w-full max-w-sm bg-[#080d14] border border-primary/35 rounded-2xl shadow-[0_0_90px_rgba(26,157,224,0.3),0_8px_50px_rgba(0,0,0,0.95)] pointer-events-auto overflow-hidden"
        >
          {/* Close row */}
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
            {/* Calendar icon with pulse ring */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.1 }}
              className="relative"
            >
              {/* Outer pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-primary/40"
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{ margin: -8 }}
              />
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/35 flex items-center justify-center shadow-[0_0_50px_rgba(26,157,224,0.4)]">
                <Calendar className="h-10 w-10 text-primary" />
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <h2 className="font-mono font-bold text-xl tracking-[0.12em] uppercase text-primary">
                Booking Requested
              </h2>
              {serviceName && (
                <p className="font-mono text-xs text-primary/60 uppercase tracking-widest">
                  {serviceName}
                </p>
              )}
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Your booking request has been submitted. We'll review it and reach out to confirm your date.
              </p>
            </motion.div>

            {/* What happens next */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-left space-y-2"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Clock className="h-3.5 w-3.5 text-primary/60" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary/55">
                  What happens next
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Expect a confirmation within 1–2 business days. We'll be in touch to lock in the details!
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              className="w-full"
            >
              <Button
                onClick={onClose}
                className="w-full font-mono uppercase tracking-widest text-xs h-10 bg-primary hover:bg-primary/90 shadow-[0_0_18px_rgba(26,157,224,0.4)]"
              >
                Sounds good
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
