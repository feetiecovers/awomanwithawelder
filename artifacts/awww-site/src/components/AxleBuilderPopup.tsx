import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Wrench,
  Sliders,
  Ruler,
  ShoppingCart,
  Send,
  PhoneCall,
  Info,
  Maximize2,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Disc,
  CircleDot,
  CheckSquare,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAddToCart, useGetCart, getGetCartQueryKey, useGetCurrentMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/api-base";
import ddIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import { ParametricHelperBubble } from "./ParametricHelperBubble";

const PCD_MEASUREMENT_HELPER = {
  title: "How to Measure Trailer Hub PCD",
  definition:
    "Pitch Circle Diameter (PCD) is the diameter of the circle passing through the center of all wheel studs.\n\n• 4-Stud & 6-Stud Patterns: Measure directly from the center of one stud across through the hub center to the opposite stud.\n• 5-Stud Patterns: Measure from the center of one stud to the center of an adjacent stud (distance 'A'). Then PCD = A ÷ sin(36°) (e.g. 67.2mm between adjacent studs gives 5×114.3mm / 5×4.5\" Ford/Toyota).",
  image: "/assets/helpers/pcd_measurement_guide.jpg",
  imageAlt: "Technical workshop pencil sketch illustrating how to measure 4-stud, 5-stud, and 6-stud trailer hub PCD bolt patterns with callouts and dimension arrows",
};

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

/**
 * Pure display label reader — does not invent names.
 * Uses exact name/label from the build payload.
 */
function getOptionDisplayLabel(option: any): string {
  if (option?.name && String(option.name).trim()) return String(option.name).trim();
  if (option?.label && String(option.label).trim()) return String(option.label).trim();
  if (option?.title && String(option.title).trim()) return String(option.title).trim();
  return String(option?.id || "Option");
}

/**
 * Resolves option price either directly from option fields (price, sellPrice, displayPrice, priceAdjustment)
 * or through mapped build features in build.features, build.includedFeatures, or build.buildFeatures.
 */
function getOptionPrice(option: any, build?: any): number {
  if (!option) return 0;
  const directPrice = Number(
    option.price ?? option.sellPrice ?? option.displayPrice ?? option.priceAdjustment ?? 0
  );
  if (!isNaN(directPrice) && directPrice > 0) {
    return directPrice;
  }

  // Resolve through linked featureIds if present
  if (Array.isArray(option.featureIds) && option.featureIds.length > 0 && build) {
    const allFeatures = [
      ...(Array.isArray(build.features) ? build.features : []),
      ...(Array.isArray(build.includedFeatures) ? build.includedFeatures : []),
      ...(Array.isArray(build.buildFeatures) ? build.buildFeatures : []),
      ...(Array.isArray(build.availableFeatures) ? build.availableFeatures : []),
    ];
    let featTotal = 0;
    for (const fid of option.featureIds) {
      const match = allFeatures.find((f: any) => f?.id === fid);
      if (match) {
        const featPrice = Number(
          match.price ?? match.sellPrice ?? match.displayPrice ?? match.priceAdjustment ?? 0
        );
        if (!isNaN(featPrice) && featPrice > 0) {
          featTotal += featPrice;
        }
      }
    }
    if (featTotal > 0) return featTotal;
  }

  return 0;
}

function getGroupIcon(groupName: string) {
  const name = String(groupName || "").toLowerCase();
  if (name.includes("wheel")) return CircleDot;
  if (name.includes("brake")) return Disc;
  if (name.includes("pcd")) return Wrench;
  if (name.includes("capacity") || name.includes("assembl")) return CheckSquare;
  return Layers;
}

function isCapacityGroup(group: any): boolean {
  if (!group) return false;
  const id = String(group.id || "").toLowerCase();
  const name = String(group.name || "").toLowerCase();
  return (
    id === "bog-axle-capacity" ||
    name.includes("capacity") ||
    name.includes("assembl") ||
    id.includes("capacity") ||
    id.includes("assembl")
  );
}

function isPcdGroup(group: any): boolean {
  if (!group) return false;
  const id = String(group.id || "").toLowerCase();
  const name = String(group.name || "").toLowerCase();
  return name.includes("pcd") || id.includes("pcd") || id === "bog-1792497483124-7hm2";
}

function isBrakeGroup(group: any): boolean {
  if (!group) return false;
  const id = String(group.id || "").toLowerCase();
  const name = String(group.name || "").toLowerCase();
  return name.includes("brake") || id.includes("brake");
}

function isWheelGroup(group: any): boolean {
  if (!group) return false;
  const id = String(group.id || "").toLowerCase();
  const name = String(group.name || "").toLowerCase();
  return name.includes("wheel") || id.includes("wheel");
}

function normalizePcdString(val?: string | null): string {
  if (!val) return "";
  const m = String(val).match(/([456])\s*[x×X]\s*([0-9]+(?:\.[0-9]+)?)/);
  return m ? `${m[1]}x${m[2]}` : "";
}

function getOptionPcd(option: any): string {
  const raw = `${option?.name || ""} ${option?.label || ""} ${option?.id || ""}`;
  return normalizePcdString(raw);
}

function getOptionBrakeKind(option: any): "idler" | "hydraulic" | "electric" | "" {
  const lower = `${option?.name || ""} ${option?.label || ""} ${option?.id || ""}`.toLowerCase();
  if (lower.includes("idler") || lower.includes("unbraked")) return "idler";
  if (lower.includes("hydraulic")) return "hydraulic";
  if (lower.includes("electric")) return "electric";
  return "";
}

/**
 * Validates if an assembly option in the capacity/assemblies group
 * is compatible with the user's current selections in Wheel Size, Brake Type, and PCD.
 */
function isAssemblyOptionCompatible(
  option: any,
  selectedOptions: Record<string, string>,
  allGroups: any[]
): boolean {
  const optPcd = getOptionPcd(option);
  const optBrake = getOptionBrakeKind(option);

  const pcdGroup = allGroups.find(isPcdGroup);
  const brakeGroup = allGroups.find(isBrakeGroup);
  const wheelGroup = allGroups.find(isWheelGroup);

  // 1. PCD Filter: If PCD selected, only matching PCD assemblies remain visible
  if (pcdGroup && selectedOptions[pcdGroup.id]) {
    const selPcdOpt = pcdGroup.options?.find((o: any) => o.id === selectedOptions[pcdGroup.id]);
    const selPcd = getOptionPcd(selPcdOpt);
    if (selPcd && optPcd && optPcd !== selPcd) {
      return false;
    }
  }

  // 2. Brake Type Filter:
  // If you don't select a brake type it will just show idlers; if brakes chosen no idlers
  const selectedBrakeOptId = brakeGroup ? selectedOptions[brakeGroup.id] : undefined;
  if (!selectedBrakeOptId) {
    // No brake selected -> only show unbraked idlers
    if (optBrake !== "idler") {
      return false;
    }
  } else {
    // Brake selected -> show matching braked assemblies, no idlers!
    if (optBrake === "idler") {
      return false;
    }
    const selBrakeOpt = brakeGroup?.options?.find((o: any) => o.id === selectedBrakeOptId);
    const selBrakeKind = getOptionBrakeKind(selBrakeOpt);
    if (selBrakeKind && optBrake !== selBrakeKind) {
      return false;
    }
  }

  // 3. Two-way blockedOptionIds check
  for (const [groupId, selOptId] of Object.entries(selectedOptions)) {
    if (!selOptId) continue;
    if (Array.isArray(option.blockedOptionIds) && option.blockedOptionIds.includes(selOptId)) {
      return false;
    }
    const grp = allGroups.find((g: any) => g.id === groupId);
    const selOpt = grp?.options?.find((o: any) => o.id === selOptId);
    if (Array.isArray(selOpt?.blockedOptionIds) && selOpt.blockedOptionIds.includes(option.id)) {
      return false;
    }
  }

  // 4. Wheel Size Filter:
  // 14–22" wheel is limited to idlers and 4x114.3 / 5x114.3 hydraulic disc combinations.
  // 15–22" is required for 5x120, 6x139.7 hydraulic and all electric drum combinations.
  if (wheelGroup && selectedOptions[wheelGroup.id]) {
    const selWheelOpt = wheelGroup.options?.find((o: any) => o.id === selectedOptions[wheelGroup.id]);
    const wheelName = String(selWheelOpt?.name || "").toLowerCase();
    if (wheelName.includes("14")) {
      if (optBrake === "electric") return false;
      if (optBrake === "hydraulic" && (optPcd === "5x120" || optPcd === "6x139.7")) return false;
    }
  }

  return true;
}

function parseAssemblyParts(label: string) {
  const parts = label.split(" - ").map((s) => s.trim());
  if (parts.length >= 3) {
    return {
      capacity: parts[0],
      pcd: parts[1],
      brake: parts[2],
    };
  }
  return null;
}

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
  const { data: member } = useGetCurrentMember();

  // Selections: map of groupId -> optionId
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [lengthMm, setLengthMm] = useState<number>(1000);
  const [lengthInputVal, setLengthInputVal] = useState<string>("1000");

  // UI state
  const [isPreviewImageOpen, setIsPreviewImageOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isQuoteSubmitted, setIsQuoteSubmitted] = useState(false);
  const [deliveryOption, setDeliveryOption] = useState<"pickup" | "delivery">("pickup");

  // Purchase Modal & Direct Checkout State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isDirectCheckingOut, setIsDirectCheckingOut] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

  // Quote Form State
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

  // Sync logged in member details if available
  useEffect(() => {
    if (member) {
      setPurchaseForm((prev) => ({
        ...prev,
        fullName: prev.fullName || member.name || "",
        email: prev.email || member.email || "",
      }));
      setQuoteForm((prev) => ({
        ...prev,
        fullName: prev.fullName || member.name || "",
        email: prev.email || member.email || "",
      }));
    }
  }, [member]);

  // Extract option groups directly from payload
  const optionGroups = useMemo(() => {
    if (!build?.optionGroups || !Array.isArray(build.optionGroups)) return [];
    return build.optionGroups;
  }, [build]);

  // Extract parametric configuration directly from payload
  const parametricFeature = useMemo(() => {
    const list = Array.isArray(build?.parametricFeatures)
      ? build.parametricFeatures
      : Array.isArray(build?.includedFeatures)
        ? build.includedFeatures
        : [];
    return list.find((f: any) => f?.kind === "parametric" && f?.parametricProduct) || null;
  }, [build]);

  const parametricInput = parametricFeature?.parametricProduct?.inputDefinitions?.[0];
  const parametricRule = parametricFeature?.parametricProduct?.rules?.[0];

  const minLength = Number(parametricInput?.minimum ?? 1000);
  const maxLength = Number(parametricInput?.maximum ?? 3000);
  const defaultLength = Number(parametricInput?.defaultValue ?? 1000);
  const step = Number(parametricInput?.step ?? 1);
  const unit = String(parametricInput?.unit ?? "mm");
  const ratePerMetre = Number(parametricRule?.pricePerUnit ?? 14.86);
  const parametricLabel = String(parametricInput?.label ?? parametricFeature?.name ?? "Axle Length");

  // Reset or initialize directly when modal opens
  // Starts with nothing chosen so all 20 assemblies are visible in the bottom group
  useEffect(() => {
    if (!isOpen) {
      setIsQuoteModalOpen(false);
      setIsQuoteSubmitted(false);
      return;
    }

    // Start with empty selections so all features in the bottom group appear initially
    setSelectedOptions({});

    const initLength = Number(
      parametricFeature?.parametricProduct?.defaultConfiguration?.[parametricInput?.key || ""] ?? defaultLength
    );
    setLengthMm(initLength);
    setLengthInputVal(String(initLength));
  }, [isOpen, parametricFeature, parametricInput, defaultLength]);

  const handleSelectOption = (group: any, option: any) => {
    setSelectedOptions((prev) => {
      const isCurrentlySelected = prev[group.id] === option.id;
      const next: Record<string, string> = { ...prev };

      if (isCurrentlySelected) {
        // Toggle off if already selected
        delete next[group.id];
      } else {
        next[group.id] = option.id;
      }

      // If we modified Wheel Size, Brake Type, or PCD, check if the currently selected capacity assembly is still compatible
      const capGroup = optionGroups.find(isCapacityGroup);
      if (capGroup && next[capGroup.id]) {
        const currentCapOpt = capGroup.options?.find((o: any) => o.id === next[capGroup.id]);
        if (currentCapOpt && !isAssemblyOptionCompatible(currentCapOpt, next, optionGroups)) {
          delete next[capGroup.id];
        }
      }

      return next;
    });
  };

  const handleDeselectGroup = (group: any) => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      delete next[group.id];

      // Re-validate capacity selection
      const capGroup = optionGroups.find(isCapacityGroup);
      if (capGroup && next[capGroup.id]) {
        const currentCapOpt = capGroup.options?.find((o: any) => o.id === next[capGroup.id]);
        if (currentCapOpt && !isAssemblyOptionCompatible(currentCapOpt, next, optionGroups)) {
          delete next[capGroup.id];
        }
      }

      return next;
    });
  };

  const handleClearAllSelections = () => {
    setSelectedOptions({});
  };

  // Length calculations
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

  // Price Calculation strictly from payload values
  const { optionsTotal, lengthAdjustment, totalIncGst, subtotalExGst, gstAmount, activeSpecs } = useMemo(() => {
    let optsTotal = 0;
    const specs: { groupName: string; optionName: string; price: number; description?: string }[] = [];

    optionGroups.forEach((group: any) => {
      const selectedId = selectedOptions[group.id];
      const opt = group.options?.find((o: any) => o.id === selectedId);
      if (opt) {
        const price = getOptionPrice(opt, build);
        optsTotal += price;
        specs.push({
          groupName: group.name,
          optionName: getOptionDisplayLabel(opt),
          price,
          description: opt.description,
        });
      }
    });

    const extraMetres = Math.max(0, (lengthMm - defaultLength) / 1000);
    const lengthAdj = Number((extraMetres * ratePerMetre).toFixed(2));
    const baseComponents = Number(build?.price ?? build?.displayPrice ?? build?.sellPrice ?? build?.basePrice ?? 0);

    const total = Number((baseComponents + optsTotal + lengthAdj).toFixed(2));
    const subtotal = Number((total / (1 + GST_RATE)).toFixed(2));
    const gst = Number((total - subtotal).toFixed(2));

    return {
      optionsTotal: optsTotal,
      lengthAdjustment: lengthAdj,
      totalIncGst: total,
      subtotalExGst: subtotal,
      gstAmount: gst,
      activeSpecs: specs,
    };
  }, [optionGroups, selectedOptions, lengthMm, defaultLength, ratePerMetre, build]);

  // Check whether minimum essential configuration is completed (PCD + Capacity assembly)
  const isReadyToBuild = useMemo(() => {
    const pcdGroup = optionGroups.find(isPcdGroup);
    const capGroup = optionGroups.find(isCapacityGroup);
    const hasPcd = !pcdGroup || Boolean(selectedOptions[pcdGroup.id]);
    const hasCap = !capGroup || Boolean(selectedOptions[capGroup.id]);
    return hasPcd && hasCap;
  }, [optionGroups, selectedOptions]);

  // Open the dedicated Purchase & Checkout Modal
  const handleOpenPurchaseModal = () => {
    const pcdGroup = optionGroups.find(isPcdGroup);
    const capGroup = optionGroups.find(isCapacityGroup);

    if (pcdGroup && !selectedOptions[pcdGroup.id]) {
      toast({
        title: "PCD Selection Required",
        description: "Please choose your wheel stud pattern (PCD) to configure your axle.",
        variant: "destructive",
      });
      return;
    }

    if (capGroup && !selectedOptions[capGroup.id]) {
      toast({
        title: "Axle Assembly Required",
        description: "Please choose an available capacity and assembly from the list below.",
        variant: "destructive",
      });
      return;
    }

    setIsPurchaseModalOpen(true);
  };

  // Add to cart with all individual build features and specs
  const handleAddToCartFromModal = () => {
    const buildId = build?.id ?? 12;
    const selectionsRecord: Record<string, string> = {};
    activeSpecs.forEach((s) => {
      selectionsRecord[s.groupName] = s.optionName;
    });
    selectionsRecord[parametricLabel] = `${lengthMm} ${unit}`;

    const baseComponents = Number(build?.price ?? build?.displayPrice ?? build?.sellPrice ?? build?.basePrice ?? 0);

    const configuration = {
      type: "build",
      buildId: build?.buildId ?? "build-1792398167103",
      buildName: build?.name || "Trailer Axle Builder",
      customerName: purchaseForm.fullName || undefined,
      customerEmail: purchaseForm.email || undefined,
      customerPhone: purchaseForm.phone || undefined,
      parametricSummary: `${lengthMm}${unit} Track Axle Beam`,
      parametricPrice: Number((baseComponents + lengthAdjustment).toFixed(2)),
      buildFeatures: activeSpecs,
      selections: selectionsRecord,
      parametricValues: parametricInput?.key
        ? { [parametricInput.key]: lengthMm }
        : { length: lengthMm },
      resolvedPrice: totalIncGst,
      totalPriceAdjustment: Number((lengthAdjustment + optionsTotal).toFixed(2)),
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
            description: `${lengthMm}${unit} Track Axle with all selected build features added to your cart.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          setIsPurchaseModalOpen(false);
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

  // Instant direct Stripe Checkout
  const handleDirectCheckout = async () => {
    if (!purchaseForm.fullName.trim() || !purchaseForm.email.trim()) {
      toast({
        title: "Name & Email Required",
        description: "Please enter your name and email to proceed to Stripe checkout.",
        variant: "destructive",
      });
      return;
    }

    setIsDirectCheckingOut(true);
    const buildId = build?.id ?? 12;
    const selectionsRecord: Record<string, string> = {};
    activeSpecs.forEach((s) => {
      selectionsRecord[s.groupName] = s.optionName;
    });
    selectionsRecord[parametricLabel] = `${lengthMm} ${unit}`;

    const baseComponents = Number(build?.price ?? build?.displayPrice ?? build?.sellPrice ?? build?.basePrice ?? 0);

    const configuration = {
      type: "build",
      buildId: build?.buildId ?? "build-1792398167103",
      buildName: build?.name || "Trailer Axle Builder",
      parametricSummary: `${lengthMm}${unit} Track Axle Beam`,
      parametricPrice: Number((baseComponents + lengthAdjustment).toFixed(2)),
      buildFeatures: activeSpecs,
      selections: selectionsRecord,
      parametricValues: parametricInput?.key
        ? { [parametricInput.key]: lengthMm }
        : { length: lengthMm },
      resolvedPrice: totalIncGst,
      totalPriceAdjustment: Number((lengthAdjustment + optionsTotal).toFixed(2)),
    };

    try {
      const res = await fetch(buildApiUrl("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: purchaseForm.fullName.trim(),
          customerEmail: purchaseForm.email.trim(),
          directItem: {
            productId: buildId,
            quantity: 1,
            configuration,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Failed to initialize Stripe checkout session");
      }
    } catch (err: any) {
      toast({
        title: "Checkout Issue",
        description: err.message || "Could not launch Stripe checkout. You can add to cart or request a formal quote.",
        variant: "destructive",
      });
    } finally {
      setIsDirectCheckingOut(false);
    }
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

    const selectionsPayload: Record<string, string[]> = {};
    activeSpecs.forEach((s) => {
      selectionsPayload[s.groupName] = [s.optionName];
    });
    selectionsPayload[parametricLabel] = [`${lengthMm} ${unit}`];

    try {
      const response = await fetch(buildApiUrl("/api/build-quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          buildId: build?.buildId ?? "build-1792398167103",
          buildCode: build?.buildCode || "AXLEBUILDER-BLD01",
          buildName: build?.name || "Trailer Axle Builder",
          selections: selectionsPayload,
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
              optionName: `${parametricLabel}: ${lengthMm}${unit}`,
              price: lengthAdjustment,
              parametricFeatureValues: parametricInput?.key
                ? { [parametricInput.key]: lengthMm }
                : { length: lengthMm },
            },
            ...activeSpecs.map((s) => ({
              groupName: s.groupName,
              optionName: s.optionName,
              price: s.price,
            })),
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

  const buildTitle = build?.name || "Trailer Axle Builder";
  const buildDescription = build?.description || "";
  const displayImage = build?.imageUrl || build?.image || DEFAULT_IMAGE;

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
                  {buildTitle}
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
          {/* Left Column: Visual Blueprint & Option Groups (Cols 1-7) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Engineering Blueprint Display Card */}
            <div className="rounded-xl border border-[#1aa1e0]/30 bg-[#04080e]/80 overflow-hidden relative group shadow-[0_0_20px_rgba(0,0,0,0.6)]">
              {/* Technical Measurement Banner */}
              <div className="px-4 py-2 bg-[#09121d] border-b border-[#1aa1e0]/20 flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#1aa1e0] font-semibold">
                  <Ruler className="w-3.5 h-3.5" />
                  SPEC: {lengthMm}{unit} {parametricLabel}
                </span>
                <span className="text-slate-400 text-[11px]">
                  Precision Fabricated Assembly
                </span>
              </div>

              {/* Technical Drawing Image */}
              <div
                className="relative h-52 sm:h-64 md:h-72 w-full bg-black/60 flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => setIsPreviewImageOpen(true)}
              >
                <img
                  src={displayImage}
                  alt={buildTitle}
                  className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />

                {/* Dimension Overlay Badge */}
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1aa1e0]/40 text-xs font-mono text-[#1aa1e0] flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-[#1aa1e0] animate-pulse" />
                  {parametricLabel}: <strong className="text-white">{lengthMm} {unit}</strong>
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

            {/* Build Description from Payload */}
            {buildDescription && (
              <p className="text-xs text-slate-300 font-mono leading-relaxed bg-[#060c14]/80 p-3 rounded-lg border border-slate-800">
                {buildDescription}
              </p>
            )}

            {/* Option Groups from Payload */}
            {optionGroups.map((group: any, groupIndex: number) => {
              const GroupIcon = getGroupIcon(group.name);
              const selectedOptionId = selectedOptions[group.id];
              const selectedOption = group.options?.find((o: any) => o.id === selectedOptionId);
              const isCapacity = isCapacityGroup(group);
              const isPcd = isPcdGroup(group);

              // Filter options for capacity/assembly group based on PCD, Brake Type, and Wheel Size
              const visibleOptions = isCapacity
                ? (group.options?.filter((opt: any) =>
                    isAssemblyOptionCompatible(opt, selectedOptions, optionGroups)
                  ) ?? [])
                : (group.options ?? []);

              const isDenseGroup = visibleOptions.length > 4;

              return (
                <div key={group.id} className="flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs uppercase font-mono tracking-wider text-slate-200 font-semibold flex items-center gap-1.5">
                        <GroupIcon className="w-3.5 h-3.5 text-[#1aa1e0]" />
                        {groupIndex + 1}. {group.name}
                      </label>
                      {isPcd && (
                        <ParametricHelperBubble
                          helper={PCD_MEASUREMENT_HELPER}
                          className="ml-0.5"
                        />
                      )}
                      {selectedOption && (
                        <span className="text-[10px] font-mono text-[#1aa1e0] bg-[#1aa1e0]/10 border border-[#1aa1e0]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          {getOptionDisplayLabel(selectedOption)}
                        </span>
                      )}
                      {isCapacity && (
                        <span className="text-[10px] font-mono text-slate-400 bg-black/40 border border-slate-800 px-2 py-0.5 rounded-full">
                          {!selectedOptions[optionGroups.find(isBrakeGroup)?.id || ""]
                            ? `Showing ${visibleOptions.length} unbraked idler assemblies`
                            : `Showing ${visibleOptions.length} compatible braked assemblies`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOption && (
                        <button
                          type="button"
                          onClick={() => handleDeselectGroup(group)}
                          className="text-[10px] font-mono text-slate-400 hover:text-rose-400 flex items-center gap-0.5 transition-colors cursor-pointer"
                          title={`Deselect ${group.name}`}
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                      {group.description && (
                        <span className="text-[11px] text-slate-400 leading-tight hidden sm:inline">
                          {group.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {group.description && (
                    <span className="text-[11px] text-slate-400 leading-tight sm:hidden">
                      {group.description}
                    </span>
                  )}

                  {/* Empty state when 0 assemblies match */}
                  {isCapacity && visibleOptions.length === 0 ? (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-slate-300 text-xs flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                        <Info className="w-4 h-4 shrink-0" />
                        No assemblies match this specific combination
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        The selected stud pattern and brake combination does not have a physical axle assembly manufactured. Try clearing or changing your Brake Type selection.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearAllSelections}
                        className="self-start text-[11px] font-mono text-[#1aa1e0] hover:underline cursor-pointer"
                      >
                        Reset All Selections
                      </button>
                    </div>
                  ) : (
                    <div
                      className={
                        isDenseGroup
                          ? "grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1"
                          : `grid grid-cols-1 ${visibleOptions.length > 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-2.5`
                      }
                    >
                      {visibleOptions.map((option: any) => {
                        const isSelected = selectedOptionId === option.id;
                        const displayLabel = getOptionDisplayLabel(option);
                        const parts = isCapacity ? parseAssemblyParts(displayLabel) : null;
                        const optPrice = getOptionPrice(option, build);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelectOption(group, option)}
                            className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? "border-[#1aa1e0] bg-[#1aa1e0]/10 shadow-[0_0_18px_rgba(26,161,224,0.25)] ring-1 ring-[#1aa1e0]"
                                : "border-slate-800 bg-[#09121d]/70 hover:border-slate-700 hover:bg-[#0c1827]"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                {parts ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-[#1aa1e0]/15 text-[#1aa1e0] font-mono font-bold text-xs border border-[#1aa1e0]/30 shrink-0">
                                      {parts.capacity}
                                    </span>
                                    <span className="font-bold text-xs sm:text-sm text-white">
                                      {parts.pcd} &middot; {parts.brake}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                                    {displayLabel}
                                  </span>
                                )}
                                {isSelected && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1aa1e0] shrink-0 ml-auto" />
                                )}
                              </div>
                              {option.description && (
                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                  {option.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                              <span className={isSelected ? "text-[#1aa1e0] font-semibold" : "text-slate-500"}>
                                {isSelected ? "Selected (tap to deselect)" : "Select"}
                              </span>
                              {optPrice > 0 && (
                                <span className="text-[#1aa1e0] font-semibold">
                                  +NZ${optPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Parametric Dimension Slider from Payload */}
            {parametricInput && (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-[#1aa1e0]/30 bg-[#060d16]/90 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs uppercase font-mono tracking-wider text-slate-200 font-semibold flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#1aa1e0]" />
                      {optionGroups.length + 1}. {parametricLabel}
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Measurement range ({minLength}{unit} &ndash; {maxLength}{unit})
                    </p>
                  </div>

                  {/* Direct Number Input */}
                  <div className="flex items-center gap-1 bg-black/60 border border-[#1aa1e0]/40 rounded-lg px-2.5 py-1">
                    <input
                      type="number"
                      min={minLength}
                      max={maxLength}
                      step={step}
                      value={lengthInputVal}
                      onChange={handleLengthInputChange}
                      onBlur={handleLengthInputBlur}
                      className="w-16 bg-transparent text-right font-mono font-bold text-sm text-[#1aa1e0] focus:outline-none"
                    />
                    <span className="font-mono text-xs text-slate-400">{unit}</span>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="py-2">
                  <input
                    type="range"
                    min={minLength}
                    max={maxLength}
                    step={step}
                    value={lengthMm}
                    onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#1aa1e0]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>{minLength} {unit} (Min)</span>
                    <span>{Math.round((minLength + maxLength) / 2)} {unit}</span>
                    <span>{maxLength} {unit} (Max)</span>
                  </div>
                </div>

                {/* Dynamic Formula Indicator from Payload */}
                {ratePerMetre > 0 && (
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-black/40 px-3 py-2 rounded-lg border border-slate-800">
                    <span>Rate: ${ratePerMetre.toFixed(2)} per metre</span>
                    <span className="text-[#1aa1e0] font-semibold">
                      {lengthMm > defaultLength
                        ? `+NZ$${lengthAdjustment.toFixed(2)} (${((lengthMm - defaultLength) / 1000).toFixed(3)}m extra)`
                        : "Included in Baseline"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Build Specification & Actions (Cols 8-12) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-[#060a12]/90 border border-[#1aa1e0]/25 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1aa1e0]" />
                  Specification Summary
                </h3>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  isReadyToBuild
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-[#1aa1e0]/10 text-[#1aa1e0] border-[#1aa1e0]/30"
                }`}>
                  {isReadyToBuild ? "Ready to Build" : "Configuring"}
                </span>
              </div>

              {/* Spec Breakdown List */}
              <div className="flex flex-col gap-2 text-xs font-mono">
                {activeSpecs.map((spec) => (
                  <div key={spec.groupName} className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">{spec.groupName}:</span>
                    <span className="text-white font-semibold text-right max-w-[55%] truncate" title={spec.optionName}>
                      {spec.optionName}
                    </span>
                  </div>
                ))}
                {!isReadyToBuild && (
                  <div className="text-[11px] font-mono text-amber-400/90 italic py-1 flex items-center gap-1.5 border-b border-slate-800/60">
                    <Info className="w-3 h-3 shrink-0" />
                    <span>Select PCD &amp; an assembly to complete build</span>
                  </div>
                )}
                {parametricInput && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">{parametricLabel}:</span>
                    <span className="text-[#1aa1e0] font-bold">{lengthMm} {unit}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Fulfilment:</span>
                  <span className="text-slate-300">Custom Built to Order</span>
                </div>
              </div>

              {/* Cost Itemization from Payload */}
              <div className="bg-[#04080e] p-3.5 rounded-lg border border-slate-800/80 flex flex-col gap-2 text-xs font-mono mt-1">
                <div className="flex justify-between text-slate-400">
                  <span>Base Assembly:</span>
                  <span>NZ${Number(build?.price ?? build?.displayPrice ?? build?.sellPrice ?? 0).toFixed(2)}</span>
                </div>
                {optionsTotal > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Options Adjustment:</span>
                    <span>+NZ${optionsTotal.toFixed(2)}</span>
                  </div>
                )}
                {lengthAdjustment > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Length Adjustment ({lengthMm}{unit}):</span>
                    <span className="text-[#1aa1e0]">
                      +NZ${lengthAdjustment.toFixed(2)}
                    </span>
                  </div>
                )}
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

              {/* Direct Workshop Guarantee */}
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
                onClick={handleOpenPurchaseModal}
                className="w-full h-12 bg-gradient-to-r from-[#1aa1e0] to-[#00b4d8] hover:from-[#1aa1e0]/90 hover:to-[#00b4d8]/90 text-black font-bold uppercase tracking-wider font-mono text-xs sm:text-sm shadow-[0_0_25px_rgba(26,161,224,0.45)] flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all rounded-xl"
              >
                <ShoppingCart className="w-4 h-4" />
                {isReadyToBuild
                  ? `Add to Cart / Order · NZ$${totalIncGst.toFixed(2)}`
                  : `Select Assembly to Order · NZ$${totalIncGst.toFixed(2)}`}
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
                  Need something custom? Call Charlotte on 03 562 6024
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
                  src={displayImage}
                  alt={buildTitle}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl border border-[#1aa1e0]/40 shadow-[0_0_40px_rgba(26,161,224,0.3)]"
                />
                <p className="mt-3 text-xs font-mono text-[#1aa1e0] text-center">
                  {buildTitle} &middot; {lengthMm}{unit} {parametricLabel}
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
                      {buildTitle} &middot; {lengthMm}{unit} &middot; NZ${totalIncGst.toFixed(2)} incl GST
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

        {/* Dedicated Purchase & Cart Checkout Modal */}
        <AnimatePresence>
          {isPurchaseModalOpen && (
            <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-[#080d14] border border-[#1aa1e0]/50 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(26,161,224,0.35)] text-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[#1aa1e0]" />
                      Order Custom Trailer Axle
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {buildTitle} &middot; {lengthMm}{unit} &middot; NZ${totalIncGst.toFixed(2)} incl GST
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Big Technical Blueprint Image Preview */}
                <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-[#1aa1e0]/40 bg-black/75 flex items-center justify-center p-2 shadow-inner shrink-0">
                  <img
                    src={displayImage}
                    alt={buildTitle}
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[#09121d]/90 border border-[#1aa1e0]/40 text-[10px] font-mono text-[#1aa1e0] font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-md">
                    <Ruler className="w-3 h-3" />
                    {lengthMm}{unit} {parametricLabel}
                  </div>
                </div>

                {/* Accommodate the Individual Build Features */}
                <div className="p-3.5 rounded-xl border border-[#1aa1e0]/25 bg-[#04080e]/80 flex flex-col gap-2 font-mono text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-[#1aa1e0] font-bold border-b border-[#1aa1e0]/20 pb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Included Custom Build Features:
                  </span>
                  
                  {/* Base Beam Assembly */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <div>
                      <span className="text-slate-200 font-medium block">
                        Precision Axle Beam ({lengthMm}{unit})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Turned and welded beam assembly
                      </span>
                    </div>
                    <span className="text-[#1aa1e0] font-semibold">
                      NZ${(Number(build?.price ?? build?.displayPrice ?? build?.sellPrice ?? 0) + lengthAdjustment).toFixed(2)}
                    </span>
                  </div>

                  {/* Individual Build Features */}
                  {activeSpecs.map((spec, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-slate-800/40 text-slate-300">
                      <div>
                        <span className="text-slate-400 text-[10px] block">{spec.groupName}:</span>
                        <span className="text-slate-200">{spec.optionName}</span>
                      </div>
                      <span className={spec.price > 0 ? "text-[#1aa1e0] font-semibold" : "text-emerald-400 text-[11px]"}>
                        {spec.price > 0 ? `+NZ$${spec.price.toFixed(2)}` : "Included"}
                      </span>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="pt-2 flex justify-between items-center text-sm font-bold text-white border-t border-[#1aa1e0]/30">
                    <span>Total (incl. GST):</span>
                    <span className="text-base text-[#1aa1e0] drop-shadow-[0_0_8px_rgba(26,161,224,0.5)]">
                      NZ${totalIncGst.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Customer Contact Details */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block font-semibold">
                    Contact & Order Details:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                        Full Name *
                      </label>
                      <Input
                        required
                        value={purchaseForm.fullName}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, fullName: e.target.value })}
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
                        value={purchaseForm.email}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, email: e.target.value })}
                        placeholder="charlotte@example.co.nz"
                        className="bg-black/50 border-slate-700 h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase text-slate-400 block mb-1">
                      Phone Number (Optional)
                    </label>
                    <Input
                      type="tel"
                      value={purchaseForm.phone}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, phone: e.target.value })}
                      placeholder="021 000 0000"
                      className="bg-black/50 border-slate-700 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Direct Checkout & Add to Cart Action Buttons */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                  <Button
                    onClick={handleDirectCheckout}
                    disabled={isDirectCheckingOut || !purchaseForm.fullName.trim() || !purchaseForm.email.trim()}
                    className="w-full h-11 bg-[#1aa1e0] hover:bg-[#1aa1e0]/90 text-black font-bold uppercase tracking-wider font-mono text-xs shadow-[0_0_20px_rgba(26,161,224,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {isDirectCheckingOut ? "Connecting to Stripe..." : `Proceed to Instant Stripe Checkout &middot; NZ$${totalIncGst.toFixed(2)}`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddToCartFromModal}
                    disabled={addToCart.isPending}
                    className="w-full h-10 border border-[#1aa1e0]/40 text-[#1aa1e0] bg-[#1aa1e0]/10 hover:bg-[#1aa1e0]/20 hover:text-white uppercase tracking-wider font-mono text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {addToCart.isPending ? "Adding..." : "Add to Cart & Keep Browsing"}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
