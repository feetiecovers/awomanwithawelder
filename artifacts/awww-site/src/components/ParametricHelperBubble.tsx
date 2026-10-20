import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import type { ParametricHelperEntry } from "@/content/parametricHelpers";

interface ParametricHelperBubbleProps {
  helper: ParametricHelperEntry;
  align?: "left" | "right" | "center" | "auto";
  className?: string;
}

export function ParametricHelperBubble({
  helper,
  className = "",
}: ParametricHelperBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close when pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      {/* Boxed Question Mark Trigger Button */}
      <div
        className={`relative inline-flex items-center text-left ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={helper.title || "Help guide"}
          aria-expanded={isOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`relative inline-flex items-center justify-center w-[20px] h-[20px] rounded-[5px] transition-all duration-150 select-none shadow-[0_0_8px_rgba(26,157,224,0.2)] focus:outline-none cursor-pointer ${
            isOpen
              ? "bg-primary/30 border border-primary text-white shadow-[0_0_12px_rgba(26,157,224,0.5)]"
              : "bg-[#0b1b29] border border-primary/40 text-primary hover:bg-primary/20 hover:border-primary hover:text-white"
          }`}
        >
          <span className="font-mono text-[11px] font-black leading-none pointer-events-none">
            ?
          </span>
        </button>
      </div>

      {/* Centered Modal Popup in Portal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div
                className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
                role="dialog"
                aria-modal="true"
                aria-label={helper.title || "Dimension Guide"}
                onClick={() => setIsOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 10 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="relative w-full max-w-sm sm:max-w-md bg-[#081320] border-2 border-primary/45 rounded-2xl p-4 sm:p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(26,157,224,0.35)] flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Subtle ambient glow inside card */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-primary/25 pb-2.5">
                    <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate">
                      {helper.title || "Dimension Guide"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      aria-label="Close guide"
                      className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* High-res sketch/illustration */}
                  {helper.image && (
                    <div className="relative w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-primary/30 bg-black/70 shrink-0 flex items-center justify-center shadow-inner">
                      <img
                        src={helper.image}
                        alt={helper.imageAlt || helper.title || "Helper illustration"}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Text definition */}
                  {helper.definition && (
                    <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-sans select-text">
                      {helper.definition}
                    </p>
                  )}

                  {/* Close button for effortless touch dismissal */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full mt-1 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 font-mono text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(26,157,224,0.2)]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Got It
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
