import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Send,
  Image as ImageIcon,
  Sliders,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Mail,
  User,
  Phone,
  Sparkles,
  Calculator,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-base";
import { useQueryClient } from "@tanstack/react-query";
import { QuoteRequestModal } from "./QuoteRequestModal";
import { useListProducts, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import denversDeskIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import cableCadLogo from "@assets/Cable_CAD_Logo_EqualSize.png";
import trailerBrainLogo from "@assets/Trailer_Brain_Logo_EqualSize.png";

interface ConfigurableProductPopupProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRequireSignIn?: () => void;
}

const GST_RATE = 0.15;

export function ConfigurableProductPopup({ isOpen, onClose, productId }: ConfigurableProductPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rawProducts } = useListProducts();
  const addToCart = useAddToCart();

  const product = useMemo(() => {
    if (!rawProducts || !productId) return null;
    const items = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any).products ?? [];
    return items.find((p: any) => p.id === productId);
  }, [rawProducts, productId]);

  const optionGroups = useMemo(() => {
    if (!product || !Array.isArray(product.optionGroups)) return [];
    return product.optionGroups as any[];
  }, [product]);

  const commerceActions = useMemo(() => {
    if (!product || !product.commerceActions) {
      return { allowCheckout: false, allowQuoteRequest: true };
    }
    return {
      allowCheckout: product.commerceActions.allowCheckout === true,
      allowQuoteRequest: product.commerceActions.allowQuoteRequest !== false,
    };
  }, [product]);

  // Selections state: map of groupId -> array of selected optionIds
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // Quote Modal Overlay state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // Initialize default selections
  useEffect(() => {
    if (!product) return;
    const defaults: Record<string, string[]> = {};
    if (product.defaultConfiguration?.selections) {
      Object.assign(defaults, product.defaultConfiguration.selections);
    } else {
      optionGroups.forEach((group) => {
        const defaultOptions = group.options?.filter((o: any) => o.isDefault) || [];
        if (defaultOptions.length > 0) {
          defaults[group.id] = defaultOptions.map((o: any) => String(o.id));
        } else if (group.selectionType !== "multiple" && group.options?.length > 0) {
          defaults[group.id] = [String(group.options[0].id)];
        } else {
          defaults[group.id] = [];
        }
      });
    }
    setSelections(defaults);
    if (optionGroups.length > 0) {
      setOpenGroupId(optionGroups[0].id);
    }
  }, [product, optionGroups]);

  // Pricing calculation
  const { totalPriceAdjustment, selectedOptionIds, optionDetails } = useMemo(() => {
    let adjustment = 0;
    const selectedIds: string[] = [];
    const details: any[] = [];

    optionGroups.forEach((group) => {
      const selected = selections[group.id] || [];
      selected.forEach((optId) => {
        const opt = group.options?.find((o: any) => String(o.id) === optId);
        if (opt) {
          const priceAdj = Number(opt.priceAdjustment || opt.price || 0);
          adjustment += priceAdj;
          selectedIds.push(opt.id);
          details.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.label || opt.name,
            priceAdjustment: priceAdj
          });
        }
      });
    });

    return { totalPriceAdjustment: adjustment, selectedOptionIds: selectedIds, optionDetails: details };
  }, [optionGroups, selections]);

  const missingRequiredGroups = useMemo(() => {
    return optionGroups
      .filter((group) => group.required !== false && (selections[group.id] || []).length === 0)
      .map((group) => group.name || group.id)
      .filter(Boolean);
  }, [optionGroups, selections]);

  const configuredPrice = Number(product?.price || product?.sellPrice || product?.basePrice || 0);
  const subtotalExGst = configuredPrice + totalPriceAdjustment;
  const gstAmount = subtotalExGst * GST_RATE;
  const totalIncGst = subtotalExGst + gstAmount;

  const handleOptionToggle = (group: any, optionId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.selectionType !== "multiple") {
        if (current.includes(optionId) && !group.required) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [optionId] };
      }

      if (current.includes(optionId) && group.required && current.length === 1) {
        return prev;
      }
      
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [group.id]: updated };
    });
  };

  const handleConfigureAndBuy = () => {
    if (missingRequiredGroups.length > 0) {
      toast({
        title: "Required Options Missing",
        description: `Please select an option for: ${missingRequiredGroups.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    addToCart.mutate(
      {
        data: {
          productId: product.id,
          quantity: 1,
          configuration: {
            selections,
            selectedOptionIds,
            selectedOptions: optionDetails,
            totalPriceAdjustment,
          },
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Added to cart" });
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          onClose();
        },
        onError: () => {
          toast({
            title: "Failed to add to cart",
            description: "Please try again later.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <QuoteRequestModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        product={product}
        configuration={{
          selections,
          selectedOptionIds,
          selectedOptions: optionDetails,
          totalPriceAdjustment,
        }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Animated Glow Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0e0412]/85 backdrop-blur-xl transition-all"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{
            opacity: 1, scale: 1, y: 0,
            boxShadow: [
              "0 0 25px rgba(255, 42, 141, 0.4), inset 0 0 15px rgba(255, 42, 141, 0.2)",
              "0 0 45px rgba(255, 42, 141, 0.7), inset 0 0 25px rgba(255, 42, 141, 0.35)",
              "0 0 25px rgba(255, 42, 141, 0.4), inset 0 0 15px rgba(255, 42, 141, 0.2)",
            ],
            borderColor: [
              "rgba(255, 42, 141, 0.5)",
              "rgba(255, 42, 141, 0.95)",
              "rgba(255, 42, 141, 0.5)",
            ],
          }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{
            boxShadow: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            borderColor: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            duration: 0.3,
          }}
          className="relative w-full max-w-5xl h-[92dvh] bg-[#0e0412]/95 border-2 rounded-[24px] overflow-hidden flex flex-col z-10 text-white shadow-2xl backdrop-blur-2xl no-scrollbar"
        >
          {/* Header Bar */}
          <div className="relative flex items-center justify-between px-5 py-3 border-b border-[#ff2a8d]/20 bg-[#16061c]/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <img src={denversDeskIcon} alt="Denver's Desk" className="h-8 w-8 sm:h-8.5 sm:w-8.5 object-contain" />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center">
              <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
                <h2 className="text-xs xs:text-sm sm:text-lg font-black uppercase tracking-wider bg-gradient-to-r from-white via-pink-200 to-[#ff2a8d] bg-clip-text text-transparent whitespace-nowrap">
                  Configure &amp; Quote
                </h2>
                <span className="px-2 py-0.5 text-[8px] xs:text-[8.5px] font-mono font-bold uppercase tracking-widest bg-[#ff2a8d] text-white rounded-full shadow-[0_0_10px_rgba(255,42,141,0.7)] whitespace-nowrap">
                  {product.name}
                </span>
              </div>
            </div>

            <Button
              variant="ghost" size="icon" onClick={onClose}
              className="h-8.5 w-8.5 rounded-full bg-white/5 border border-pink-500/30 text-pink-200 hover:bg-[#ff2a8d]/30 hover:text-white transition-all shadow-[0_0_12px_rgba(255,42,141,0.3)] shrink-0"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
            {/* Options Builder Pane */}
            <div className="overflow-hidden flex flex-col justify-between p-3.5 sm:p-5 relative no-scrollbar">
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="mb-2 shrink-0 flex items-center justify-between border-b border-pink-500/15 pb-1.5">
                  <div>
                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5" />
                      Configuration Options
                    </h3>
                    <p className="text-[10.5px] text-pink-200/60 mt-0.5">
                      Select options below. Click any section header to expand.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 my-1 pr-0.5 no-scrollbar">
                  {optionGroups.map((group) => {
                    const isOpenGroup = openGroupId === group.id;
                    const currentSelection = selections[group.id] || [];

                    let summaryText = "None selected";
                    if (group.selectionType !== "multiple") {
                      const opt = group.options?.find((o: any) => currentSelection.includes(String(o.id)));
                      if (opt) summaryText = opt.label || opt.name;
                    } else if (currentSelection.length > 0) {
                      summaryText = `${currentSelection.length} selected`;
                    }

                    return (
                      <div
                        key={group.id}
                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                          isOpenGroup
                            ? "bg-[#180620]/95 border-[#ff2a8d] shadow-[0_0_18px_rgba(255,42,141,0.25)]"
                            : "bg-[#120417]/70 border-pink-500/20 hover:border-pink-500/40 hover:bg-[#16061c]/80"
                        }`}
                      >
                        <button
                          onClick={() => setOpenGroupId(isOpenGroup ? null : group.id)}
                          className="w-full p-3 flex items-center justify-between text-left gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${isOpenGroup ? "bg-[#ff2a8d] shadow-[0_0_8px_rgba(255,42,141,0.9)]" : "bg-pink-500/30"}`} />
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-white truncate">{group.name}</h4>
                              <p className="text-[9.5px] font-mono text-pink-200/60 truncate mt-0.5">
                                Selected: <span className="text-pink-300 font-semibold">{summaryText}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[8.5px] font-mono uppercase bg-pink-500/10 text-pink-300 border border-pink-500/20">
                              {group.selectionType === "multiple" ? "Multiple Choice" : "Single Choice"}
                            </span>
                            <div className={`p-1 rounded-full transition-transform duration-300 ${isOpenGroup ? "rotate-180 bg-[#ff2a8d]/20 text-[#ff2a8d]" : "text-pink-200/50"}`}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </button>

                        {isOpenGroup && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-3 pb-3 pt-1 border-t border-pink-500/15"
                          >
                            {group.description && <p className="text-[10.5px] text-pink-200/60 mb-2">{group.description}</p>}
                            
                            <div className="max-h-[240px] overflow-y-auto pr-0.5 no-scrollbar">
                              <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
                                {group.options?.map((opt: any) => {
                                  const isChecked = currentSelection.includes(String(opt.id));
                                  const priceAdj = Number(opt.priceAdjustment || opt.price || 0);
                                  
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => handleOptionToggle(group, String(opt.id))}
                                      className={`text-left border transition-all duration-200 flex items-center justify-between gap-1.5 p-2.5 rounded-xl text-xs ${
                                        isChecked
                                          ? "bg-[#ff2a8d]/20 border-[#ff2a8d] text-white shadow-[0_0_10px_rgba(255,42,141,0.3)]"
                                          : "bg-white/[0.02] border-pink-500/15 text-pink-200/70 hover:border-pink-500/35 hover:bg-white/[0.05]"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className={`w-4 h-4 rounded-${group.selectionType === "multiple" ? "md" : "full"} border flex items-center justify-center shrink-0 ${
                                            isChecked
                                              ? "bg-[#ff2a8d] border-[#ff2a8d] text-black shadow-[0_0_6px_rgba(255,42,141,0.8)]"
                                              : "border-pink-500/30"
                                          }`}>
                                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <span className="font-medium truncate leading-tight">{opt.label || opt.name}</span>
                                      </div>
                                      {priceAdj > 0 && (
                                        <span className="font-mono text-[9px] font-bold shrink-0 text-[#ff2a8d]">
                                          +NZ${priceAdj.toLocaleString()}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 flex items-center justify-between shrink-0 border-t border-pink-500/15">
                  <Button
                    variant="ghost" onClick={onClose}
                    className="h-8.5 px-3.5 rounded-xl border border-pink-500/20 text-pink-200 hover:bg-white/5 text-xs font-mono uppercase"
                  >
                    Close
                  </Button>
                  <div className="flex gap-2">
                    {commerceActions.allowQuoteRequest && (
                      <Button
                        onClick={() => setIsQuoteModalOpen(true)}
                        disabled={missingRequiredGroups.length > 0}
                        className="h-8.5 px-4.5 rounded-xl bg-white/5 border border-pink-500/30 hover:bg-pink-500/20 text-white font-mono font-bold text-xs uppercase"
                      >
                        Request Quote <Send className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    )}
                    {commerceActions.allowCheckout && (
                      <Button
                        onClick={handleConfigureAndBuy}
                        disabled={missingRequiredGroups.length > 0 || addToCart.isPending}
                        className="h-8.5 px-4.5 rounded-xl bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-white font-mono font-bold text-xs uppercase shadow-[0_0_15px_rgba(255,42,141,0.5)]"
                      >
                        {addToCart.isPending ? "Adding..." : "Configure & Buy"} <ShoppingCart className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Pane: Summary */}
            <div className="hidden lg:flex flex-col border-l border-[#ff2a8d]/20 bg-[#0a020d] p-5 relative overflow-hidden">
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2 mb-4">
                <Calculator className="w-4 h-4 text-[#ff2a8d]" />
                Summary
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-3">
                <div className="bg-[#120417] border border-pink-500/15 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white font-medium">{product.name}</span>
                    <span className="text-xs font-mono text-[#ff2a8d] font-bold">NZ${configuredPrice.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-pink-200/60">Base Price</div>
                </div>

                {optionDetails.map((opt, i) => (
                  <div key={i} className="bg-[#120417]/50 border border-pink-500/10 rounded-xl p-2.5 flex justify-between items-center">
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] text-white font-medium truncate">{opt.optionName}</div>
                      <div className="text-[9px] text-pink-200/50 truncate">{opt.groupName}</div>
                    </div>
                    {opt.priceAdjustment > 0 && (
                      <span className="text-[10px] font-mono text-pink-300 shrink-0">+NZ${opt.priceAdjustment.toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-pink-500/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-pink-200/60 font-mono uppercase tracking-widest">Est. Subtotal</span>
                  <span className="text-xs font-mono text-white">NZ${subtotalExGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] text-pink-200/60 font-mono uppercase tracking-widest">Est. GST (15%)</span>
                  <span className="text-xs font-mono text-white">NZ${gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center border-t border-pink-500/20 pt-2 pb-1">
                  <span className="text-sm text-white font-mono font-bold uppercase tracking-widest">Est. Total</span>
                  <span className="text-lg font-mono font-black text-[#ff2a8d]">
                    NZ${totalIncGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <QuoteRequestModal 
          isOpen={isQuoteModalOpen} 
          onClose={() => setIsQuoteModalOpen(false)} 
          product={product ? { 
            id: product.id, 
            name: product.name, 
            description: product.description || null, 
            price: totalIncGst, 
            image: product.image || (product.images?.[0]) || null 
          } : null} 
        />
      </div>
    </AnimatePresence>
  );
}
