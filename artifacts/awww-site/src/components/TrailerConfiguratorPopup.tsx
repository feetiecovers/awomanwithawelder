import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Truck,
  Layers,
  Wrench,
  Shield,
  Send,
  CheckCircle2,
  Maximize2,
  DollarSign,
  Info,
  Sliders,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  TRAILER_CATEGORIES,
  TRAILER_BUILDS,
  FEATURE_GROUPS,
  type TrailerCategory,
  type TrailerBuild,
  type FeatureGroupWithOptions,
  type FeatureOption
} from "@/lib/configuratorData";
import { getTrailerIcon } from "./TrailerIcons";
import ladyLuggerLogo from "@assets/Lady_Lugger_Logo_Cropped.png";
import denversDeskIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import cableCadLogo from "@assets/Cable_CAD_Logo_EqualSize.png";
import trailerBrainLogo from "@assets/Trailer_Brain_Logo_EqualSize.png";

interface TrailerConfiguratorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onRequireSignIn?: () => void;
}

interface QuoteFormState {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  postcode: string;
  notes: string;
}

const GST_RATE = 0.15;

export function TrailerConfiguratorPopup({ isOpen, onClose }: TrailerConfiguratorPopupProps) {
  const { toast } = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(1);
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Record<number, number | number[]>>({});
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [activePreviewLabel, setActivePreviewLabel] = useState<string>("");
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [deliveryRequired, setDeliveryRequired] = useState<string>("no");

  const [quoteForm, setQuoteForm] = useState<QuoteFormState>({
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    postcode: "",
    notes: "",
  });

  const selectedCategory = TRAILER_CATEGORIES.find((c) => c.id === selectedCategoryId) || TRAILER_CATEGORIES[0];
  const availableBuilds = TRAILER_BUILDS.filter((b) => b.trailerTypeId === selectedCategoryId);

  // Auto select first build when category changes
  useEffect(() => {
    if (availableBuilds.length > 0) {
      setSelectedBuildId(availableBuilds[0].id);
      setActivePreviewImage(availableBuilds[0].imageUrl || null);
      setActivePreviewLabel(availableBuilds[0].name);
    }
  }, [selectedCategoryId]);

  // Set default included options
  useEffect(() => {
    const defaults: Record<number, number | number[]> = {};
    FEATURE_GROUPS.forEach((group) => {
      if (group.selectionType === "single") {
        const included = group.options.find((opt) => opt.isIncluded);
        defaults[group.id] = included ? included.id : group.options[0]?.id ?? 0;
      } else {
        defaults[group.id] = group.options.filter((opt) => opt.isIncluded).map((opt) => opt.id);
      }
    });
    setSelectedFeatures(defaults);
  }, []);

  const selectedBuild = TRAILER_BUILDS.find((b) => b.id === selectedBuildId) || availableBuilds[0];

  // Calculate pricing breakdown
  const selectedAddons = useMemo(() => {
    const list: { groupName: string; optionName: string; price: number }[] = [];
    FEATURE_GROUPS.forEach((group) => {
      const selection = selectedFeatures[group.id];
      if (selection === undefined) return;

      if (group.selectionType === "single") {
        const option = group.options.find((opt) => opt.id === selection);
        if (option && option.price > 0) {
          list.push({ groupName: group.name, optionName: option.name, price: option.price });
        }
      } else if (Array.isArray(selection)) {
        selection.forEach((optId) => {
          const option = group.options.find((opt) => opt.id === optId);
          if (option && option.price > 0) {
            list.push({ groupName: group.name, optionName: option.name, price: option.price });
          }
        });
      }
    });
    return list;
  }, [selectedFeatures]);

  const basePrice = selectedBuild ? selectedBuild.basePrice : 0;
  const addonsTotal = selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const totalIncGst = basePrice + addonsTotal;
  const subtotalExGst = totalIncGst / (1 + GST_RATE);
  const gstAmount = totalIncGst - subtotalExGst;

  const handleFeatureToggle = (
    group: FeatureGroupWithOptions,
    option: FeatureOption
  ) => {
    if (option.isIncluded) return; // Included default

    setSelectedFeatures((prev) => {
      if (group.selectionType === "single") {
        return { ...prev, [group.id]: option.id };
      }
      const currentArr = (prev[group.id] as number[]) || [];
      const updated = currentArr.includes(option.id)
        ? currentArr.filter((id) => id !== option.id)
        : [...currentArr, option.id];
      return { ...prev, [group.id]: updated };
    });

    if (option.imageUrl) {
      setActivePreviewImage(option.imageUrl);
      setActivePreviewLabel(`${group.name}: ${option.name}`);
    }
  };

  const handleBuildSelect = (build: TrailerBuild) => {
    setSelectedBuildId(build.id);
    if (build.imageUrl) {
      setActivePreviewImage(build.imageUrl);
      setActivePreviewLabel(build.name);
    }
  };

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.fullName || !quoteForm.email || !quoteForm.phone) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter your name, email, and phone number.",
        variant: "destructive",
      });
      return;
    }

    const payloadAddress = quoteForm.streetAddress.trim() ? `\n[Street Address: ${quoteForm.streetAddress.trim()}]` : "";
    const payloadNotes = `${quoteForm.notes.trim()}${payloadAddress}\n[Delivery Option: ${deliveryRequired === "yes" ? "Yes - Delivery Required" : "No - Depot Pickup"}]`;
    setQuoteForm((prev) => ({ ...prev, notes: payloadNotes }));

    setIsSubmitted(true);
    toast({
      title: "Quote Submitted Successfully!",
      description: `Thank you ${quoteForm.fullName}! Our team will contact you shortly regarding your custom build.`,
    });
  };

  const resetQuoteForm = () => {
    setIsQuoteModalOpen(false);
    setIsSubmitted(false);
    setQuoteForm({ fullName: "", email: "", phone: "", streetAddress: "", postcode: "", notes: "" });
  };

  const CategoryIcon = getTrailerIcon(selectedCategory.name);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Animated Hot Pink Glow Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0e0412]/85 backdrop-blur-xl transition-all"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
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
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{
            boxShadow: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            borderColor: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            duration: 0.35,
          }}
          className="relative w-full max-w-6xl h-[92dvh] bg-[#0e0412]/95 border-2 rounded-[28px] overflow-hidden flex flex-col z-10 text-white shadow-2xl backdrop-blur-2xl"
          style={{
            backgroundImage: "radial-gradient(ellipse at top right, rgba(255,42,141,0.15), transparent 60%), radial-gradient(ellipse at bottom left, rgba(147,51,234,0.12), transparent 70%)"
          }}
        >
          {/* Header Bar */}
          <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#ff2a8d]/20 bg-[#16061c]/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <img
                src={denversDeskIcon}
                alt="Denver's Desk"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] shrink-0"
              />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black uppercase tracking-wider bg-gradient-to-r from-white via-pink-200 to-[#ff2a8d] bg-clip-text text-transparent">
                  Trailer Configurator™
                </h2>
                <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest bg-[#ff2a8d] text-white rounded-full shadow-[0_0_10px_rgba(255,42,141,0.7)]">
                  Lady Lugger Edition
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/5 border border-pink-500/30 text-pink-200 hover:bg-[#ff2a8d]/30 hover:text-white transition-all shadow-[0_0_12px_rgba(255,42,141,0.3)]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Sub-Header Credits Bar: CableCAD & Trailer Brain */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 py-1.5 px-4 bg-[#0a030d] border-b border-[#ff2a8d]/15 text-[11px] sm:text-xs font-mono text-pink-200/80 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span>Wired with help from</span>
              <img src={cableCadLogo} alt="CableCAD" className="h-6 sm:h-7.5 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity filter drop-shadow inline-block" />
            </div>
            <span className="text-pink-500/40 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span>Electrically tested using</span>
              <img src={trailerBrainLogo} alt="The Trailer Brain" className="h-4.5 sm:h-5.5 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity filter drop-shadow inline-block" />
            </div>
          </div>

          {/* Category Selector Tabs Bar - hidden scrollbar track */}
          <div className="px-5 py-2.5 border-b border-[#ff2a8d]/15 bg-[#120417]/90 shrink-0 overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 min-w-max">
              {TRAILER_CATEGORIES.map((cat) => {
                const isActive = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 border ${
                      isActive
                        ? "bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-[#ffffff] border-[#ff2a8d] shadow-[0_0_20px_rgba(255,42,141,0.7)] scale-[1.03]"
                        : "bg-white/[0.03] text-pink-200/60 border-pink-500/15 hover:bg-[#ff2a8d]/15 hover:text-pink-100 hover:border-pink-500/40"
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Body Grid */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            {/* Left Content Area: Category Details, Builds, Feature Accordions */}
            <div className="overflow-y-auto pt-2.5 pb-4 px-5 space-y-3 scrollbar-thin scrollbar-thumb-pink-500/30">

              {/* Lady Lugger Hero Brand Header - tight 10px margin */}
              <div className="p-0 -mt-1 mb-1 py-0 flex flex-col items-center justify-center text-center shrink-0">
                <img
                  src={ladyLuggerLogo}
                  alt="The Lady Lugger"
                  className="w-[75%] max-w-[650px] h-auto max-h-[160px] sm:max-h-[190px] object-contain drop-shadow-[0_0_35px_rgba(255,42,141,0.9)] p-0 m-0 block"
                />
              </div>

              {/* Step 1: Base Build Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ff2a8d] text-black font-black text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(255,42,141,0.8)]">1</span>
                    Select Base Build Model
                  </span>
                  <span className="text-[10px] font-mono text-pink-200/50">
                    {availableBuilds.length} builds available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableBuilds.map((build) => {
                    const isSelected = selectedBuild?.id === build.id;
                    return (
                      <div
                        key={build.id}
                        onClick={() => handleBuildSelect(build)}
                        className={`cursor-pointer rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#25092b]/90 border-[#ff2a8d] shadow-[0_0_25px_rgba(255,42,141,0.45)] ring-1 ring-[#ff2a8d]"
                            : "bg-[#14051a]/60 border-pink-500/15 hover:border-pink-500/40 hover:bg-[#1f0727]/50"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 text-[#ff2a8d]">
                            <CheckCircle2 className="h-5 w-5 drop-shadow-[0_0_6px_rgba(255,42,141,0.8)]" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-sm text-white">{build.name}</h4>
                          <p className="text-xs text-pink-200/60 mt-1 line-clamp-2">{build.description}</p>
                        </div>
                        <div className="mt-4 pt-2 border-t border-pink-500/15 flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-pink-200/40">Base Price</span>
                          <span className="font-mono font-black text-sm text-[#ff2a8d]">
                            NZ${build.basePrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Custom Options & Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ff2a8d] text-black font-black text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(255,42,141,0.8)]">2</span>
                    Configure Categories &amp; Options
                  </span>
                  <span className="text-[10px] font-mono text-pink-200/50">
                    Click options to select
                  </span>
                </div>

                <div className="space-y-4">
                  {FEATURE_GROUPS.map((group) => {
                    const currentSelection = selectedFeatures[group.id];

                    return (
                      <div
                        key={group.id}
                        className="rounded-2xl border border-pink-500/20 bg-[#16061c]/70 p-4 shadow-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{group.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-pink-500/10 text-pink-300 border border-pink-500/30">
                              {group.selectionType === "single" ? "Single Choice" : "Multiple Select"}
                            </span>
                          </h5>
                        </div>
                        {group.description && (
                          <p className="text-xs text-pink-200/50 mb-3">{group.description}</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.options.map((opt) => {
                            const isChecked = group.selectionType === "single"
                              ? currentSelection === opt.id
                              : Array.isArray(currentSelection) && currentSelection.includes(opt.id);

                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleFeatureToggle(group, opt)}
                                className={`text-left p-3 rounded-xl border text-xs transition-all duration-200 flex items-center justify-between gap-3 ${
                                  isChecked
                                    ? "bg-[#ff2a8d]/20 border-[#ff2a8d] text-white shadow-[0_0_15px_rgba(255,42,141,0.35)]"
                                    : "bg-white/[0.02] border-pink-500/15 text-pink-200/70 hover:border-pink-500/35 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded-${group.selectionType === "single" ? "full" : "md"} border flex items-center justify-center shrink-0 ${
                                      isChecked
                                        ? "bg-[#ff2a8d] border-[#ff2a8d] text-black shadow-[0_0_8px_rgba(255,42,141,0.8)]"
                                        : "border-pink-500/30"
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="font-medium truncate">{opt.name}</span>
                                </div>
                                <span className="font-mono text-[11px] font-bold shrink-0 text-[#ff2a8d]">
                                  {opt.isIncluded ? "Included" : `+NZ$${opt.price}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right Pane: Visual Image Spot & Summary Sidebar (compact, no scrollbar track) */}
            <div className="border-t lg:border-t-0 lg:border-l border-[#ff2a8d]/20 bg-[#110417]/95 p-4 flex flex-col justify-between overflow-y-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

              <div className="space-y-5">
                {/* Visual Image Preview Spot */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4" />
                      Visual Build Preview
                    </span>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-[#ff2a8d]/30 bg-[#1a0822] aspect-video w-full flex items-center justify-center shadow-[0_0_20px_rgba(255,42,141,0.25)] group">
                    {activePreviewImage ? (
                      <img
                        src={activePreviewImage}
                        alt={activePreviewLabel}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="p-6 text-center flex flex-col items-center gap-2 text-pink-300/60">
                        <CategoryIcon className="w-16 h-16 text-[#ff2a8d]/60" />
                        <span className="text-xs font-mono">Select a build or option to preview</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3">
                      <p className="text-xs font-bold text-white truncate">{activePreviewLabel || selectedBuild?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Selected Category Info Badge under Image & above Cost Breakdown */}
                <div className="rounded-xl border border-pink-500/20 bg-[#180620]/90 p-3 flex items-start gap-3 shadow-[0_0_15px_rgba(255,42,141,0.15)]">
                  <div className="p-2 rounded-lg bg-[#ff2a8d]/15 border border-[#ff2a8d]/30 text-[#ff2a8d] shrink-0">
                    <CategoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[#ff2a8d] font-bold block">Trailer Category</span>
                    <h5 className="font-bold text-xs text-white">{selectedCategory.name}</h5>
                    <p className="text-[11px] text-pink-200/60 leading-tight mt-0.5">{selectedCategory.description}</p>
                  </div>
                </div>

                {/* Configuration Summary & Pricing */}
                <div className="rounded-2xl border border-pink-500/25 bg-[#17061f] p-4 space-y-3">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white border-b border-pink-500/20 pb-2">
                    Build Cost Breakdown
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-pink-200/70 font-semibold">
                      <span>{selectedBuild?.name || "Base Trailer Build"}</span>
                      <span className="font-mono text-white">NZ${basePrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-pink-500/20 space-y-1.5 font-mono">
                    <div className="flex justify-between text-xs text-pink-200/60">
                      <span>Subtotal (Excl. GST)</span>
                      <span>NZ${subtotalExGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-pink-200/60">
                      <span>15% GST</span>
                      <span>NZ${gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-[#ff2a8d] pt-2 border-t border-pink-500/30">
                      <span>Total Estimated Cost</span>
                      <span className="drop-shadow-[0_0_8px_rgba(255,42,141,0.8)]">
                        NZ${totalIncGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Quote CTA */}
              <div className="pt-4 mt-4 border-t border-pink-500/20">
                <Button
                  onClick={() => setIsQuoteModalOpen(true)}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#ff2a8d] via-[#e11d48] to-[#9333ea] text-white font-mono font-bold uppercase tracking-wider text-xs shadow-[0_0_25px_rgba(255,42,141,0.7)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Request Official Quote &amp; Specs
                </Button>
              </div>

            </div>
          </div>
        </motion.div>

        {/* Quote Modal Overlay */}
        <AnimatePresence>
          {isQuoteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsQuoteModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-4xl max-h-[88dvh] bg-[#16061c] border-2 border-[#ff2a8d] rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(255,42,141,0.7)] z-10 text-white overflow-y-auto scrollbar-thin scrollbar-thumb-pink-500/30"
              >
                <div className="flex items-center justify-between mb-4 border-b border-pink-500/20 pb-3">
                  <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-wide flex items-center gap-2">
                    <img src={denversDeskIcon} alt="Denver's Desk" className="h-5.5 w-auto object-contain inline-block filter drop-shadow" />
                    Request Build Quote
                  </h3>
                  <button onClick={() => setIsQuoteModalOpen(false)} className="text-pink-300 hover:text-white p-1">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {isSubmitted ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-[#ff2a8d]/20 border border-[#ff2a8d] text-[#ff2a8d] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,42,141,0.6)]">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-white">Quote Submitted!</h4>
                    <p className="text-xs text-pink-200/70 max-w-md mx-auto">
                      Your trailer build estimate of <span className="text-[#ff2a8d] font-bold">NZ${totalIncGst.toLocaleString()}</span> has been recorded. Our engineering &amp; fabrication team will send detailed drawings to <span className="text-white font-bold">{quoteForm.email}</span>.
                    </p>
                    <Button
                      onClick={resetQuoteForm}
                      className="mt-4 bg-[#ff2a8d] hover:bg-pink-600 text-white font-mono font-bold text-xs uppercase px-6 py-2 rounded-xl shadow-[0_0_15px_rgba(255,42,141,0.5)]"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitQuote} className="grid grid-cols-1 md:grid-cols-[360px_1fr] lg:grid-cols-[380px_1fr] gap-6">
                    {/* Left Column: Build Image & Full Unclipped Extras Listing */}
                    <div className="space-y-4 bg-[#0f0414] p-4 rounded-2xl border border-pink-500/20">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#ff2a8d] font-bold block">Selected Model</span>
                        <h4 className="text-sm font-bold text-white">{selectedBuild?.name}</h4>
                        <span className="text-[11px] text-pink-200/60 font-mono">{selectedCategory.name}</span>
                      </div>

                      {activePreviewImage && (
                        <div className="rounded-xl overflow-hidden border border-pink-500/30 aspect-video w-full">
                          <img src={activePreviewImage} alt={activePreviewLabel} className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Itemized Extras Listing - Wider readable text */}
                      <div className="space-y-2 pt-2 border-t border-pink-500/20">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 font-bold block">Configured Extras ({selectedAddons.length})</span>
                        {selectedAddons.length === 0 ? (
                          <p className="text-[11px] text-pink-200/40 italic">Standard build specifications</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pink-500/20">
                            {selectedAddons.map((addon, index) => (
                              <div key={index} className="flex justify-between items-start text-[11px] text-pink-200/90 gap-2">
                                <span className="leading-snug pr-1">• {addon.groupName}: {addon.optionName}</span>
                                <span className="font-mono text-pink-300 shrink-0">+${addon.price}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Total Pricing Box */}
                      <div className="pt-3 border-t border-pink-500/30 space-y-1 font-mono text-xs">
                        <div className="flex justify-between text-pink-200/60">
                          <span>Base Build:</span>
                          <span>NZ${basePrice.toLocaleString()}</span>
                        </div>
                        {addonsTotal > 0 && (
                          <div className="flex justify-between text-pink-300">
                            <span>Selected Extras:</span>
                            <span>+NZ${addonsTotal.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs font-bold text-[#ff2a8d] pt-2 border-t border-pink-500/20">
                          <span>Total Estimated:</span>
                          <span>NZ${totalIncGst.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Contact Details & Delivery Required */}
                    <div className="space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <p className="text-xs text-pink-200/80 leading-relaxed mb-1">
                          Complete the Contact Details information and A Woman With a Welder will get back to you with a confirmed quote and design. If you have any questions before then feel free to email <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-[#ff2a8d] font-bold underline hover:text-pink-300 transition-colors">charlotte@awomanwithawelder.co.nz</a>.
                        </p>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Full Name *</label>
                          <Input
                            required
                            value={quoteForm.fullName}
                            onChange={(e) => setQuoteForm({ ...quoteForm, fullName: e.target.value })}
                            placeholder="Denver Smith"
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Email Address *</label>
                          <Input
                            required
                            type="email"
                            value={quoteForm.email}
                            onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                            placeholder="denver@example.co.nz"
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Street Address</label>
                          <Input
                            value={quoteForm.streetAddress}
                            onChange={(e) => setQuoteForm({ ...quoteForm, streetAddress: e.target.value })}
                            placeholder="123 Industrial Way, Mt Wellington"
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Phone Number *</label>
                            <Input
                              required
                              value={quoteForm.phone}
                              onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                              placeholder="021 123 4567"
                              className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Postcode</label>
                            <Input
                              value={quoteForm.postcode}
                              onChange={(e) => setQuoteForm({ ...quoteForm, postcode: e.target.value })}
                              placeholder="1010"
                              className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                            />
                          </div>
                        </div>

                        {/* Delivery Required Dropdown */}
                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Delivery Required? *</label>
                          <select
                            value={deliveryRequired}
                            onChange={(e) => setDeliveryRequired(e.target.value)}
                            className="w-full bg-[#0f0414] border border-pink-500/30 text-white text-xs rounded-xl p-2.5 mt-1 focus:border-[#ff2a8d] outline-none"
                          >
                            <option value="no">No - Depot Pickup</option>
                            <option value="yes">Yes - Delivery Required</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80">Custom Requirements / Notes</label>
                          <Textarea
                            rows={2}
                            value={quoteForm.notes}
                            onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                            placeholder="Specific ramp lengths, custom powdercoat color codes, tie-down placement..."
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-1 focus:border-[#ff2a8d]"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 mt-3 bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl shadow-[0_0_20px_rgba(255,42,141,0.6)] hover:brightness-110 active:scale-[0.98] transition-all"
                      >
                        Submit Quote Request (NZ${totalIncGst.toLocaleString()})
                      </Button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AnimatePresence>
  );
}
