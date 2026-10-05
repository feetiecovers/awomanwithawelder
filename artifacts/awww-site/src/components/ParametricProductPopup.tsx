import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, CheckCircle2, CircleHelp, Ruler, Send, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-base";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import denversDeskIcon from "@assets/Denvers_Desk_Icon_Cropped.png";
import { evaluateParametricValidation } from "@/lib/parametric-validation";

interface ParametricProductPopupProps {
  productId: number | null;
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

type SyncedParametricRule = {
  id: string;
  label: string;
  basis: "length" | "area" | "quantity" | "step" | "formula";
  unitLabel?: string;
  step?: number;
  minimum?: number;
  maximum?: number;
  pricePerUnit?: number;
  priceAdjustment?: number;
  minimumCharge?: number;
  notes?: string;
};

type SyncedParametricProduct = {
  id: number;
  name: string;
  description?: string | null;
  price?: number;
  sellPrice?: number;
  basePrice?: number;
  measurementLabel?: string;
  measurementUnit?: string;
  pricingMode?: "linear" | "tiered" | "formula";
  rules?: SyncedParametricRule[];
  definitionId?: string;
  parametricProductId?: string;
  commercialProductId?: string;
  definitionVersion?: number;
  inputDefinitions?: SyncedInputDefinition[];
  validationRules?: ValidationRule[];
  available?: boolean;
  showOnWebsite?: boolean;
};

type InputChoice = { id?: string; value?: string | number | boolean; label?: string; isDefault?: boolean };
type SyncedInputDefinition = {
  id?: string;
  key?: string;
  inputType?: string;
  controlType?: "dropdown" | "button_group" | "checkboxes" | "toggle" | "colour_swatch" | "quantity" | "number" | "slider" | "stepped_slider";
  label?: string;
  minimum?: number;
  maximum?: number;
  step?: number;
  precision?: number;
  defaultValue?: string | number | boolean;
  required?: boolean;
  unit?: string;
  helperText?: string;
  helperTitle?: string;
  helperImage?: string;
  choices?: InputChoice[];
};

type MeasurementInput = Record<string, string | number | boolean | string[] | undefined>;
type ParametricResolution = {
  valid: boolean;
  sellPrice?: number;
  promise?: {
    message?: string;
    promiseDate?: string;
  };
  definitionId?: string;
  definitionVersion?: number;
  configurationHash?: string;
  selectedConfiguration?: Record<string, unknown>;
  summary?: Array<{ inputKey?: string; label?: string; displayValue?: string }>;
  validation?: { valid: boolean; blockers: ValidationMessage[]; warnings: ValidationMessage[]; info: ValidationMessage[] };
};
type ValidationMessage = { ruleId: string; severity: "blocker" | "warning" | "info"; message: string; left: string; right: string | number };
type ValidationRule = { id: string; left: string; operator: "<" | "<=" | ">" | ">=" | "=" | "!="; right: string | number; severity: "blocker" | "warning" | "info"; message: string };

function inputKey(definition: SyncedInputDefinition): string {
  return String(definition.key || definition.inputType || definition.id || "").trim();
}

function controlType(definition: SyncedInputDefinition) {
  if (definition.controlType) return definition.controlType;
  if (definition.inputType === "toggle") return "toggle";
  return Array.isArray(definition.choices) && definition.choices.length > 0 ? "dropdown" : "number";
}

function choiceValue(choice: InputChoice): string | number | boolean {
  if (choice.value !== undefined && choice.value !== null && String(choice.value).trim()) return choice.value;
  return choice.label || choice.id || "";
}

function defaultValue(definition: SyncedInputDefinition): string | number | boolean | string[] {
  if (definition.defaultValue !== undefined && definition.defaultValue !== null && String(definition.defaultValue).trim()) return definition.defaultValue;
  const defaultChoice = definition.choices?.find((choice) => choice.isDefault);
  if (defaultChoice) return choiceValue(defaultChoice);
  if (controlType(definition) === "toggle") return false;
  if (controlType(definition) === "checkboxes") return [];
  if ((controlType(definition) === "slider" || controlType(definition) === "stepped_slider") && Number.isFinite(Number(definition.minimum))) return Number(definition.minimum);
  return "";
}


const GST_RATE = 0.15;

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPromise(promise?: ParametricResolution["promise"]): string {
  const message = promise?.message?.trim();
  if (message) return message;
  if (promise?.promiseDate) return `Expected availability: ${promise.promiseDate}`;
  return "Availability will be confirmed with your quote";
}

function normalizeMeasurementValue(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return roundCurrency(Math.max(0, numeric));
}

function resolveMeasurementInput(rule: SyncedParametricRule, input?: MeasurementInput): number | null {
  if (!input) return null;
  const ruleBasisKey = rule.basis === "formula" ? "formula" : rule.basis === "step" ? "step" : rule.basis;
  return (
    normalizeMeasurementValue(input[ruleBasisKey])
    ?? normalizeMeasurementValue(input.value)
    ?? normalizeMeasurementValue(input.quantity)
    ?? normalizeMeasurementValue(input.length)
    ?? normalizeMeasurementValue(input.area)
    ?? normalizeMeasurementValue(input.formula)
  );
}

function evaluateRule(rule: SyncedParametricRule, measurement: number) {
  const warnings: string[] = [];
  let normalizedMeasurement = measurement;
  const minimum = Number(rule.minimum) || 0;
  const maximum = Number(rule.maximum) || 0;
  const step = Math.abs(Number(rule.step) || 0);

  if (minimum > 0 && normalizedMeasurement < minimum) {
    normalizedMeasurement = minimum;
    warnings.push(`${rule.label || rule.id} raised to the minimum of ${minimum}.`);
  }

  if (maximum > 0 && normalizedMeasurement > maximum) {
    normalizedMeasurement = maximum;
    warnings.push(`${rule.label || rule.id} capped at the maximum of ${maximum}.`);
  }

  if (step > 0 && rule.basis !== "formula") {
    const origin = minimum > 0 ? minimum : 0;
    const stepped = roundCurrency(origin + Math.ceil(Math.max(0, normalizedMeasurement - origin) / step) * step);
    if (stepped !== normalizedMeasurement) {
      warnings.push(`${rule.label || rule.id} rounded up to the next ${step} step.`);
    }
    normalizedMeasurement = stepped;
  }

  const pricePerUnit = roundCurrency(Number(rule.pricePerUnit) || 0);
  const priceAdjustment = roundCurrency(Number(rule.priceAdjustment) || 0);
  const minimumCharge = Math.max(0, roundCurrency(Number(rule.minimumCharge) || 0));
  const rawTotal = roundCurrency((normalizedMeasurement * pricePerUnit) + priceAdjustment);
  const total = minimumCharge > 0 && rawTotal < minimumCharge ? minimumCharge : rawTotal;

  if (minimumCharge > 0 && total === minimumCharge && rawTotal < minimumCharge) {
    warnings.push(`${rule.label || rule.id} raised to the minimum charge of ${minimumCharge}.`);
  }

  return {
    ruleId: rule.id,
    label: rule.label,
    basis: rule.basis,
    measurement,
    normalizedMeasurement,
    pricePerUnit,
    priceAdjustment,
    minimumCharge,
    total: roundCurrency(total),
    warnings,
  };
}

function evaluateParametricPricing(product: SyncedParametricProduct, measurementInput?: MeasurementInput) {
  const rules = Array.isArray(product.rules) ? product.rules : [];
  const evaluatedRules = rules
    .map((rule) => {
      const measurement = resolveMeasurementInput(rule, measurementInput);
      if (measurement === null) return null;
      return evaluateRule(rule, measurement);
    })
    .filter((entry): entry is ReturnType<typeof evaluateRule> => entry !== null);

  const baseSellPrice = roundCurrency(Number(product.price ?? product.sellPrice ?? product.basePrice ?? 0));
  if (evaluatedRules.length === 0) {
    return {
      baseSellPrice,
      baseCostPrice: roundCurrency(Number(product.basePrice ?? 0)),
      measurement: null as number | null,
      ruleTotal: 0,
      totalSellPrice: baseSellPrice,
      appliedRules: [] as ReturnType<typeof evaluateRule>[],
      warnings: [] as string[],
    };
  }

  const mode = product.pricingMode ?? "linear";
  const applicableRules = (() => {
    if (mode === "tiered") {
      const sorted = [...evaluatedRules].sort((left, right) => {
        const leftSpan = (rules.find((rule) => rule.id === left.ruleId)?.maximum ?? 0) - (rules.find((rule) => rule.id === left.ruleId)?.minimum ?? 0);
        const rightSpan = (rules.find((rule) => rule.id === right.ruleId)?.maximum ?? 0) - (rules.find((rule) => rule.id === right.ruleId)?.minimum ?? 0);
        if (leftSpan !== rightSpan) return leftSpan - rightSpan;
        return (Number(rules.find((rule) => rule.id === right.ruleId)?.minimum) || 0) - (Number(rules.find((rule) => rule.id === left.ruleId)?.minimum) || 0);
      });
      return sorted.slice(0, 1);
    }

    if (mode === "formula") {
      const formulaRules = evaluatedRules.filter((entry) => entry.basis === "formula");
      return formulaRules.length > 0 ? formulaRules : evaluatedRules;
    }

    return evaluatedRules;
  })();

  const ruleTotal = roundCurrency(applicableRules.reduce((sum, entry) => sum + entry.total, 0));
  return {
    baseSellPrice,
    baseCostPrice: roundCurrency(Number(product.basePrice ?? 0)),
    measurement: applicableRules[0]?.measurement ?? null,
    ruleTotal,
    totalSellPrice: roundCurrency(baseSellPrice + ruleTotal),
    appliedRules: applicableRules,
    warnings: applicableRules.flatMap((entry) => entry.warnings),
  };
}

function formatMeasurementSummary(product: SyncedParametricProduct, measurementInput?: MeasurementInput) {
  const rules = Array.isArray(product.rules) ? product.rules : [];
  const summaries: string[] = [];
  const seenBasis = new Set<string>();

  for (const rule of rules) {
    if (seenBasis.has(rule.basis)) continue;
    const measurement = resolveMeasurementInput(rule, measurementInput);
    if (measurement === null) continue;
    seenBasis.add(rule.basis);
    const unit = rule.unitLabel || product.measurementLabel || "ea";
    summaries.push(`${rule.basis}: ${measurement}${unit ? ` ${unit}` : ""}`);
  }

  return summaries.join(", ");
}

function ParametricPricingCard({
  title,
  value,
  description,
  highlight = false,
}: {
  title: string;
  value: string;
  description?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-200/70">{title}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
      {description ? <div className="mt-1 text-[11px] text-cyan-100/70">{description}</div> : null}
    </div>
  );
}

export function ParametricProductPopup({ isOpen, onClose, productId }: ParametricProductPopupProps) {
  const { toast } = useToast();
  const { data: rawProducts } = useListProducts({
    query: {
      queryKey: getListProductsQueryKey(),
      enabled: isOpen && productId !== null,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  const [measurementInput, setMeasurementInput] = useState<MeasurementInput>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resolution, setResolution] = useState<ParametricResolution | null>(null);
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [resolverError, setResolverError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
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

  const product = useMemo(() => {
    if (!rawProducts || !productId) return null;
    const items = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any).products ?? [];
    return items.find((entry: any) => entry.id === productId) as SyncedParametricProduct | undefined ?? null;
  }, [rawProducts, productId]);

  const rules = useMemo(() => Array.isArray(product?.rules) ? product.rules : [], [product]);
  const parametricDefinitionId = String(
    (product as any)?.parametricProductId
    ?? (product as any)?.definitionId
    ?? (product as any)?.externalId
    ?? product?.id
    ?? "",
  );

  useEffect(() => {
    if (!product) return;
    const next: MeasurementInput = {};
    for (const input of (product.inputDefinitions ?? [])) {
      const key = inputKey(input);
      if (key) next[key] = defaultValue(input);
    }
    for (const rule of rules) {
      const key = rule.basis === "formula" ? "formula" : rule.basis === "step" ? "step" : rule.basis;
      if (next[key] === undefined) next[key] = undefined;
    }
    setMeasurementInput(next);
    setIsSubmitted(false);
    setResolution(null);
    setResolverError("");
  }, [product, rules]);

  useEffect(() => {
    if (!isOpen || !product || !parametricDefinitionId) return;
    const definitions = product.inputDefinitions ?? [];
    if (definitions.length === 0) return;
    const missing = definitions.filter((input) => {
      if (input.required === false) return false;
      const value = measurementInput[inputKey(input)];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length > 0) {
      setResolution(null);
      setResolverError(`Choose ${missing.map((input) => input.label || inputKey(input)).join(", ")}`);
      setIsResolving(false);
      return;
    }
    const controller = new AbortController();
    setIsResolving(true);
    setResolverError("");
    const resolverUrl = (product as any)?.configurationResolver?.url || (product as any)?.resolver?.url || buildApiUrl('/api/ecommerce/configuration/resolve');
    fetch(resolverUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ websiteId: import.meta.env.VITE_WEBSITE_ID || 'web-1782561404289', commercialProductId: product.commercialProductId, purchaseMode: 'parametric', definitionId: parametricDefinitionId, definitionVersion: product.definitionVersion, inputValues: measurementInput, quantity: 1 }) })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as ParametricResolution | null;
        if (!response.ok || !result?.valid || !Number.isFinite(Number(result.sellPrice))) {
          return Promise.reject({ message: (result as any)?.error || result?.validation?.blockers?.map((entry) => entry.message).join(" ") || "These inputs could not be resolved", result });
        }
        return result;
      })
      .then((result) => { if (!controller.signal.aborted) setResolution(result); })
      .catch((error: { message?: string; result?: ParametricResolution }) => { if (!controller.signal.aborted) { setResolution(error.result ?? null); setResolverError(error.message || "These inputs could not be resolved"); } })
      .finally(() => { if (!controller.signal.aborted) setIsResolving(false); });
    return () => controller.abort();
  }, [isOpen, product, parametricDefinitionId, measurementInput]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const pricing = useMemo(() => {
    const local = evaluateParametricPricing(product ?? { id: 0, name: "", price: 0, rules: [] }, measurementInput);
    return resolution?.valid && Number.isFinite(Number(resolution.sellPrice)) ? { ...local, totalSellPrice: Number(resolution.sellPrice) } : local;
  }, [product, measurementInput, resolution]);
  const measurementSummary = useMemo(() => product ? formatMeasurementSummary(product, measurementInput) : "", [product, measurementInput]);
  const localValidation = useMemo(() => evaluateParametricValidation(product?.validationRules, measurementInput), [product?.validationRules, measurementInput]);
  const promiseSummary = useMemo(() => formatPromise(resolution?.promise), [resolution?.promise]);
  const missingRequiredMeasurements = useMemo(() => {
    if (!product) return [];
    const definitions = product.inputDefinitions ?? [];
    if (definitions.length > 0) return definitions.filter((input) => {
      const value = measurementInput[inputKey(input)];
      return input.required !== false && (value === undefined || value === "" || (Array.isArray(value) && value.length === 0));
    }).map((input) => input.label || inputKey(input));
    return rules
      .filter((rule) => resolveMeasurementInput(rule, measurementInput) === null)
      .map((rule) => rule.label || rule.id);
  }, [measurementInput, product, rules]);

  const measurementFieldGroups = useMemo(() => {
    const definitions = product?.inputDefinitions ?? [];
    if (definitions.length) return definitions;
    const groups: SyncedParametricRule[] = [];
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule.basis)) continue;
      seen.add(rule.basis);
      groups.push(rule);
    }
    return groups;
  }, [rules]);

  const setValue = (key: string, value: MeasurementInput[string]) => setMeasurementInput((previous) => ({ ...previous, [key]: value }));
  const toggleChoice = (key: string, value: string | number | boolean) => setMeasurementInput((previous) => {
    const selected = Array.isArray(previous[key]) ? previous[key] as string[] : [];
    const normalised = String(value);
    return { ...previous, [key]: selected.includes(normalised) ? selected.filter((entry) => entry !== normalised) : [...selected, normalised] };
  });

  const handleSubmitQuote = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!product) return;
    if (missingRequiredMeasurements.length > 0) {
      toast({
        title: "Measurement Required",
        description: `Please enter: ${missingRequiredMeasurements.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    if ((product.inputDefinitions?.length ?? 0) > 0 && (!resolution?.valid || !Number.isFinite(Number(resolution.sellPrice)))) {
      toast({ title: "Configuration Required", description: resolverError || "Please wait for your configuration to be resolved.", variant: "destructive" });
      return;
    }
    if (!quoteForm.fullName || !quoteForm.email || !quoteForm.phone) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter your name, email, and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiUrl("/api/quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "quote-request",
          quoteRequested: true,
          productId: product.id,
          parametricProductId: parametricDefinitionId,
          definitionId: parametricDefinitionId,
          inputValues: measurementInput,
          resolvedConfiguration: resolution,
          quantity: 1,
          fullName: quoteForm.fullName,
          email: quoteForm.email,
          phone: quoteForm.phone,
          address1: quoteForm.streetAddress,
          city: quoteForm.townCity,
          suburb: quoteForm.region,
          zipCode: quoteForm.postcode,
          notes: quoteForm.notes,
          measurementInput,
          pricingSnapshot: pricing,
          calculatedPrice: pricing.totalSellPrice,
          websiteRequest: {
            source: "quote-request",
            parametricProductId: parametricDefinitionId,
            definitionId: parametricDefinitionId,
            productId: parametricDefinitionId,
            quantity: 1,
            fullName: quoteForm.fullName,
            email: quoteForm.email,
            phone: quoteForm.phone,
            address1: quoteForm.streetAddress,
            city: quoteForm.townCity,
            suburb: quoteForm.region,
            zipCode: quoteForm.postcode,
            notes: quoteForm.notes,
            measurementInput,
            inputValues: measurementInput,
            resolvedConfiguration: resolution,
            pricingSnapshot: pricing,
            calculationSnapshot: pricing,
            calculatedPrice: pricing.totalSellPrice,
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to submit quote");
      }

      setIsSubmitted(true);
      toast({
        title: "Quote Submitted Successfully!",
        description: `Thank you ${quoteForm.fullName}! Our team will contact you shortly.`,
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
    setIsSubmitted(false);
    setIsSubmitting(false);
    setQuoteForm({ fullName: "", email: "", phone: "", streetAddress: "", townCity: "", region: "", postcode: "", notes: "" });
    setMeasurementInput({});
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#04131a]/90 backdrop-blur-xl"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-6xl h-[92dvh] rounded-[24px] border border-cyan-400/25 bg-[#07161d]/95 shadow-2xl overflow-hidden z-10 text-white flex flex-col"
        >
          <div className="relative flex items-center justify-between px-5 py-3 border-b border-cyan-400/15 bg-[#0b1d26]/85 shrink-0">
            <div className="flex items-center gap-3">
              <img src={denversDeskIcon} alt="Denver's Desk" className="h-8 w-8 object-contain" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-cyan-300/80">Parametric Builder</p>
                <h2 className="text-sm sm:text-lg font-black uppercase tracking-wider text-white">{product.name}</h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full border border-cyan-400/25 bg-white/5 text-cyan-100 hover:bg-cyan-500/20 hover:text-white"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>

          {isSubmitted ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-lg text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold">Quote request received</h3>
                <p className="text-sm text-cyan-100/70">
                  Thanks, {quoteForm.fullName}. We’ve captured your measurement snapshot and will follow up shortly.
                </p>
                <Button onClick={resetQuoteForm} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_380px]">
              <form onSubmit={handleSubmitQuote} className="flex flex-col border-r border-cyan-400/10">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <ParametricPricingCard
                      title="Base Price"
                      value={formatCurrency(pricing.baseSellPrice)}
                      description="Desktop-aligned base price"
                    />
                    <ParametricPricingCard
                      title="Rules"
                      value={`${pricing.appliedRules.length}`}
                      description={`${rules.length} supported rule${rules.length === 1 ? "" : "s"}`}
                    />
                    <ParametricPricingCard
                      title="Measurement"
                      value={product.measurementLabel || "Measurement"}
                      description={measurementSummary || "Enter the required values"}
                    />
                    <ParametricPricingCard
                      title="Quote Total"
                      value={formatCurrency(pricing.totalSellPrice)}
                      description={pricing.warnings.length > 0 ? pricing.warnings[0] : "Authoritative server price will be recalculated"}
                      highlight
                    />
                    <ParametricPricingCard
                      title="Expected Availability"
                      value={isResolving ? "Checking..." : promiseSummary}
                      description="Based on current Denver's Desk capacity"
                    />
                  </div>

                  <section className="rounded-2xl border border-cyan-400/15 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-cyan-300" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Measurement Input</h3>
                    </div>

                    {measurementFieldGroups.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {measurementFieldGroups.map((rule: SyncedParametricRule | SyncedInputDefinition) => {
                          const definition = rule as SyncedInputDefinition;
                          const legacyRule = rule as SyncedParametricRule;
                          const key = inputKey(definition) || legacyRule.basis;
                          const type = inputKey(definition) ? controlType(definition) : "number";
                          const currentValue = measurementInput[key];
                          const unit = definition.unit || legacyRule.unitLabel || product.measurementLabel || "ea";
                          return (
                            <fieldset key={definition.id || key} className="space-y-2 rounded-xl border border-cyan-400/10 bg-black/20 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-1 text-sm font-semibold text-white">{definition.label || legacyRule.label || key}{definition.required === false ? "" : " *"}{(definition.helperTitle || definition.helperText || definition.helperImage) && <button type="button" onClick={() => setOpenHelp(openHelp === key ? null : key)} className="rounded-full text-cyan-200 hover:text-white" aria-label={`How to measure ${definition.label || key}`}><CircleHelp className="h-4 w-4" /></button>}</div>
                                  <div className="text-[11px] text-cyan-100/60">
                                    {definition.helperText || product.measurementLabel || "Measurement"}
                                    {unit ? ` • ${unit}` : ""}
                                  </div>
                                </div>
                                <span className="rounded-full border border-cyan-400/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-200/70">
                                  {type}
                                </span>
                              </div>
                              {(type === "number" || type === "quantity" || type === "slider" || type === "stepped_slider") && <Input
                                type={type === "slider" || type === "stepped_slider" ? "range" : "number"}
                                step={definition.step ?? definition.precision ?? legacyRule.step ?? 0.01}
                                min={definition.minimum ?? legacyRule.minimum ?? 0}
                                max={(definition.maximum ?? legacyRule.maximum) || undefined}
                                value={typeof currentValue === "string" || typeof currentValue === "number" ? currentValue : ""}
                                onChange={(event) => setValue(key, event.target.value === '' ? "" : Number(event.target.value))}
                                placeholder={`Enter ${key}`}
                                className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                                data-testid={`input-parametric-${definition.id || key}`}
                              />}
                              {type === "dropdown" && <select value={typeof currentValue === "string" || typeof currentValue === "number" ? currentValue : ""} onChange={(event) => setValue(key, event.target.value)} className="w-full rounded-md border border-cyan-400/15 bg-black/30 px-3 py-2 text-white"><option value="">Choose an option</option>{(definition.choices ?? []).map((choice) => <option key={choice.id || String(choiceValue(choice))} value={String(choiceValue(choice))}>{choice.label || String(choiceValue(choice))}</option>)}</select>}
                              {(type === "button_group" || type === "colour_swatch") && <div className="grid grid-cols-2 gap-2">{(definition.choices ?? []).map((choice) => { const value = choiceValue(choice); return <Button key={choice.id || String(value)} type="button" variant="outline" onClick={() => setValue(key, value)} className={String(currentValue) === String(value) ? "border-cyan-300 bg-cyan-500/20" : "border-cyan-400/15"}>{choice.label || String(value)}</Button>; })}</div>}
                              {type === "checkboxes" && <div className="space-y-2">{(definition.choices ?? []).map((choice) => { const value = choiceValue(choice); return <label key={choice.id || String(value)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Array.isArray(currentValue) && currentValue.includes(String(value))} onChange={() => toggleChoice(key, value)} />{choice.label || String(value)}</label>; })}</div>}
                              {type === "toggle" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(currentValue)} onChange={(event) => setValue(key, event.target.checked)} />{definition.label || key}</label>}
                              <div className="text-[11px] text-cyan-100/55">
                                {rule.minimum ? `Min ${rule.minimum}` : "No minimum"}
                                {rule.maximum ? ` • Max ${rule.maximum}` : ""}
                                {rule.step ? ` • Step ${rule.step}` : ""}
                              </div>
                              {openHelp === key && <div className="rounded-lg border border-cyan-300/25 bg-slate-950/95 p-3 text-xs text-cyan-50 shadow-xl">{definition.helperImage && <img src={definition.helperImage} alt="Measurement guide" className="mb-2 max-h-40 w-full rounded object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />}{definition.helperTitle && <p className="font-bold text-cyan-200">{definition.helperTitle}</p>}{definition.helperText && <p className="mt-1 text-cyan-50/80">{definition.helperText}</p>}</div>}
                            </fieldset>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-cyan-400/20 p-4 text-sm text-cyan-100/70">
                        This parametric product currently uses the base price only. No measurement inputs are configured yet.
                      </div>
                    )}

                    {pricing.warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                        {pricing.warnings.join(" ")}
                      </div>
                    )}
                    {localValidation.blockers.map((entry) => <p key={entry.ruleId} className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{entry.message}</p>)}
                    {localValidation.warnings.map((entry) => <p key={entry.ruleId} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">{entry.message}</p>)}
                    {localValidation.info.map((entry) => <p key={entry.ruleId} className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-sm text-cyan-100">{entry.message}</p>)}
                    {(resolution?.validation?.blockers ?? []).filter((entry) => !localValidation.blockers.some((local) => local.ruleId === entry.ruleId)).map((entry) => <p key={`server-${entry.ruleId}`} className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{entry.message}</p>)}
                  </section>

                  <section className="rounded-2xl border border-cyan-400/15 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-cyan-300" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Customer Details</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={quoteForm.fullName}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Full name"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                        data-testid="input-parametric-full-name"
                      />
                      <Input
                        value={quoteForm.email}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Email"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                        data-testid="input-parametric-email"
                      />
                      <Input
                        value={quoteForm.phone}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="Phone"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                        data-testid="input-parametric-phone"
                      />
                      <Input
                        value={quoteForm.postcode}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, postcode: e.target.value }))}
                        placeholder="Postcode"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={quoteForm.streetAddress}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, streetAddress: e.target.value }))}
                        placeholder="Street address"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                      />
                      <Input
                        value={quoteForm.townCity}
                        onChange={(e) => setQuoteForm((prev) => ({ ...prev, townCity: e.target.value }))}
                        placeholder="Town / City"
                        className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                      />
                    </div>
                    <Input
                      value={quoteForm.region}
                      onChange={(e) => setQuoteForm((prev) => ({ ...prev, region: e.target.value }))}
                      placeholder="Region"
                      className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                    />
                    <Textarea
                      value={quoteForm.notes}
                      onChange={(e) => setQuoteForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any notes for the team"
                      className="min-h-24 bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                    />
                  </section>
                </div>

                <div className="shrink-0 border-t border-cyan-400/10 p-4 bg-[#081921]/95 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-cyan-100/65">
                    {measurementSummary ? (
                      <span>Measured: {measurementSummary}</span>
                    ) : (
                      <span>Enter the required measurements to calculate your quote.</span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isResolving || localValidation.blockers.length > 0 || missingRequiredMeasurements.length > 0 || ((product.inputDefinitions?.length ?? 0) > 0 && !resolution?.valid)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest"
                    data-testid="button-submit-parametric-quote"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Quote"}
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>

              <aside className="hidden lg:flex flex-col gap-4 p-5 bg-black/20">
                <div className="rounded-3xl border border-cyan-400/15 bg-[#081821]/90 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-cyan-300" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Pricing Preview</h3>
                  </div>
                  <div className="space-y-3">
                    <ParametricPricingCard title="Base Sell Price" value={formatCurrency(pricing.baseSellPrice)} />
                    <ParametricPricingCard title="Rule Total" value={formatCurrency(pricing.ruleTotal)} />
                    <ParametricPricingCard title="GST" value={formatCurrency(roundCurrency(pricing.totalSellPrice * GST_RATE))} />
                    <ParametricPricingCard title="Quote Total" value={formatCurrency(roundCurrency(pricing.totalSellPrice * (1 + GST_RATE)))} highlight />
                  </div>
                </div>

                <div className="rounded-3xl border border-cyan-400/15 bg-[#081821]/90 p-4 text-sm text-cyan-100/70 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Snapshot</h3>
                  </div>
                  <p>
                    The quote request includes the selected measurement values, the calculation snapshot, and the customer details so the desktop backend can recalculate and store a historical quote.
                  </p>
                  <p className="text-xs text-cyan-100/55">
                    Backend pricing remains authoritative. Any mismatched preview values will be rejected by the server.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
