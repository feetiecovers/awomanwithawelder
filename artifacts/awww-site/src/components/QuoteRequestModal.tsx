import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Phone, ReceiptText, Mail, User, Info, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetCurrentMember } from "@workspace/api-client-react";
import { buildApiUrl } from "@/lib/api-base";

export interface QuoteRequestProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image?: string | null;
}

export interface QuoteRequestConfiguration {
  selections?: Record<string, string[]>;
  selectedOptionIds?: string[];
  selectedOptions?: Array<Record<string, unknown>>;
  totalPriceAdjustment?: number;
  values?: Record<string, unknown>;
  parametricProductId?: string;
  definitionId?: string;
}

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: QuoteRequestProduct | null;
  configuration?: QuoteRequestConfiguration;
}

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

export function QuoteRequestModal({ isOpen, onClose, product, configuration }: QuoteRequestModalProps) {
  const { toast } = useToast();
  const { data: member } = useGetCurrentMember();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset/autofill form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (member) {
        setFullName(member.name || "");
        setEmail(member.email || "");
      }
      setIsSubmitting(false);
    }
  }, [isOpen, member]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!product) return;

    if (!fullName.trim() || !email.trim() || !phone.trim() || !address1.trim() || !suburb.trim() || !city.trim() || !zipCode.trim()) {
      toast({
        title: "Missing details",
        description: "Please complete all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(buildApiUrl("/api/quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          fullName,
          phone,
          email,
          address1,
          address2,
          suburb,
          city,
          zipCode,
          notes,
          shippingLabel: "",
          shippingPrice: 0,
          configuration,
          payment_status: "unpaid",
          paymentStatus: "unpaid"
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit quote request");
      }

      toast({
        title: "Quote Request Sent!",
        description: "We have forwarded your request to our orders team and will be in touch soon."
      });
      
      onClose();
      // Reset form on success
      setNotes("");
      setAddress1("");
      setAddress2("");
      setSuburb("");
      setCity("");
      setZipCode("");
      if (!member) {
        setFullName("");
        setEmail("");
        setPhone("");
      }
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const productPrice = product?.price ?? 0;
  const combinedSubtotal = productPrice / 1.15;
  const combinedGst = productPrice - combinedSubtotal;
  const combinedTotal = productPrice;

  return (
    <AnimatePresence>
      {isOpen && product && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 18 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="pointer-events-auto w-full max-w-4xl overflow-y-auto scroll-industrial max-h-[calc(100dvh-32px)] rounded-[28px] border border-primary/20 bg-[#080d14]/95 shadow-[0_0_60px_rgba(26,157,224,0.18)]"
            >
              <div className="flex items-center justify-between border-b border-primary/15 bg-[#05080e]/80 px-6 py-4 sm:px-8 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary px-2 sm:px-3 py-1 rounded-full font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] whitespace-nowrap shrink-0">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span>Quote Request</span>
                  </div>
                  <h3 className="font-mono text-xs sm:text-lg font-bold uppercase tracking-[0.12em] text-primary truncate">
                    Request a Quote
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-6 pt-5 pb-2 sm:px-8 border-b border-primary/10">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Submit your details to request custom configurations, shipping calculations, and options. The Woman with A Welder will get back to you as soon she is able too. If you don't hear back from her in the next 24 Hours - flick us an email at <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-primary font-semibold underline hover:text-primary/80">charlotte@awomanwithawelder.co.nz</a> it may have just got lost somewhere.
                </p>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                <form 
                  onSubmit={handleSubmit}
                  className="space-y-4 p-6"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                        <User className="h-3 w-3" /> Full Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Phone Number <span className="text-destructive">*</span>
                      </label>
                      <Input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="021 345 6789"
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email Address <span className="text-destructive">*</span>
                    </label>
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                    />
                  </div>

                  <div className="space-y-3 p-4 rounded-2xl border border-primary/10 bg-primary/3">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Delivery Address Details <span className="text-destructive">*</span>
                    </label>
                    <div className="grid gap-3">
                      <Input
                        required
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                        placeholder="Address Line 1"
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                      <Input
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        placeholder="Address Line 2 (Optional)"
                        className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          required
                          value={suburb}
                          onChange={(e) => setSuburb(e.target.value)}
                          placeholder="Suburb"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                        />
                        <Input
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                        />
                        <Input
                          required
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="Zip Code"
                          className="bg-primary/5 border-primary/20 focus:border-primary/50 font-mono text-sm h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                      What would you like changed, added or quoted?
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Specify any desired changes, dimension mods, custom coatings, or structural requests..."
                      className="bg-primary/5 border-primary/20 focus:border-primary/50 resize-none min-h-[100px] font-mono text-sm"
                    />
                  </div>
                </form>

                {/* Right Side - Context */}
                <div className="border-t border-primary/10 bg-[#0d1520]/60 backdrop-blur-md p-6 lg:border-l lg:border-t-0 flex flex-col">
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Product Info</p>
                    {product.image && (
                      <div 
                        className="w-full h-32 rounded-xl mt-3 mb-3 bg-center bg-contain bg-no-repeat bg-black/40" 
                        style={{ backgroundImage: `url(${product.image})` }} 
                      />
                    )}
                    <p className="text-lg font-semibold text-foreground">{product.name}</p>
                    {product.description && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-3 whitespace-pre-wrap">{product.description}</p>
                    )}
                  </div>

                  {configuration && (configuration.selectedOptions?.length > 0 || Object.keys(configuration.values || {}).length > 0) && (
                    <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60 mb-3">Configuration</p>
                      <div className="space-y-2">
                        {configuration.selectedOptions?.map((opt: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-start gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{opt.groupName}:</span>
                            <span className="text-xs font-mono text-foreground text-right">{opt.optionName}</span>
                          </div>
                        ))}
                        {Object.entries(configuration.values || {}).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-start gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{key}:</span>
                            <span className="text-xs font-mono text-foreground text-right">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-primary/15 bg-[#09111b]/80 p-4">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Estimate</p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Base Product</span>
                        <span>{formatCurrency(productPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Subtotal excl. GST</span>
                        <span>{formatCurrency(combinedSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>GST</span>
                        <span>{formatCurrency(combinedGst)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-primary/15 pt-3 font-semibold text-foreground">
                        <span>Estimated Total</span>
                        <span className="text-primary">{formatCurrency(combinedTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-6 text-muted-foreground flex-1">
                    Estimates are based on the selected configuration and may change once final scope and delivery are confirmed. Your request will be synchronised directly to the Desktop app orders queue.
                  </p>

                  <div className="mt-5 flex gap-3">
                    <Button
                      onClick={handleSubmit}
                      className="flex-1 font-mono uppercase tracking-widest text-xs h-10"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="font-mono uppercase tracking-widest text-xs border-primary/30 h-10"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
