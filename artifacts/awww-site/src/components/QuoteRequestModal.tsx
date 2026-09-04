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

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: QuoteRequestProduct | null;
}

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

export function QuoteRequestModal({ isOpen, onClose, product }: QuoteRequestModalProps) {
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.2em]">
                    <FileText className="h-3 w-3" />
                    <span>Quote Request</span>
                  </div>
                  <h3 className="font-mono text-base sm:text-lg font-bold uppercase tracking-[0.12em] text-primary">
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

                  <div className="pt-3 lg:hidden">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full font-mono uppercase tracking-widest text-xs h-11 bg-primary hover:bg-primary/80"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                    </Button>
                  </div>
                </form>

                {/* Right Side - Context */}
                <div className="space-y-6 bg-[#0a0a0f]/50 p-6 lg:border-l lg:border-primary/10">
                  <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18)]">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Quote Request For</p>
                    </div>
                    <div className="mt-4">
                      {product.image && (
                        <div 
                          className="w-full h-32 rounded-xl mb-4 bg-center bg-cover bg-no-repeat border border-primary/20" 
                          style={{ backgroundImage: `url(${product.image})` }} 
                        />
                      )}
                      <p className="text-lg font-bold text-foreground leading-snug">{product.name}</p>
                      {product.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">{product.description}</p>
                      )}
                      <p className="mt-3 font-mono text-primary font-bold text-base">
                        Base: {formatCurrency(productPrice)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18)]">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Estimate Breakdown</p>
                    </div>
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Base Product</span>
                        <span>{formatCurrency(productPrice)}</span>
                      </div>

                      <div className="flex items-center justify-between text-muted-foreground border-t border-primary/10 pt-3">
                        <span>Subtotal excl. GST</span>
                        <span>{formatCurrency(combinedSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>GST (15%)</span>
                        <span>{formatCurrency(combinedGst)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-primary/15 pt-3 font-semibold text-foreground text-sm">
                        <span>Estimated total</span>
                        <span className="text-primary">{formatCurrency(combinedTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full font-mono uppercase tracking-widest text-xs h-11 bg-primary hover:bg-primary/80 shadow-[0_0_20px_rgba(26,157,224,0.3)]"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
                      Your request will be synchronised directly to the Desktop app orders queue.
                    </p>
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
