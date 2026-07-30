import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Phone, ReceiptText, Mail, User, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import mainLogo from "@assets/Logo_-_Main_Logo_1782352742134.png";
import { ParticleBackground } from "@/components/ParticleBackground";
import { BrandOrbs } from "@/components/BrandOrbs";
import { SmokeEffect } from "@/components/SmokeEffect";
import { buildApiUrl } from "@/lib/api-base";
import { useListProducts, useGetCurrentMember } from "@workspace/api-client-react";

interface ProductCard {
  id: number;
  name: string;
  description: string | null;
  price: number;
  type: "product" | "service";
  available: boolean;
  shippingPresets?: { label: string; price: number }[];
}

const getProductShippingPresets = (product: ProductCard) => {
  if (product.shippingPresets && Array.isArray(product.shippingPresets)) {
    return product.shippingPresets;
  }
  
  if (product.type === "product") {
    if (product.name.toLowerCase().includes("custom") || product.name.toLowerCase().includes("special")) {
      return [{ label: "Flat Rate Shipping", price: 15.00 }];
    }
    return [
      { label: "Local Pickup (Auckland)", price: 0 },
      { label: "Standard Shipping (North Island)", price: 18.00 },
      { label: "Standard Shipping (South Island)", price: 32.00 },
      { label: "Rural Delivery", price: 45.00 }
    ];
  }
  return [];
};

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

export default function RequestQuote() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: productsData, isLoading: loadingProducts } = useListProducts();
  const { data: member } = useGetCurrentMember();

  const [product, setProduct] = useState<ProductCard | null>(null);
  const [shippingPresets, setShippingPresets] = useState<{ label: string; price: number }[]>([]);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState<number>(0);

  // Form Fields
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

  // Parse product ID from URL
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const productId = Number(query.get("productId") || "0");
    
    if (productsData && productId) {
      const found = (productsData as any[]).find((p) => Number(p.id ?? p.productId) === productId);
      if (found) {
        const normalized: ProductCard = {
          id: Number(found.id ?? found.productId),
          name: String(found.name ?? found.title ?? "Product"),
          description: found.description ?? "",
          price: Number(found.price ?? 0),
          type: found.type === "service" ? "service" : "product",
          available: found.available !== false,
          shippingPresets: found.shippingPresets
        };
        setProduct(normalized);
        const presets = getProductShippingPresets(normalized);
        setShippingPresets(presets);
        setSelectedShippingIndex(0);
      }
    }
  }, [productsData]);

  // Autofill member details if logged in
  useEffect(() => {
    if (member) {
      setFullName(member.name || "");
      setEmail(member.email || "");
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      setLocation("/");
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

  const selectedPreset = null;
  const productPrice = product?.price ?? 0;
  const shippingFee = 0;
  const combinedSubtotal = productPrice / 1.15;
  const combinedGst = productPrice - combinedSubtotal;
  const combinedTotal = productPrice;

  if (loadingProducts) {
    return (
      <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground flex items-center justify-center font-mono">
        <ParticleBackground />
        <p className="text-primary animate-pulse tracking-widest uppercase text-sm">Loading request form...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
        <ParticleBackground />
        <BrandOrbs />
        <SmokeEffect />
        <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-primary/20 bg-[#080d14]/95 p-8 text-center shadow-[0_0_60px_rgba(26,157,224,0.18)]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">Quote Request</p>
            <h1 className="mt-4 font-mono text-2xl font-bold uppercase tracking-[0.14em] text-primary">
              Product Not Found
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Please go back to the homepage and select a product to request a quote.
            </p>
            <Button onClick={() => setLocation("/")} className="mt-6 font-mono uppercase tracking-widest text-xs">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground />
      <BrandOrbs />
      <SmokeEffect />

      <div className="relative z-10 min-h-[100dvh] p-4 sm:p-6 lg:p-10 flex flex-col">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 pb-6 shrink-0">
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-[#080d14]/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(26,157,224,0.4)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <img src={mainLogo} alt="A Woman With a Welder" className="h-12 w-auto opacity-90 drop-shadow-[0_0_12px_rgba(26,157,224,0.3)]" />
        </div>

        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.24fr_0.76fr] flex-1">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18)] sm:p-8 flex flex-col"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Quote Booking Details</p>
            <h1 className="mt-2 font-mono text-2xl sm:text-3xl font-bold uppercase tracking-[0.12em] text-primary">
              Request Shipping & Mods
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Submit your details to request custom configurations, shipping calculations, and options. The Woman with A Welder will get back to you as soon she is able too. If you don't hear back from her in the next 24 Hours - flick us an email at <a href="mailto:charlotte@awomanwithawelder.co.nz" className="text-primary font-semibold underline hover:text-primary/80">charlotte@awomanwithawelder.co.nz</a> it may have just got lost somewhere.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5 flex-1">
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
                  Notes / Requests / Custom Modifications
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify any desired changes, dimension mods, custom coatings, or structural requests..."
                  rows={4}
                  className="bg-primary/5 border-primary/20 focus:border-primary/50 resize-none font-mono text-sm"
                />
              </div>

              <div className="pt-3 flex gap-3 sm:hidden">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 font-mono uppercase tracking-widest text-xs h-11"
                >
                  {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                </Button>
              </div>
            </form>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18)]">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Selected Product</p>
                </div>
                <div className="mt-4">
                  <p className="text-lg font-bold text-foreground leading-snug">{product.name}</p>
                  {product.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">{product.description}</p>
                  )}
                  <p className="mt-3 font-mono text-primary font-bold text-base">
                    Base: {formatCurrency(product.price)}
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
            </div>

            <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18)] hidden sm:block">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full font-mono uppercase tracking-widest text-xs h-11 bg-primary hover:bg-primary/80"
              >
                {isSubmitting ? "Submitting..." : "Submit Quote Request"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
                Your request will be synchronised directly to the Desktop app orders queue.
              </p>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
