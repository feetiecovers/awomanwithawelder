import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
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
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  TRAILER_CATEGORIES,
  type TrailerBuild,
  type FeatureGroupWithOptions,
  type FeatureOption
} from "@/lib/configuratorData";
import { buildApiUrl } from "@/lib/api-base";
import { getTrailerIcon } from "./TrailerIcons";
import ladyLuggerLogo from "@assets/Lady_Lugger_Logo_Cropped.png";
import denversDeskIcon from "@assets/Denvers_Desk_Logo_CleanCropped.png";
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
  townCity: string;
  region: string;
  postcode: string;
  notes: string;
}

const GST_RATE = 0.15;

interface SyncedBuildRecord {
  id?: string;
  name?: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  price?: number;
  displayPrice?: number;
  optionGroups?: Array<{
    id?: string;
    name?: string;
    description?: string | null;
    selectionType?: string;
    sortOrder?: number;
    options?: Array<{
      id?: string;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      price?: number;
      isIncluded?: boolean;
      sortOrder?: number;
    }>;
  }>;
}

function hashToNumericId(value: string, fallback: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash > 0 ? hash : fallback;
}

const SHARED_IMAGE_BASE_URL = "https://denver-s-desk.onrender.com";

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\/localhost:\d+\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}/${trimmed.replace(/^https?:\/\/localhost:\d+\//i, "")}`;
  }

  if (/^\/(?:api\/)?images\/products\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }

  if (/^images\/products\//i.test(trimmed)) {
    return `${SHARED_IMAGE_BASE_URL}/${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${SHARED_IMAGE_BASE_URL}${trimmed}`;
  }

  return trimmed;
}

function mapSyncedBuildCatalog(value: unknown): {
  builds: TrailerBuild[];
  featureGroupsByBuildId: Record<number, FeatureGroupWithOptions[]>;
} {
  const records = Array.isArray(value)
    ? value
    : (value as { builds?: unknown[] })?.builds ?? [];

  const builds: TrailerBuild[] = [];
  const featureGroupsByBuildId: Record<number, FeatureGroupWithOptions[]> = {};

  records.forEach((rawRecord, buildIndex) => {
    const record = rawRecord as SyncedBuildRecord;
    const buildKey = String(record?.id ?? `build-${buildIndex + 1}`);
    const buildId = hashToNumericId(buildKey, buildIndex + 101);

    const build: TrailerBuild = {
      id: buildId,
      trailerTypeId: 1,
      name: String(record?.name ?? `Build ${buildIndex + 1}`),
      description: String(record?.description ?? ""),
      imageUrl: normalizeImageUrl(record.imageUrl ?? record.image),
      basePrice: Number(record.displayPrice ?? record.price ?? 0),
      sortOrder: buildIndex + 1,
    };
    builds.push(build);

    const groups = Array.isArray(record.optionGroups) ? record.optionGroups : [];
    featureGroupsByBuildId[buildId] = groups.map((group, groupIndex) => {
      const groupKey = `${buildKey}:${String(group?.id ?? groupIndex)}`;
      const groupId = hashToNumericId(groupKey, buildId + groupIndex + 1);
      const options = Array.isArray(group?.options) ? group.options : [];
      return {
        id: groupId,
        trailerTypeId: 1,
        name: String(group?.name ?? `Option Group ${groupIndex + 1}`),
        description: typeof group?.description === "string" ? group.description : null,
        selectionType: group?.selectionType === "multiple" ? "multiple" : "single",
        sortOrder: Number(group?.sortOrder ?? groupIndex + 1),
        options: options.map((option, optionIndex) => ({
          id: hashToNumericId(`${groupKey}:${String(option?.id ?? optionIndex)}`, groupId + optionIndex + 1),
          featureGroupId: groupId,
          name: String(option?.name ?? `Option ${optionIndex + 1}`),
          description: typeof option?.description === "string" ? option.description : null,
          imageUrl: normalizeImageUrl(option?.imageUrl),
          price: Number(option?.price ?? 0),
          isIncluded: option?.isIncluded === true,
          sortOrder: Number(option?.sortOrder ?? optionIndex + 1),
        })),
      } satisfies FeatureGroupWithOptions;
    });
  });

  return { builds, featureGroupsByBuildId };
}

export function TrailerConfiguratorPopup({ isOpen, onClose }: TrailerConfiguratorPopupProps) {
  const { toast } = useToast();
  
  // Slide Paginated Navigation & Accordion state (Step 1: Base Model, Step 2: Options, Step 3: Mobile Breakdown)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [openGroupId, setOpenGroupId] = useState<number | null>(null);
  
  // Selection state
  const selectedCategoryId = 1; // Locked default category (Car Hauler)
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(101);
  const [selectedFeatures, setSelectedFeatures] = useState<Record<number, number | number[]>>({});
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [activePreviewLabel, setActivePreviewLabel] = useState<string>("");
  const [syncedBuilds, setSyncedBuilds] = useState<TrailerBuild[]>([]);
  const [syncedFeatureGroupsByBuildId, setSyncedFeatureGroupsByBuildId] = useState<Record<number, FeatureGroupWithOptions[]>>({});
  
  // Quote Modal Overlay state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryRequired, setDeliveryRequired] = useState<string>("no");

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

  useEffect(() => {
    let cancelled = false;

    const loadBuildCatalog = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/ecommerce/builds"), {
          credentials: "include",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;
        const mapped = mapSyncedBuildCatalog(payload);
        if (mapped.builds.length > 0) {
          setSyncedBuilds(mapped.builds);
          setSyncedFeatureGroupsByBuildId(mapped.featureGroupsByBuildId);
        }
      } catch {
        // Fall back to bundled demo catalog if offline
      }
    };

    loadBuildCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = TRAILER_CATEGORIES.find((c) => c.id === selectedCategoryId) || TRAILER_CATEGORIES[0];
  const availableBuilds = syncedBuilds;

  // Default build initialization
  useEffect(() => {
    if (availableBuilds.length > 0 && !selectedBuildId) {
      setSelectedBuildId(availableBuilds[0].id);
      setActivePreviewImage(availableBuilds[0].imageUrl || null);
      setActivePreviewLabel(availableBuilds[0].name);
    }
  }, [availableBuilds, selectedBuildId]);

  useEffect(() => {
    if (availableBuilds.length === 0) return;
    if (selectedBuildId && availableBuilds.some((build) => build.id === selectedBuildId)) return;
    setSelectedBuildId(availableBuilds[0].id);
  }, [availableBuilds, selectedBuildId]);

  const selectedBuild = availableBuilds.find((b) => b.id === selectedBuildId) || availableBuilds[0];
  const activeFeatureGroups = selectedBuild ? syncedFeatureGroupsByBuildId[selectedBuild.id] ?? [] : [];

  // Default feature options initialization
  useEffect(() => {
    const defaults: Record<number, number | number[]> = {};
    activeFeatureGroups.forEach((group) => {
      if (group.selectionType === "single") {
        const included = group.options.find((opt) => opt.isIncluded);
        defaults[group.id] = included ? included.id : group.options[0]?.id ?? 0;
      } else {
        defaults[group.id] = group.options.filter((opt) => opt.isIncluded).map((opt) => opt.id);
      }
    });
    setSelectedFeatures(defaults);
    setOpenGroupId(activeFeatureGroups[0]?.id ?? null);
  }, [activeFeatureGroups, selectedBuild?.id]);

  useEffect(() => {
    if (!selectedBuild?.imageUrl || activePreviewImage) return;
    setActivePreviewImage(selectedBuild.imageUrl);
    setActivePreviewLabel(selectedBuild.name);
  }, [selectedBuild?.id, selectedBuild?.imageUrl, selectedBuild?.name, activePreviewImage]);

  // Pricing calculation
  const selectedAddons = useMemo(() => {
    const list: { groupName: string; optionName: string; price: number }[] = [];
    activeFeatureGroups.forEach((group) => {
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
  }, [activeFeatureGroups, selectedFeatures]);

  const selectedBuildSelections = useMemo(() => {
    return activeFeatureGroups.reduce<Record<string, string[]>>((acc, group) => {
      const selection = selectedFeatures[group.id];
      if (selection === undefined) return acc;

      const selectedOptionNames = group.selectionType === "single"
        ? group.options
            .filter((option) => option.id === selection)
            .map((option) => option.name)
        : group.options
            .filter((option) => Array.isArray(selection) && selection.includes(option.id))
            .map((option) => option.name);

      if (selectedOptionNames.length > 0) {
        acc[group.name] = selectedOptionNames;
      }

      return acc;
    }, {});
  }, [activeFeatureGroups, selectedFeatures]);

  const basePrice = selectedBuild ? selectedBuild.basePrice : 0;
  const addonsTotal = selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const totalIncGst = basePrice + addonsTotal;
  const subtotalExGst = totalIncGst / (1 + GST_RATE);
  const gstAmount = totalIncGst - subtotalExGst;

  const handleFeatureToggle = (
    group: FeatureGroupWithOptions,
    option: FeatureOption
  ) => {
    if (option.isIncluded) return;

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

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.fullName || !quoteForm.email || !quoteForm.phone) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter your name, email, and phone number.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBuild) {
      toast({
        title: "Build Missing",
        description: "Please select a build before requesting a quote.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(buildApiUrl("/api/build-quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          buildName: selectedBuild.name,
          selections: selectedBuildSelections,
          fullName: quoteForm.fullName,
          email: quoteForm.email,
          phone: quoteForm.phone,
          streetAddress: quoteForm.streetAddress,
          townCity: quoteForm.townCity,
          region: quoteForm.region,
          postcode: quoteForm.postcode,
          notes: quoteForm.notes,
          deliveryRequired,
          estimatedSubtotal: subtotalExGst,
          estimatedGst: gstAmount,
          estimatedTotal: totalIncGst,
          selectedAddons,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to submit build quote");
      }

      setIsSubmitted(true);
      toast({
        title: "Quote Submitted Successfully!",
        description: `Thank you ${quoteForm.fullName}! Our team will contact you shortly regarding your custom build.`,
      });
    } catch (error: any) {
      toast({
        title: "Quote Submission Failed",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetQuoteForm = () => {
    setIsQuoteModalOpen(false);
    setIsSubmitted(false);
    setIsSubmitting(false);
    setQuoteForm({ fullName: "", email: "", phone: "", streetAddress: "", townCity: "", region: "", postcode: "", notes: "" });
    setCurrentStep(1);
  };

  const CategoryIcon = getTrailerIcon(selectedCategory.name);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
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
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
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
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{
            boxShadow: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            borderColor: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            duration: 0.3,
          }}
          className="relative w-full max-w-6xl h-[92dvh] bg-[#0e0412]/95 border-2 rounded-[24px] overflow-hidden flex flex-col z-10 text-white shadow-2xl backdrop-blur-2xl no-scrollbar"
          style={{
            backgroundImage: "radial-gradient(ellipse at top right, rgba(255,42,141,0.15), transparent 60%), radial-gradient(ellipse at bottom left, rgba(147,51,234,0.12), transparent 70%)"
          }}
        >
          {/* Header Bar - Original Layout */}
          <div className="relative flex items-center justify-between px-5 py-3 border-b border-[#ff2a8d]/20 bg-[#16061c]/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <img
                src={denversDeskIcon}
                alt="Denver's Desk"
                className="h-8 w-8 sm:h-8.5 sm:w-8.5 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] shrink-0"
              />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center">
              <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
                <h2 className="text-xs xs:text-sm sm:text-lg font-black uppercase tracking-wider bg-gradient-to-r from-white via-pink-200 to-[#ff2a8d] bg-clip-text text-transparent whitespace-nowrap">
                  Trailer Configurator™
                </h2>
                <span className="px-2 py-0.5 text-[8px] xs:text-[8.5px] font-mono font-bold uppercase tracking-widest bg-[#ff2a8d] text-white rounded-full shadow-[0_0_10px_rgba(255,42,141,0.7)] whitespace-nowrap">
                  Lady Lugger Edition
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8.5 w-8.5 rounded-full bg-white/5 border border-pink-500/30 text-pink-200 hover:bg-[#ff2a8d]/30 hover:text-white transition-all shadow-[0_0_12px_rgba(255,42,141,0.3)] shrink-0"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>

          {/* Credits Bar */}
          <div className="hidden sm:flex items-center justify-center gap-3 sm:gap-6 py-1 px-4 bg-[#0a030d] border-b border-[#ff2a8d]/15 text-[10px] sm:text-[11px] font-mono text-pink-200/80 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span>Wired with help from</span>
              <img src={cableCadLogo} alt="CableCAD" className="h-3.5 sm:h-4 w-auto object-contain opacity-95 inline-block" />
            </div>
            <span className="text-pink-500/40 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span>Electrically tested using</span>
              <img src={trailerBrainLogo} alt="The Trailer Brain" className="h-3.5 sm:h-4.5 w-auto object-contain opacity-95 inline-block" />
            </div>
          </div>

          {/* Main Paginated Slide Content Area */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
            {/* Left Paginated Slide Pane */}
            <div className="overflow-hidden flex flex-col justify-between p-3.5 sm:p-5 relative no-scrollbar">
              <AnimatePresence mode="wait">
                {/* PAGE 1: Base Build Model Selection (Vertically balanced & centered) */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1 flex flex-col justify-between overflow-y-auto w-full max-w-2xl mx-auto py-1 no-scrollbar"
                  >
                    {/* Centered Lady Lugger Logo (10% larger) */}
                    <div className="flex flex-col items-center justify-center text-center mb-4 shrink-0">
                      <img
                        src={ladyLuggerLogo}
                        alt="The Lady Lugger"
                        className="w-[85%] max-w-[495px] h-auto max-h-[120px] sm:max-h-[175px] object-contain drop-shadow-[0_0_30px_rgba(255,42,141,0.9)]"
                      />
                      <p className="text-xs text-pink-200/80 font-mono mt-2">
                        Select a base trailer build model below to begin customizing options.
                      </p>
                    </div>

                    {/* Centered Base Model Grid */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {availableBuilds.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                          <div className="w-6 h-6 border-2 border-[#ff2a8d] border-t-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-xs text-pink-200/60 font-mono">Loading configurator data...</p>
                        </div>
                      ) : (
                        availableBuilds.map((build) => {
                          const isSelected = selectedBuild?.id === build.id;
                          return (
                            <div
                              key={build.id}
                              onClick={() => {
                                handleBuildSelect(build);
                              }}
                              className={`cursor-pointer rounded-2xl p-3.5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                                isSelected
                                  ? "bg-[#25092b]/95 border-[#ff2a8d] shadow-[0_0_25px_rgba(255,42,141,0.5)] ring-1 ring-[#ff2a8d]"
                                  : "bg-[#14051a]/60 border-pink-500/15 hover:border-pink-500/40 hover:bg-[#1f0727]/50"
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-3 right-3 text-[#ff2a8d]">
                                  <CheckCircle2 className="h-4.5 w-4.5 drop-shadow-[0_0_6px_rgba(255,42,141,0.8)]" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-xs sm:text-sm text-white pr-6">{build.name}</h4>
                                <p className="text-[11px] text-pink-200/60 mt-1 line-clamp-2">{build.description}</p>
                              </div>
                              <div className="mt-3 pt-1.5 border-t border-pink-500/15 flex items-center justify-between">
                                <span className="text-[9.5px] font-mono uppercase tracking-widest text-pink-200/50">Base Model Price</span>
                                <span className="font-mono font-black text-xs sm:text-sm text-[#ff2a8d]">
                                  NZ${build.basePrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Step 1 Footer Navigation Button */}
                    <div className="w-full flex justify-center pt-3 shrink-0">
                      <Button
                        onClick={() => setCurrentStep(2)}
                        className="h-10 px-7 rounded-xl bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(255,42,141,0.6)] hover:brightness-110 flex items-center gap-2"
                        data-testid="button-go-to-step-2"
                      >
                        <span>Configure Options &amp; Upgrades</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* PAGE 2: Configure Categories & Options (Single Open Accordion) */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1 flex flex-col justify-between overflow-hidden"
                  >
                    <div className="mb-2 shrink-0 flex items-center justify-between border-b border-pink-500/15 pb-1.5">
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5" />
                          Configure Options &amp; Upgrades
                        </h3>
                        <p className="text-[10.5px] text-pink-200/60 mt-0.5">
                          Select options below. Click any section header to expand.
                        </p>
                      </div>
                      <span className="text-[9.5px] font-mono text-pink-300/60 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                        {activeFeatureGroups.length} Categories
                      </span>
                    </div>

                    {/* Accordion Container - Completely hidden scrollbar */}
                    <div className="flex-1 overflow-y-auto space-y-2 my-1 pr-0.5 no-scrollbar">
                      {activeFeatureGroups.map((group) => {
                        const isOpenGroup = openGroupId === group.id;
                        const currentSelection = selectedFeatures[group.id];

                        let summaryText = "None selected";
                        if (group.selectionType === "single") {
                          const opt = group.options.find((o) => o.id === currentSelection);
                          if (opt) summaryText = opt.name;
                        } else if (Array.isArray(currentSelection) && currentSelection.length > 0) {
                          summaryText = `${currentSelection.length} selected`;
                        }

                        const optionCount = group.options.length;
                        const isLargeGroup = optionCount > 6;

                        return (
                          <div
                            key={group.id}
                            className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                              isOpenGroup
                                ? "bg-[#180620]/95 border-[#ff2a8d] shadow-[0_0_18px_rgba(255,42,141,0.25)]"
                                : "bg-[#120417]/70 border-pink-500/20 hover:border-pink-500/40 hover:bg-[#16061c]/80"
                            }`}
                          >
                            {/* Accordion Header */}
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
                                  {group.selectionType === "single" ? "Single Choice" : "Multi Choice"}
                                </span>
                                <div className={`p-1 rounded-full transition-transform duration-300 ${isOpenGroup ? "rotate-180 bg-[#ff2a8d]/20 text-[#ff2a8d]" : "text-pink-200/50"}`}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </button>

                            {/* Accordion Body */}
                            {isOpenGroup && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="px-3 pb-3 pt-1 border-t border-pink-500/15"
                              >
                                {group.description && (
                                  <p className="text-[10.5px] text-pink-200/60 mb-2">{group.description}</p>
                                )}

                                <div className="max-h-[220px] sm:max-h-[240px] overflow-y-auto pr-0.5 no-scrollbar">
                                  <div
                                    className={`grid gap-1.5 ${
                                      isLargeGroup
                                        ? "grid-cols-2 sm:grid-cols-3"
                                        : "grid-cols-1 sm:grid-cols-2"
                                    }`}
                                  >
                                    {group.options.map((opt) => {
                                      const isChecked = group.selectionType === "single"
                                        ? currentSelection === opt.id
                                        : Array.isArray(currentSelection) && currentSelection.includes(opt.id);

                                      return (
                                        <button
                                          key={opt.id}
                                          onClick={() => handleFeatureToggle(group, opt)}
                                          className={`text-left border transition-all duration-200 flex items-center justify-between gap-1.5 ${
                                            isLargeGroup ? "p-2 rounded-lg text-[9.5px]" : "p-2.5 rounded-xl text-xs"
                                          } ${
                                            isChecked
                                              ? "bg-[#ff2a8d]/20 border-[#ff2a8d] text-white shadow-[0_0_10px_rgba(255,42,141,0.3)]"
                                              : "bg-white/[0.02] border-pink-500/15 text-pink-200/70 hover:border-pink-500/35 hover:bg-white/[0.05]"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <div
                                              className={`${isLargeGroup ? "w-3.5 h-3.5" : "w-4 h-4"} rounded-${group.selectionType === "single" ? "full" : "md"} border flex items-center justify-center shrink-0 ${
                                                isChecked
                                                  ? "bg-[#ff2a8d] border-[#ff2a8d] text-black shadow-[0_0_6px_rgba(255,42,141,0.8)]"
                                                  : "border-pink-500/30"
                                              }`}
                                            >
                                              {isChecked && <Check className={`${isLargeGroup ? "w-2.5 h-2.5" : "w-3 h-3"} stroke-[3]`} />}
                                            </div>
                                            <span className="font-medium truncate leading-tight">{opt.name}</span>
                                          </div>
                                          <span className="font-mono text-[8.5px] sm:text-[9px] font-bold shrink-0 text-[#ff2a8d]">
                                            {opt.isIncluded ? "Included" : `+NZ$${opt.price}`}
                                          </span>
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

                    {/* Step 2 Footer Navigation */}
                    <div className="pt-3 flex items-center justify-between shrink-0 border-t border-pink-500/15">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(1)}
                        className="h-8.5 px-3.5 rounded-xl border border-pink-500/20 text-pink-200 hover:bg-white/5 text-xs font-mono uppercase flex items-center gap-1.5"
                        data-testid="button-back-to-step-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Base Model</span>
                      </Button>

                      <Button
                        onClick={() => {
                          if (window.innerWidth < 1024) {
                            setCurrentStep(3);
                          } else {
                            setIsQuoteModalOpen(true);
                          }
                        }}
                        className="h-8.5 px-4.5 rounded-xl bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,42,141,0.5)] hover:brightness-110 flex items-center gap-1.5"
                        data-testid="button-go-to-step-3"
                      >
                        <span className="lg:hidden">Breakdown &amp; Quote</span>
                        <span className="hidden lg:inline">Request Quote</span>
                        <ArrowRight className="w-3.5 h-3.5 lg:hidden" />
                        <Send className="w-3.5 h-3.5 hidden lg:inline" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* PAGE 3: Mobile Visual Preview, Breakdown & Quote Slide */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1 flex flex-col justify-between overflow-hidden lg:hidden"
                  >
                    <div className="space-y-3 overflow-y-auto pr-0.5 no-scrollbar pb-2">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-1.5 mb-1.5">
                          <ImageIcon className="h-4 w-4" />
                          Build Visual Preview
                        </span>
                        <div className="relative rounded-2xl overflow-hidden border border-[#ff2a8d]/30 bg-[#1a0822] aspect-video w-full flex items-center justify-center shadow-[0_0_20px_rgba(255,42,141,0.25)]">
                          {activePreviewImage ? (
                            <img
                              src={activePreviewImage}
                              alt={activePreviewLabel}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="p-4 text-center flex flex-col items-center gap-1 text-pink-300/60">
                              <CategoryIcon className="w-12 h-12 text-[#ff2a8d]/60" />
                              <span className="text-xs font-mono">Build preview</span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5">
                            <p className="text-xs font-bold text-white truncate">{activePreviewLabel || selectedBuild?.name}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-pink-500/20 bg-[#180620]/90 p-2.5 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#ff2a8d]/15 border border-[#ff2a8d]/30 text-[#ff2a8d] shrink-0">
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#ff2a8d] font-bold block">Model</span>
                          <h5 className="font-bold text-xs text-white truncate">{selectedBuild?.name}</h5>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-pink-500/25 bg-[#17061f] p-3 space-y-1.5">
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white border-b border-pink-500/20 pb-1">
                          Cost Summary
                        </h4>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between text-pink-200/70">
                            <span>Base Price:</span>
                            <span>NZ${basePrice.toLocaleString()}</span>
                          </div>
                          {addonsTotal > 0 && (
                            <div className="flex justify-between text-pink-300">
                              <span>Selected Extras ({selectedAddons.length}):</span>
                              <span>+NZ${addonsTotal.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-black text-[#ff2a8d] pt-1.5 border-t border-pink-500/30">
                            <span>Total Estimated:</span>
                            <span>NZ${totalIncGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                      {/* Mobile Last Page Credits */}
                      <div className="rounded-xl border border-pink-500/20 bg-[#0a030d]/80 p-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono text-pink-200/80 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span>Wired with help from</span>
                          <img src={cableCadLogo} alt="CableCAD" className="h-3.5 w-auto object-contain opacity-95 inline-block" />
                        </div>
                        <span className="text-pink-500/40">•</span>
                        <div className="flex items-center gap-1.5">
                          <span>Electrically tested using</span>
                          <img src={trailerBrainLogo} alt="The Trailer Brain" className="h-3.5 w-auto object-contain opacity-95 inline-block" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between shrink-0 border-t border-pink-500/15 gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(2)}
                        className="h-8 px-2.5 xs:px-3 rounded-xl border border-pink-500/20 text-pink-200 hover:bg-white/5 text-[10px] xs:text-xs font-mono uppercase flex items-center gap-1 shrink-0"
                        data-testid="button-back-to-step-2"
                      >
                        <ArrowLeft className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                        <span>Configurations</span>
                      </Button>

                      <Button
                        onClick={() => setIsQuoteModalOpen(true)}
                        className="h-8.5 px-2.5 xs:px-3.5 rounded-xl bg-gradient-to-r from-[#ff2a8d] via-[#e11d48] to-[#9333ea] text-white font-mono font-bold text-[10px] xs:text-[11px] uppercase tracking-tight xs:tracking-wider shadow-[0_0_18px_rgba(255,42,141,0.6)] flex items-center gap-1.5 shrink-0"
                        data-testid="button-request-quote-mobile-step3"
                      >
                        <Send className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                        <span>Request Official Quote</span>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Pane (Desktop Summary Sidebar - Persistent across Step 1 and Step 2) */}
            <div className="hidden lg:flex border-l border-[#ff2a8d]/20 bg-[#110417]/95 p-3.5 flex-col justify-between overflow-y-auto no-scrollbar">
              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a8d] flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Visual Build Preview
                    </span>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-[#ff2a8d]/30 bg-[#1a0822] aspect-video w-full flex items-center justify-center shadow-[0_0_20px_rgba(255,42,141,0.25)] group max-h-[165px]">
                    {activePreviewImage ? (
                      <img
                        src={activePreviewImage}
                        alt={activePreviewLabel}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="p-4 text-center flex flex-col items-center gap-1.5 text-pink-300/60">
                        <CategoryIcon className="w-12 h-12 text-[#ff2a8d]/60" />
                        <span className="text-[11px] font-mono">Select a build or option</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5">
                      <p className="text-xs font-bold text-white truncate">{activePreviewLabel || selectedBuild?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-pink-500/20 bg-[#180620]/90 p-2.5 flex items-start gap-2.5 shadow-[0_0_15px_rgba(255,42,141,0.15)]">
                  <div className="p-2 rounded-lg bg-[#ff2a8d]/15 border border-[#ff2a8d]/30 text-[#ff2a8d] shrink-0">
                    <CategoryIcon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8.5px] font-mono uppercase tracking-widest text-[#ff2a8d] font-bold block">Selected Model</span>
                    <h5 className="font-bold text-xs text-white truncate">{selectedBuild?.name}</h5>
                    <p className="text-[10.5px] text-pink-200/60 leading-tight mt-0.5 line-clamp-2">{selectedBuild?.description}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-pink-500/25 bg-[#17061f] p-3 space-y-2">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white border-b border-pink-500/20 pb-1.5">
                    Build Cost Breakdown
                  </h4>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-pink-200/70 font-semibold">
                      <span className="truncate pr-2">{selectedBuild?.name || "Base Trailer Build"}</span>
                      <span className="font-mono text-white shrink-0">NZ${basePrice.toLocaleString()}</span>
                    </div>
                    {addonsTotal > 0 && (
                      <div className="flex justify-between text-pink-300 font-semibold">
                        <span>Configured Extras ({selectedAddons.length})</span>
                        <span className="font-mono">+NZ${addonsTotal.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-pink-500/20 space-y-0.5 font-mono">
                    <div className="flex justify-between text-[10.5px] text-pink-200/60">
                      <span>Subtotal (Excl. GST)</span>
                      <span>NZ${subtotalExGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10.5px] text-pink-200/60">
                      <span>15% GST</span>
                      <span>NZ${gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm font-black text-[#ff2a8d] pt-1.5 border-t border-pink-500/30">
                      <span>Total Estimated Cost</span>
                      <span className="drop-shadow-[0_0_8px_rgba(255,42,141,0.8)]">
                        NZ${totalIncGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-pink-500/20">
                <Button
                  onClick={() => setIsQuoteModalOpen(true)}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-[#ff2a8d] via-[#e11d48] to-[#9333ea] text-white font-mono font-bold uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(255,42,141,0.7)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  Request Official Quote &amp; Specs
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quote Modal Overlay */}
        <AnimatePresence>
          {isQuoteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
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
                className="relative w-full max-w-4xl max-h-[88dvh] bg-[#16061c] border-2 border-[#ff2a8d] rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(255,42,141,0.7)] z-10 text-white overflow-y-auto no-scrollbar"
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
                  <form onSubmit={handleSubmitQuote} className="grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[360px_1fr] gap-5">
                    {/* Left Column: Build Image & Full Extras Listing */}
                    <div className="space-y-3 bg-[#0f0414] p-4 rounded-2xl border border-pink-500/20">
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

                      {/* Extras Listing */}
                      <div className="space-y-2 pt-2 border-t border-pink-500/20">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 font-bold block">Configured Extras ({selectedAddons.length})</span>
                        {selectedAddons.length === 0 ? (
                          <p className="text-[11px] text-pink-200/40 italic">Standard build specifications</p>
                        ) : (
                          <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                            {selectedAddons.map((addon, index) => (
                              <div key={index} className="flex justify-between items-start text-[11px] text-pink-200/90 gap-2">
                                <span className="leading-snug pr-1">• {addon.groupName}: {addon.optionName}</span>
                                <span className="font-mono text-pink-300 shrink-0">+${addon.price}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing Summary */}
                      <div className="pt-2 border-t border-pink-500/30 space-y-1 font-mono text-xs">
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

                    {/* Right Column: Contact Details & Address Form (Address, Town/City, Region, Post Code) */}
                    <div className="space-y-3 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <p className="text-xs text-pink-200/80 leading-relaxed">
                          Complete your details below and A Woman With a Welder will get back to you with a confirmed quote and design specs. Email <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-[#ff2a8d] font-bold underline hover:text-pink-300 transition-colors">charlotte@awomanwithawelder.co.nz</a> for direct inquiries.
                        </p>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 flex items-center gap-1 font-bold">
                            <User className="h-3 w-3 text-[#ff2a8d]" /> Full Name *
                          </label>
                          <Input
                            required
                            value={quoteForm.fullName}
                            onChange={(e) => setQuoteForm({ ...quoteForm, fullName: e.target.value })}
                            placeholder="Denver Smith"
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 flex items-center gap-1 font-bold">
                              <Mail className="h-3 w-3 text-[#ff2a8d]" /> Email Address *
                            </label>
                            <Input
                              required
                              type="email"
                              value={quoteForm.email}
                              onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                              placeholder="denver@example.co.nz"
                              className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 flex items-center gap-1 font-bold">
                              <Phone className="h-3 w-3 text-[#ff2a8d]" /> Phone Number *
                            </label>
                            <Input
                              required
                              value={quoteForm.phone}
                              onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                              placeholder="021 123 4567"
                              className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                            />
                          </div>
                        </div>

                        {/* Address Section */}
                        <div className="space-y-2 p-3 rounded-2xl border border-pink-500/20 bg-pink-500/[0.03]">
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 flex items-center gap-1 font-bold">
                            <MapPin className="h-3 w-3 text-[#ff2a8d]" /> Address Details
                          </label>

                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-mono uppercase tracking-wider text-pink-200/70">Address *</label>
                              <Input
                                required
                                value={quoteForm.streetAddress}
                                onChange={(e) => setQuoteForm({ ...quoteForm, streetAddress: e.target.value })}
                                placeholder="123 Industrial Way"
                                className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[9px] font-mono uppercase tracking-wider text-pink-200/70">Town / City *</label>
                                <Input
                                  required
                                  value={quoteForm.townCity}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, townCity: e.target.value })}
                                  placeholder="Auckland"
                                  className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-mono uppercase tracking-wider text-pink-200/70">Region *</label>
                                <Input
                                  required
                                  value={quoteForm.region}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, region: e.target.value })}
                                  placeholder="Auckland"
                                  className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-mono uppercase tracking-wider text-pink-200/70">Post Code</label>
                                <Input
                                  value={quoteForm.postcode}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, postcode: e.target.value })}
                                  placeholder="1010"
                                  className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 font-bold">Delivery Required? *</label>
                          <select
                            value={deliveryRequired}
                            onChange={(e) => setDeliveryRequired(e.target.value)}
                            className="w-full bg-[#0f0414] border border-pink-500/30 text-white text-xs rounded-xl p-2 mt-0.5 focus:border-[#ff2a8d] outline-none"
                          >
                            <option value="no">No - Depot Pickup</option>
                            <option value="yes">Yes - Delivery Required</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-pink-200/80 font-bold">Custom Requirements / Notes</label>
                          <Textarea
                            rows={2}
                            value={quoteForm.notes}
                            onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                            placeholder="Ramp length specs, custom powdercoat color codes, tie-down placement..."
                            className="bg-[#0f0414] border-pink-500/30 text-white text-xs mt-0.5 focus:border-[#ff2a8d]"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-10 mt-2 bg-gradient-to-r from-[#ff2a8d] to-[#d92376] text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl shadow-[0_0_20px_rgba(255,42,141,0.6)] hover:brightness-110 transition-all"
                      >
                        {isSubmitting ? "Submitting..." : `Submit Quote Request (NZ$${totalIncGst.toLocaleString()})`}
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
