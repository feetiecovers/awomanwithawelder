import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ParametricHelperEntry } from "@/content/parametricHelpers";

interface ParametricHelperBubbleProps {
  helper: ParametricHelperEntry;
  align?: "left" | "right" | "center" | "auto";
  className?: string;
}

export function ParametricHelperBubble({
  helper,
  align = "auto",
  className = "",
}: ParametricHelperBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Determine alignment classes
  const getBubbleAlignmentClasses = () => {
    if (align === "right") {
      return "right-0 origin-top-right";
    }
    if (align === "center") {
      return "left-1/2 -translate-x-1/2 origin-top";
    }
    if (align === "left") {
      return "left-0 origin-top-left";
    }
    // "auto" alignment: left-aligned on desktop, smart clamping
    return "left-0 sm:left-0 origin-top-left";
  };

  const getArrowAlignmentClasses = () => {
    if (align === "right") {
      return "right-2.5";
    }
    if (align === "center") {
      return "left-1/2 -translate-x-1/2";
    }
    return "left-2.5";
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center text-left ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Boxed Question Mark Button */}
      <button
        type="button"
        aria-label={helper.title || "Help guide"}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`relative inline-flex items-center justify-center w-[19px] h-[19px] rounded-[5px] transition-all duration-150 select-none shadow-[0_0_8px_rgba(26,157,224,0.18)] focus:outline-none ${
          isOpen
            ? "bg-cyan-500/25 border border-cyan-300 text-white shadow-[0_0_12px_rgba(26,157,224,0.4)]"
            : "bg-[#0b1b29] border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-300 hover:text-white"
        }`}
      >
        <span className="font-mono text-[11px] font-black leading-none pointer-events-none">
          ?
        </span>
      </button>

      {/* Animated Attached Message Bubble */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -4 }}
            transition={{ type: "spring", stiffness: 480, damping: 28 }}
            role="dialog"
            aria-label={helper.title || "Parametric option helper"}
            className={`absolute top-full mt-2 z-50 w-[260px] sm:w-[280px] max-w-[calc(100vw-32px)] ${getBubbleAlignmentClasses()}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Speech bubble beak / arrow pointing to the boxed ? */}
            <div
              className={`absolute -top-1.5 w-3 h-3 rotate-45 bg-[#081320] border-t border-l border-cyan-400/35 z-10 ${getArrowAlignmentClasses()}`}
            />

            {/* Bubble Card Body */}
            <div className="relative overflow-hidden rounded-xl bg-[#081320]/95 backdrop-blur-2xl border border-cyan-400/35 p-3 text-white shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(26,157,224,0.25)] flex flex-col gap-2.5">
              {/* Subtle ambient glow inside card */}
              <div className="absolute -top-8 -right-8 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-cyan-400/15 pb-2">
                <h5 className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300 truncate">
                  {helper.title || "Option Guide"}
                </h5>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  aria-label="Close helper"
                  className="shrink-0 p-1 rounded text-cyan-200/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Small but visible image */}
              {helper.image && (
                <div className="relative w-full h-32 sm:h-36 rounded-lg overflow-hidden border border-cyan-400/20 bg-black/60 shrink-0">
                  <img
                    src={helper.image}
                    alt={helper.imageAlt || helper.title || "Helper illustration"}
                    className="w-full h-full object-contain p-1"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback gracefully if image fails to load
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Text definition */}
              {helper.definition && (
                <p className="text-xs text-cyan-100/90 leading-relaxed font-sans select-text">
                  {helper.definition}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
