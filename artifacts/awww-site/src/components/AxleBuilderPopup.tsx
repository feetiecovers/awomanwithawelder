import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Wrench,
  Sliders,
  Ruler,
  Truck,
  ShoppingCart,
  Send,
  PhoneCall,
  Info,
  Sparkles,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAddToCart, useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/api-base";
import ddIcon from "@assets/Denvers_Desk_Icon_Cropped.png";

interface AxleBuilderPopupProps {
  isOpen: boolean;
  onClose: () => void;
  build?: any;
  onRequireSignIn?: () => void;
}

interface QuoteFormState {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  townCity: string;
  region: string;
  postcode: string;
  notes: string;
}

const GST_RATE = 0.15;
const DEFAULT_IMAGE = "/assets/products/trailer_axle_assembly.jpg";

export function AxleBuilderPopup({
  isOpen,
  onClose,
  build,
  onRequireSignIn,
}: AxleBuilderPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addToCart = useAddToCart();
  const { data: cart } = useGetCart();

  // Selections
  const [selectedAxleType, setSelectedAxleType] = useState<"40X40" | "50X50">("40X40");
  const [selectedHubType, setSelectedHubType] = useState<"idler" | "idler2">("idler");
  const [lengthMm, setLengthMm] = useState<number>(1000);
  const [lengthInputVal, setLengthInputVal] = useState<string>("1000");

  // UI state
  const [activeTab, setActiveTab] = useState<"builder" | "specs">("builder");
  const [isPreviewImageOpen, setIsPreviewImageOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isQuoteSubmitted, setIsQuoteSubmitted] = useState(false);
  const [deliveryOption, setDeliveryOption] = useState<"pickup" | "delivery">("pickup");

  // Form State
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>({
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    townCity: "",
    region: "",
    postcode: "",
    notes: "",
  });

  // Reset or initialize from build payload
  useEffect(() => {
    if (!isOpen) {
      setIsQuoteModalOpen(false);
      setIsQuoteSubmitted(false);
      return;
    }

    // Default configuration from payload if available
    const defaultAxleOption = build?.defaultSelections?.["bog-1792398222088-ig7d"]?.[0];
    if (defaultAxleOption === "bo-1792398247384-yfr2") {
      setSelectedAxleType("50X50");
      setSelectedHubType("idler2");
    } else {
      setSelectedAxleType("40X40");
      setSelectedHubType("idler");
    }

    const defaultLength = Number(build?.parametricFeatures?.[0]?.parametricProduct?.defaultConfiguration?.measurement_mupe311o_3ygeq ?? 1000);
    setLengthMm(defaultLength);
    setLengthInputVal(String(defaultLength));
  }, [isOpen, build]);

  // Handle constraints & automatic compatibility sync
  const handleAxleTypeChange = (type: "40X40" | "50X50") => {
    setSelectedAxleType(type);
    if (type === "40X40" && selectedHubType === "idler2") {
      setSelectedHubType("idler");
      toast({
        title: "Compatible Hub Selected",
        description: "Standard Idler hub matched to 40x40 axle beam.",
      });
    } else if (type === "50X50" && selectedHubType === "idler") {
      setSelectedHubType("idler2");
      toast({
        title: "Compatible Hub Selected",
        description: "Heavy-Duty Idler 2 hub matched to 50x50 axle beam.",
      });
    }
  };

  const handleHubTypeChange = (hub: "idler" | "idler2") => {
    setSelectedHubType(hub);
    if (hub === "idler2" && selectedAxleType === "40X40") {
      setSelectedAxleType("50X50");
      toast({
        title: "Axle Beam Upgraded",
        description: "Switched to 50x50 Axle required by Idler 2 Hubs.",
      });
    } else if (hub === "idler" && selectedAxleType === "50X50") {
      setSelectedAxleType("40X40");
      toast({
        title: "Axle Beam Updated",
        description: "Switched to 40x40 Axle paired with Standard Idler Hubs.",
      });
    }
  };

  // Length calculations
  const minLength = 1000;
  const maxLength = 3000;
  const ratePerMetre = 14.86; // $14.86/m

  const handleSliderChange = (val: number) => {
    setLengthMm(val);
    setLengthInputVal(String(val));
  };

  const handleLengthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLengthInputVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= minLength && parsed <= maxLength) {
      setLengthMm(parsed);
    }
  };

  const handleLengthInputBlur = () => {
    let parsed = parseInt(lengthInputVal, 10);
    if (isNaN(parsed) || parsed < minLength) parsed = minLength;
    if (parsed > maxLength) parsed = maxLength;
    setLengthMm(parsed);
    setLengthInputVal(String(parsed));
  };

  // Pricing formula breakdown
  // Base components:
  // Axle beam: $14.86
  // Hubs & stubs: $313.04
  // Baseline price at 1,000mm (1.0m) = $327.90
  // Variable length addition: (lengthMm - 1000) / 1000 * $14.86
  const axleBasePrice = 14.86;
  const hubPrice = 313.04;
  const baseComponentsTotal = axleBasePrice + hubPrice; // 327.90

  const extraMetres = Math.max(0, (lengthMm - 1000) / 1000);
  const lengthAdjustment = Number((extraMetres * ratePerMetre).toFixed(2));
  const totalIncGst = Number((baseComponentsTotal + lengthAdjustment).toFixed(2));
  const subtotalExGst = Number((totalIncGst / (1 + GST_RATE)).toFixed(2));
  const gstAmount = Number((totalIncGst - subtotalExGst).toFixed(2));

  // Cart addition
  const handleAddToCart = () => {
    const buildId = build?.id ?? 12;
    const configuration = {
      type: "build",
      buildId: build?.buildId ?? "build-1792398167103",
      buildName: "Trailer Axle Builder",
      selections: {
        "Axle Type": selectedAxleType === "40X40" ? "40X40 Axle" : "50X50 Axle",
        "Hub Type": selectedHubType === "idler" ? "Idler (5 x 4.5)" : "Idler 2 (5 x 4.5 Heavy Duty)",
        "Axle Length": `${lengthMm} mm`,
      },
      parametricValues: {
        measurement_mupe311o_3ygeq: lengthMm,
      },
      resolvedPrice: totalIncGst,
      totalPriceAdjustment: lengthAdjustment,
    };

    addToCart.mutate(
      {
        data: {
          productId: buildId,
          quantity: 1,
          configuration,
        } as any,
      },
      {
        onSuccess: () => {
          toast({
            title: "Custom Axle Added to Cart",
            description: `${selectedAxleType} Axle (${lengthMm}mm) with ${selectedHubType === "idler" ? "Idler" : "Idler 2"} hubs ready for checkout.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          onClose();
        },
        onError: () => {
          toast({
            title: "Failed to Add to Cart",
            description: "Please check your network connection and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Quote Submission
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.fullName || !quoteForm.email || !quoteForm.phone) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter your name, email address, and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingQuote(true);

    try {
      const response = await fetch(buildApiUrl("/api/build-quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          buildId: build?.buildId ?? "build-1792398167103",
          buildCode: "AXLE-BUILDR-01",
          buildName: "Trailer Axle Builder",
          selections: {
            "Axle Type": [selectedAxleType === "40X40" ? "40X40 Axle" : "50X50 Axle"],
            "Hub Type": [selectedHubType === "idler" ? "Idler" : "Idler 2"],
            "Track Length": [`${lengthMm} mm`],
          },
          fullName: quoteForm.fullName,
          email: quoteForm.email,
          phone: quoteForm.phone,
          streetAddress: quoteForm.streetAddress,
          townCity: quoteForm.townCity,
          region: quoteForm.region,
          postcode: quoteForm.postcode,
          notes: quoteForm.notes,
          deliveryRequired: deliveryOption === "delivery" ? "yes" : "no",
          estimatedSubtotal: subtotalExGst,
          estimatedGst: gstAmount,
          estimatedTotal: totalIncGst,
          selectedAddons: [
            {
              groupName: "Parametric Dimensions",
              optionName: `Track Length: ${lengthMm}mm`,
              price: lengthAdjustment,
              parametricFeatureValues: { measurement_mupe311o_3ygeq: lengthMm },
            },
            {
              groupName: "Axle Type",
              optionName: selectedAxleType === "40X40" ? "40X40 Axle" : "50X50 Axle",
              price: axleBasePrice,
            },
            {
              groupName: "Hub Type",
              optionName: selectedHubType === "idler" ? "Idler" : "Idler 2",
              price: hubPrice,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit axle quote");
      }

      setIsQuoteSubmitted(true);
      toast({
        title: "Axle Build Quote Submitted!",
        description: `Thanks ${quoteForm.fullName}! Charlotte will review your custom axle specs and get back to you promptly.`,
      });
    } catch {
      toast({
        title: "Submission Issue",
        description: "Could not send quote request. Please try calling Charlotte directly on 03 562 6024.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="axle-builder-title"
    >
      {/* Outer Card with Electric Blue glow styling */}
      <div
        className="w-full max-w-5xl h-[94vh] sm:h-[90vh] flex flex-col bg-[#080d14]/98 border border-[#1aa1e0]/40 rounded-2xl shadow-[0_0_50px_rgba(26,161,224,0.25)] overflow-hidden text-slate-100 relative"
      >
        {/* Subtle decorative background gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#1aa1e0]/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00e5ff]/5 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#1aa1e0]/20 bg-[#060a10]/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1aa1e0]/15 border border-[#1aa1e0]/30 flex items-center justify-center shadow-[0_0_12px_rgba(26,161,224,0.4)]">
              <img src={ddIcon} alt="Denver's Desk" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="axle-builder-title" className="font-bold text-base sm:text-lg text-white tracking-wide flex items-center gap-2">
                  Trailer Axle Builder
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#1aa1e0]/20 text-[#1aa1e0] border border-[#1aa1e0]/40 font-semibold tracking-wider">
                    NO-CODE BUILDR
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Powered by Denver's Desk &middot; Custom Dimensioned Trailer Components
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Price Tag */}
            <div className="text-right hidden xs:block">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                Calculated Price (inc GST)
              </span>
              <span className="font-mono text-lg sm:text-xl font-bold text-[#1aa1e0] drop-shadow-[0_0_10px_rgba(26,161,224,0.6)]">
                NZ${totalIncGst.toFixed(2)}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/60 border border-[#1aa1e0]/30 text-slate-300 hover:text-white hover:border-[#1aa1e0] hover:bg-[#1aa1e0]/20 hover:shadow-[0_0_15px_rgba(26,161,224,0.5)] flex items-center justify-center transition-all cursor-pointer"
              title="Close Builder"
              aria-label="Close Builder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area - 2 Columns on desktop, scrollable on mobile */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Blueprint & Configuration (Cols 1-7) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Engineering Blueprint Display Card */}
            <div className="rounded-xl border border-[#1aa1e0]/30 bg-[#04080e]/80 overflow-hidden relative group shadow-[0_0_20px_rgba(0,0,0,0.6)]">
              {/* Technical Measurement Banner */}
              <div className="px-4 py-2 bg-[#09121d] border-b border-[#1aa1e0]/20 flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#1aa1e0] font-semibold">
                  <Ruler className="w-3.5 h-3.5" />
                  SPEC: {lengthMm}mm Track Length
                </span>
                <span className="text-slate-400 text-[11px]">
                  5-Stud &middot; 1,500kg Rated Assembly
                </span>
              </div>

              {/* Technical Drawing Image */}
              <div
                className="relative h-48 sm:h-64 w-full bg-black/60 flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => setIsPreviewImageOpen(true)}
              >
                <img
                  src={DEFAULT_IMAGE}
                  alt="Trailer Axle Blueprint Assembly"
                  className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                />

                {/* Dimension Overlay Badge */}
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1aa1e0]/40 text-xs font-mono text-[#1aa1e0] flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-[#1aa1e0] animate-pulse" />
                  Hub-Face to Hub-Face: <strong className="text-white">{lengthMm} mm</strong>
                </div>

                <button
                  type="button"
                  className="absolute top-3 right-3 bg-black/70 hover:bg-[#1aa1e0]/80 text-white p-2 rounded-lg border border-[#1aa1e0]/30 transition-all opacity-80 group-hover:opacity-100 flex items-center gap-1 text-xs font-mono"
                  title="Expand Visual Blueprint"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Inspect</span>
                </button>
              </div>
            </div>

            {/* Step 1: Axle Profile Selection */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#1aa1e0]" />
                1. Select Axle Profile Tube
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 40X40 Option */}
                <button
                  type="button"
                  onClick={() => handleAxleTypeChange("40X40")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    selectedAxleType === "40X40"
                      ? "border-[#1aa1e0] bg-[#1aa1e0]/10 shadow-[0_0_20px_rgba(26,161,224,0.3)] ring-1 ring-[#1aa1e0]"
                      : "border-slate-800 bg-[#09121d]/70 hover:border-slate-700 hover:bg-[#0c1827]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        40X40 Square Axle
                        {selectedAxleType === "40X40" && (
                          <CheckCircle2 className="w-4 h-4 text-[#1aa1e0]" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        40mm solid steel profile. Ideal for lightweight single axle utility & boat trailers.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Standard Idler Hubs</span>
                    <span className="text-[#1aa1e0] font-semibold">NZ$14.86</span>
                  </div>
                </button>

                {/* 50X50 Option */}
                <button
                  type="button"
                  onClick={() => handleAxleTypeChange("50X50")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    selectedAxleType === "50X50"
                      ? "border-[#1aa1e0] bg-[#1aa1e0]/10 shadow-[0_0_20px_rgba(26,161,224,0.3)] ring-1 ring-[#1aa1e0]"
                      : "border-slate-800 bg-[#09121d]/70 hover:border-slate-700 hover:bg-[#0c1827]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        50X50 Square Axle
                        {selectedAxleType === "50X50" && (
                          <CheckCircle2 className="w-4 h-4 text-[#1aa1e0]" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        50mm heavy-duty profile. Maximum beam rigidity for heavy hauling and tandem applications.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Idler 2 Heavy Hubs</span>
                    <span className="text-[#1aa1e0] font-semibold">NZ$14.86</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Hub & Stub Assembly */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-[#1aa1e0]" />
                2. Select Hub & Stub Assembly
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Idler Option */}
                <button
                  type="button"
                  onClick={() => handleHubTypeChange("idler")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    selectedHubType === "idler"
                      ? "border-[#1aa1e0] bg-[#1aa1e0]/10 shadow-[0_0_20px_rgba(26,161,224,0.3)] ring-1 ring-[#1aa1e0]"
                      : "border-slate-800 bg-[#09121d]/70 hover:border-slate-700 hover:bg-[#0c1827]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        Idler (5 x 4.5" PCD)
                        {selectedHubType === "idler" && (
                          <CheckCircle2 className="w-4 h-4 text-[#1aa1e0]" />
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      1,500kg rated idler hub & stub pair. Complete with bearings, seals, and slotted wheel nuts.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Paired with 40x40</span>
                    <span className="text-[#1aa1e0] font-semibold">NZ$313.04</span>
                  </div>
                </button>

                {/* Idler 2 Option */}
                <button
                  type="button"
                  onClick={() => handleHubTypeChange("idler2")}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    selectedHubType === "idler2"
                      ? "border-[#1aa1e0] bg-[#1aa1e0]/10 shadow-[0_0_20px_rgba(26,161,224,0.3)] ring-1 ring-[#1aa1e0]"
                      : "border-slate-800 bg-[#09121d]/70 hover:border-slate-700 hover:bg-[#0c1827]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        Idler 2 (Heavy-Duty 5 x 4.5")
                        {selectedHubType === "idler2" && (
                          <CheckCircle2 className="w-4 h-4 text-[#1aa1e0]" />
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Heavy-duty 1,500kg rated hub & stub kit engineered for 50x50 beam integration.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Paired with 50x50</span>
                    <span className="text-[#1aa1e0] font-semibold">NZ$313.04</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3: Parametric Length Slider */}
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-[#1aa1e0]/30 bg-[#060d16]/90 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs uppercase font-mono tracking-wider text-slate-200 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#1aa1e0]" />
                    3. Specify Hub-Face Track Length
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hub face to hub face measurement (1,000mm &ndash; 3,000mm)
                  </p>
                </div>

                {/* Direct Number Input */}
                <div className="flex items-center gap-1 bg-black/60 border border-[#1aa1e0]/40 rounded-lg px-2.5 py-1">
                  <input
                    type="number"
                    min={minLength}
                    max={maxLength}
                    step={1}
                    value={lengthInputVal}
                    onChange={handleLengthInputChange}
                    onBlur={handleLengthInputBlur}
                    className="w-16 bg-transparent text-right font-mono font-bold text-sm text-[#1aa1e0] focus:outline-none"
                  />
                  <span className="font-mono text-xs text-slate-400">mm</span>
                </div>
              </div>

              {/* Range Slider */}
              <div className="py-2">
                <input
                  type="range"
                  min={minLength}
                  max={maxLength}
                  step={1}
                  value={lengthMm}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#1aa1e0]"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>1,000 mm (Min)</span>
                  <span>2,000 mm</span>
                  <span>3,000 mm (Max)</span>
                </div>
              </div>

              {/* Quick Select Presets */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-400">Quick Presets:</span>
                {[
                  { label: "1,220mm (4ft Box)", val: 1220 },
                  { label: "1,525mm (5ft Box)", val: 1525 },
                  { label: "1,830mm (6ft Deck)", val: 1830 },
                  { label: "2,100mm (Car Trailer)", val: 2100 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => handleSliderChange(preset.val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                      lengthMm === preset.val
                        ? "bg-[#1aa1e0] text-black font-bold shadow-[0_0_10px_rgba(26,161,224,0.5)]"
                        : "bg-slate-800/80 text-slate-300 hover:bg-[#1aa1e0]/20 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Formula Indicator */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-black/40 px-3 py-2 rounded-lg border border-slate-800">
                <span>Formula Rate: $14.86 per metre</span>
                <span className="text-[#1aa1e0] font-semibold">
                  {lengthMm > 1000
                    ? `+NZ$${lengthAdjustment.toFixed(2)} (${(extraMetres).toFixed(3)}m extra)`
                    : "Included in Baseline"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Build Specification & Actions (Cols 8-12) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-[#060a12]/90 border border-[#1aa1e0]/25 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1aa1e0]" />
                  Axle Specification Summary
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ready to Build
                </span>
              </div>

              {/* Spec Breakdown List */}
              <div className="flex flex-col gap-2.5 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Axle Profile:</span>
                  <span className="text-white font-semibold">{selectedAxleType} Square Solid Beam</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Hub Pattern:</span>
                  <span className="text-white font-semibold">
                    {selectedHubType === "idler" ? "Idler (5 x 4.5\" PCD)" : "Idler 2 Heavy Duty"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Hub-Face Measurement:</span>
                  <span className="text-[#1aa1e0] font-bold">{lengthMm} mm</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Load Capacity:</span>
                  <span className="text-emerald-400 font-semibold">1,500 kg Gross</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Fulfilment:</span>
                  <span className="text-slate-300">Custom Built to Order</span>
                </div>
              </div>

              {/* Cost Itemization */}
              <div className="bg-[#04080e] p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2 text-xs font-mono mt-1">
                <div className="flex justify-between text-slate-400">
                  <span>Beam Component Base:</span>
                  <span>NZ${axleBasePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Hub & Stub Kit (Pair):</span>
                  <span>NZ${hubPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Length Adjustment ({lengthMm}mm):</span>
                  <span className={lengthAdjustment > 0 ? "text-[#1aa1e0]" : ""}>
                    +NZ${lengthAdjustment.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between text-slate-300">
                  <span>Subtotal (excl. GST):</span>
                  <span>NZ${subtotalExGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>GST (15%):</span>
                  <span>NZ${gstAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#1aa1e0]/30 pt-2 flex justify-between items-center text-sm font-bold text-white">
                  <span>Total (incl. GST):</span>
                  <span className="text-lg text-[#1aa1e0] drop-shadow-[0_0_8px_rgba(26,161,224,0.5)]">
                    NZ${totalIncGst.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Charlotte Guarantee */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1aa1e0]/5 border border-[#1aa1e0]/20 text-[11px] text-slate-300">
                <Info className="w-4 h-4 text-[#1aa1e0] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Precision fabricated in Auckland, NZ. All axles are accurately turned and welded to your specific hub face measurement.
                </p>
              </div>
            </div>

            {/* Actions CTA */}
            <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-800">
              <Button
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
                className="w-full h-11 bg-[#1aa1e0] hover:bg-[#1aa1e0]/90 text-black font-bold uppercase tracking-wider font-mono text-xs shadow-[0_0_20px_rgba(26,161,224,0.4)] flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                {addToCart.isPending ? "Adding to Cart..." : `Add to Cart &middot; NZ$${totalIncGst.toFixed(2)}`}
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsQuoteModalOpen(true)}
                className="w-full h-10 border border-[#1aa1e0]/50 text-[#1aa1e0] bg-[#1aa1e0]/10 hover:bg-[#1aa1e0]/20 hover:text-white uppercase tracking-wider font-mono text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Request Formal Quote
              </Button>

              <div className="text-center pt-1">
                <a
                  href="tel:035626024"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-[#1aa1e0] transition-colors"
                >
                  <PhoneCall className="w-3 h-3 text-[#1aa1e0]" />
                  Need a custom PCD or electric brakes? Call Charlotte on 03 562 6024
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Fullscreen Blueprint Preview Modal */}
        <AnimatePresence>
          {isPreviewImageOpen && (
            <div
              className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
              onClick={() => setIsPreviewImageOpen(false)}
            >
              <div className="max-w-4xl max-h-[85vh] relative flex flex-col items-center">
                <img
                  src={DEFAULT_IMAGE}
                  alt="Axle Technical Illustration"
                  className="max-w-full max-h-[75vh] object-contain rounded-xl border border-[#1aa1e0]/40 shadow-[0_0_40px_rgba(26,161,224,0.3)]"
                />
                <p className="mt-3 text-xs font-mono text-[#1aa1e0] text-center">
                  Trailer Axle Assembly &middot; Hub-Face Track: {lengthMm}mm &middot; 5-Stud Pattern
                </p>
                <button
                  onClick={() => setIsPreviewImageOpen(false)}
                  className="absolute -top-10 right-0 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-mono"
                >
                  <X className="w-4 h-4" /> Close Preview
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Embedded Formal Quote Request Modal */}
        <AnimatePresence>
          {isQuoteModalOpen && (
            <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-[#080d14] border border-[#1aa1e0]/50 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(26,161,224,0.3)] text-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Send className="w-4 h-4 text-[#1aa1e0]" />
                      Request Formal Axle Quote
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {selectedAxleType} Axle &middot; {lengthMm}mm Track &middot; NZ${totalIncGst.toFixed(2)} incl GST
                    </p>
                  </div>
                  <button
                    onClick={() => setIsQuoteModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isQuoteSubmitted ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-base text-white">Quote Request Received!</h4>
                    <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                      Thank you! Charlotte will prepare your formal quote with exact freight and turnaround estimates.
                    </p>
                    <Button
                      onClick={() => {
                        setIsQuoteModalOpen(false);
                        setIsQuoteSubmitted(false);
                        onClose();
                      }}
                      className="mt-3 font-mono text-xs uppercase bg-[#1aa1e0] text-black font-bold"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitQuote} className="flex flex-col gap-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                          Full Name *
                        </label>
                        <Input
                          required
                          value={quoteForm.fullName}
                          onChange={(e) => setQuoteForm({ ...quoteForm, fullName: e.target.value })}
                          placeholder="Charlotte Welder"
                          className="bg-black/50 border-slate-700 h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                          Email Address *
                        </label>
                        <Input
                          required
                          type="email"
                          value={quoteForm.email}
                          onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                          placeholder="charlotte@example.co.nz"
                          className="bg-black/50 border-slate-700 h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                          Phone Number *
                        </label>
                        <Input
                          required
                          type="tel"
                          value={quoteForm.phone}
                          onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                          placeholder="021 000 0000"
                          className="bg-black/50 border-slate-700 h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                          Fulfilment Method
                        </label>
                        <select
                          value={deliveryOption}
                          onChange={(e) => setDeliveryOption(e.target.value as any)}
                          className="w-full bg-black/50 border border-slate-700 rounded-md h-9 px-3 text-xs text-slate-100"
                        >
                          <option value="pickup">Workshop Pickup (Auckland)</option>
                          <option value="delivery">Freight Delivery (Nationwide NZ)</option>
                        </select>
                      </div>
                    </div>

                    {deliveryOption === "delivery" && (
                      <div>
                        <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                          Delivery Town / Region
                        </label>
                        <Input
                          value={quoteForm.townCity}
                          onChange={(e) => setQuoteForm({ ...quoteForm, townCity: e.target.value })}
                          placeholder="Hamilton, Tauranga, Christchurch, etc."
                          className="bg-black/50 border-slate-700 h-9 text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                        Project Notes / Special Requirements
                      </label>
                      <Textarea
                        rows={2}
                        value={quoteForm.notes}
                        onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                        placeholder="Any custom camber requirements, drop axle needs, or specific stud patterns..."
                        className="bg-black/50 border-slate-700 text-xs"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsQuoteModalOpen(false)}
                        className="text-xs font-mono"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmittingQuote}
                        className="bg-[#1aa1e0] hover:bg-[#1aa1e0]/90 text-black font-bold uppercase font-mono text-xs h-9 px-4"
                      >
                        {isSubmittingQuote ? "Sending..." : "Submit Quote Request"}
                      </Button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
