import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, CheckCircle2, Ruler, Send, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-base";
import { useListProducts } from "@workspace/api-client-react";
import denversDeskIcon from "@assets/Denvers_Desk_Icon_Cropped.png";

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
  available?: boolean;
  showOnWebsite?: boolean;
};

type MeasurementInput = Partial<Record<"value" | "quantity" | "length" | "area" | "step" | "formula", number>>;

const GST_RATE = 0.15;

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  const { data: rawProducts } = useListProducts();
  const [measurementInput, setMeasurementInput] = useState<MeasurementInput>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
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

  useEffect(() => {
    if (!product) return;
    const next: MeasurementInput = {};
    for (const rule of rules) {
      const key = rule.basis === "formula" ? "formula" : rule.basis === "step" ? "step" : rule.basis;
      if (next[key] === undefined) next[key] = undefined;
    }
    setMeasurementInput(next);
    setIsSubmitted(false);
  }, [product, rules]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const pricing = useMemo(() => evaluateParametricPricing(product ?? { id: 0, name: "", price: 0, rules: [] }, measurementInput), [product, measurementInput]);
  const measurementSummary = useMemo(() => product ? formatMeasurementSummary(product, measurementInput) : "", [product, measurementInput]);
  const missingRequiredMeasurements = useMemo(() => {
    if (!product) return [];
    return rules
      .filter((rule) => resolveMeasurementInput(rule, measurementInput) === null)
      .map((rule) => rule.label || rule.id);
  }, [measurementInput, product, rules]);

  const measurementFieldGroups = useMemo(() => {
    const groups: SyncedParametricRule[] = [];
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule.basis)) continue;
      seen.add(rule.basis);
      groups.push(rule);
    }
    return groups;
  }, [rules]);

  const updateMeasurement = (basis: SyncedParametricRule["basis"], value: string) => {
    setMeasurementInput((prev) => ({
      ...prev,
      [basis === "formula" ? "formula" : basis === "step" ? "step" : basis]: value === "" ? undefined : Number(value),
    }));
  };

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
          parametricProductId: product.id,
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
            parametricProductId: product.id,
            productId: product.id,
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
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  </div>

                  <section className="rounded-2xl border border-cyan-400/15 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-cyan-300" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Measurement Input</h3>
                    </div>

                    {measurementFieldGroups.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {measurementFieldGroups.map((rule) => {
                          const inputKey = rule.basis === "formula" ? "formula" : rule.basis === "step" ? "step" : rule.basis;
                          const currentValue = measurementInput[inputKey];
                          const unit = rule.unitLabel || product.measurementLabel || "ea";
                          return (
                            <label key={rule.id} className="space-y-2 rounded-xl border border-cyan-400/10 bg-black/20 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">{rule.label || rule.basis}</div>
                                  <div className="text-[11px] text-cyan-100/60">
                                    {product.measurementLabel || "Measurement"}
                                    {unit ? ` • ${unit}` : ""}
                                  </div>
                                </div>
                                <span className="rounded-full border border-cyan-400/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-200/70">
                                  {rule.basis}
                                </span>
                              </div>
                              <Input
                                type="number"
                                step={rule.step || 0.01}
                                min={rule.minimum ?? 0}
                                max={rule.maximum || undefined}
                                value={currentValue ?? ""}
                                onChange={(event) => updateMeasurement(rule.basis, event.target.value)}
                                placeholder={`Enter ${rule.basis}`}
                                className="bg-black/30 border-cyan-400/15 text-white placeholder:text-cyan-100/35"
                                data-testid={`input-parametric-${rule.id}`}
                              />
                              <div className="text-[11px] text-cyan-100/55">
                                {rule.minimum ? `Min ${rule.minimum}` : "No minimum"}
                                {rule.maximum ? ` • Max ${rule.maximum}` : ""}
                                {rule.step ? ` • Step ${rule.step}` : ""}
                              </div>
                            </label>
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
                    disabled={isSubmitting || missingRequiredMeasurements.length > 0}
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
