import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, Send, CheckCircle2, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/lib/api-base';
import { ProductCard } from '@hooks/useGetProducts';

const GST_RATE = 0.15;

function getPricingBreakdown(price: number) {
  const subtotal = Number((price / (1 + GST_RATE)).toFixed(2));
  const gst = Number((price - subtotal).toFixed(2));
  const total = Number(price.toFixed(2));
  return { subtotal, gst, total };
}

interface ProductDetailWorkspaceProps {
  product: ProductCard;
  onClose: () => void;
  onAddToCart: (payload: any) => void;
  onRequestQuote: (payload: any) => void;
}

export function ProductDetailWorkspace({ product, onClose, onAddToCart, onRequestQuote }: ProductDetailWorkspaceProps) {
  const { toast } = useToast();
  
  // Raw product for nested payload access
  const rawProduct = product as any;

  // --- STATE ---
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Configurable State: record of groupId -> selected optionIds
  const [configSelections, setConfigSelections] = useState<Record<string, string[]>>({});
  
  // Parametric State: record of input name -> value
  const [parametricValues, setParametricValues] = useState<Record<string, any>>({});

  // --- STOREFRONT PRODUCT MODEL STATE ---
  const hasCustomization = product.type === "configurable" || product.type === "parametric";
  const isStockProduct = product.type === "product";
  const hasNestedCustomization = (rawProduct.stockProduct?.optionGroups?.length > 0) || (rawProduct.inputDefinitions?.length > 0) || (rawProduct.product?.inputDefinitions?.length > 0);
  
  // If it's explicitly configurable/parametric natively, show immediately. 
  // If it's a Stock product that HAS customization, hide behind "Customize Me!"
  const initialShowCustomizer = hasCustomization && !isStockProduct;
  const [showCustomizer, setShowCustomizer] = useState(initialShowCustomizer);

  // --- QUOTE STATE ---
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ fullName: "", email: "", phone: "", streetAddress: "", townCity: "", region: "", postcode: "", notes: "" });

  // --- INITIALIZE CONFIG DEFAULTS ---
  useEffect(() => {
    if (product.type !== "configurable") return;
    
    const defaults: Record<string, string[]> = {};
    const optionGroups = rawProduct.optionGroups || rawProduct.stockProduct?.optionGroups || [];
    
    if (rawProduct.defaultConfiguration?.selections) {
      Object.assign(defaults, rawProduct.defaultConfiguration.selections);
    } else {
      optionGroups.forEach((group: any) => {
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
    setConfigSelections(defaults);
  }, [product]);

  // --- INITIALIZE PARAMETRIC DEFAULTS ---
  useEffect(() => {
    if (product.type !== "parametric") return;
    
    const inputDefinitions = rawProduct.inputDefinitions || rawProduct.product?.inputDefinitions || [];
    const defaults: Record<string, any> = {};
    
    inputDefinitions.forEach((def: any) => {
      if (def.type === "number" && def.min !== undefined) {
        defaults[def.name] = def.min; // Set to minimum by default if numeric
      } else if (def.type === "discrete" && def.discreteChoices?.length > 0) {
        defaults[def.name] = def.discreteChoices[0].value;
      } else if (def.type === "boolean") {
        defaults[def.name] = false;
      }
    });
    setParametricValues(defaults);
  }, [product]);

  // --- IMAGE GALLERY RESOLUTION ---
  const galleryImages = useMemo(() => {
    const images: string[] = [];
    if (product.image) images.push(product.image);
    
    // Add additional images from nested payloads if available
    if (product.type === "configurable") {
      // Base config images
      const baseImages = rawProduct.stockProduct?.images || rawProduct.images || [];
      baseImages.forEach((img: string) => {
        if (!images.includes(img)) images.push(img);
      });
      
      // Look for selected option images
      const optionGroups = rawProduct.optionGroups || rawProduct.stockProduct?.optionGroups || [];
      optionGroups.forEach((group: any) => {
        const selected = configSelections[group.id] || [];
        selected.forEach((optId) => {
          const opt = group.options?.find((o: any) => String(o.id) === optId);
          if (opt?.image && !images.includes(opt.image)) {
            images.unshift(opt.image); // Option images take precedence (put at front)
          }
        });
      });
    }
    
    if (product.type === "parametric") {
      const baseImages = rawProduct.product?.images || rawProduct.images || [];
      baseImages.forEach((img: string) => {
        if (!images.includes(img)) images.push(img);
      });
      
      // Look for selected discrete choice images
      const inputDefinitions = rawProduct.inputDefinitions || rawProduct.product?.inputDefinitions || [];
      inputDefinitions.forEach((def: any) => {
        if (def.type === "discrete" && def.discreteChoices) {
          const selectedValue = parametricValues[def.name];
          const choice = def.discreteChoices.find((c: any) => c.value === selectedValue);
          if (choice?.image && !images.includes(choice.image)) {
            images.unshift(choice.image); // Put at front
          }
        }
      });
    }

    return images.length > 0 ? images : ['/placeholder-image.png'];
  }, [product, configSelections, parametricValues]);

  // When selected images change, clamp index
  useEffect(() => {
    if (currentImageIndex >= galleryImages.length) {
      setCurrentImageIndex(0);
    }
  }, [galleryImages.length]);

  const activeImage = galleryImages[currentImageIndex];

  // --- PRICING CALCULATION ---
  const { activePrice, configurationPayload } = useMemo(() => {
    let basePrice = Number(product.price || rawProduct.sellPrice || rawProduct.basePrice || 0);
    let adjustment = 0;
    
    const payload: any = {};
    
    if (product.type === "configurable") {
      const selectedIds: string[] = [];
      const details: any[] = [];
      const optionGroups = rawProduct.optionGroups || rawProduct.stockProduct?.optionGroups || [];
      
      optionGroups.forEach((group: any) => {
        const selected = configSelections[group.id] || [];
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
      payload.selections = configSelections;
      payload.selectedOptionIds = selectedIds;
      payload.selectedOptions = details;
      payload.totalPriceAdjustment = adjustment;
    }
    
    if (product.type === "parametric") {
       // Assuming param calculation is primarily done on backend, but we can send values
       payload.values = parametricValues;
    }

    return { 
      activePrice: basePrice + adjustment,
      configurationPayload: payload
    };
  }, [product, configSelections, parametricValues]);

  const pricing = getPricingBreakdown(activePrice);
  const isAvailable = product.available;

  // --- HANDLers ---
  const handleNextImage = () => setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  const handlePrevImage = () => setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);

  const handleConfigToggle = (group: any, optionId: string) => {
    setConfigSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.selectionType !== "multiple") {
        if (current.includes(optionId) && !group.required) return { ...prev, [group.id]: [] };
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId) && group.required && current.length === 1) return prev;
      const updated = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [group.id]: updated };
    });
  };

  const handleParametricChange = (name: string, value: any) => {
    setParametricValues(prev => ({ ...prev, [name]: value }));
  };

  const handleAddToCart = () => {
    onAddToCart({ product, options: configurationPayload });
  };

  const handleRequestQuote = () => {
    setIsQuoteModalOpen(true);
  };

  const resetQuoteForm = () => {
    setIsQuoteModalOpen(false);
    setIsSubmitted(false);
    setIsSubmitting(false);
    setQuoteForm({ fullName: "", email: "", phone: "", streetAddress: "", townCity: "", region: "", postcode: "", notes: "" });
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

    setIsSubmitting(true);

    try {
      const response = await fetch(buildApiUrl("/api/quote-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "quote-request",
          productId: product.id,
          configurableProductId: product.id,
          quantity: 1,
          fullName: quoteForm.fullName,
          email: quoteForm.email,
          phone: quoteForm.phone,
          address1: quoteForm.streetAddress,
          city: quoteForm.townCity,
          suburb: quoteForm.region,
          zipCode: quoteForm.postcode,
          notes: quoteForm.notes,
          selections: configSelections,
          values: parametricValues,
          configuration: configurationPayload
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative w-full h-[95dvh] sm:h-[90dvh] max-h-[850px] max-w-[95vw] sm:max-w-xl md:max-w-2xl bg-[#080d14]/95 border-2 border-primary/40 rounded-3xl shadow-[0_0_60px_rgba(26,157,224,0.35)] flex flex-col backdrop-blur-3xl overflow-hidden pointer-events-auto"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-primary/20 bg-[#0d1520]/80">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-primary hover:bg-primary/20 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-mono text-sm sm:text-base tracking-widest uppercase text-primary font-semibold flex-1 text-center truncate px-4">
          {product.name}
        </h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto scroll-industrial flex flex-col">
        
        {/* Top: Image Gallery */}
        <div className="relative w-full min-h-[250px] sm:min-h-[350px] bg-black/40 flex items-center justify-center group overflow-hidden shrink-0 border-b border-primary/10">
          <AnimatePresence mode="wait">
            <motion.img
              key={activeImage}
              src={activeImage}
              alt={product.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>

          {galleryImages.length > 1 && (
            <>
              <Button variant="ghost" size="icon" onClick={handlePrevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-primary hover:bg-black/80 hover:text-primary transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md z-10">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-primary hover:bg-black/80 hover:text-primary transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md z-10">
                <ChevronRight className="h-6 w-6" />
              </Button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                {galleryImages.map((_, idx) => (
                  <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`rounded-full transition-all ${idx === currentImageIndex ? "w-5 h-2 bg-primary shadow-[0_0_8px_rgba(26,157,224,0.8)]" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Middle: Info & Configuration */}
        <div className="p-6 flex flex-col gap-6">
          
          <div className="flex flex-col gap-2 border-b border-primary/10 pb-4">
             <div className="flex items-center justify-between">
                <span className="font-mono text-xl sm:text-2xl text-[#f8fafc] font-medium tracking-tight">
                  NZ${activePrice.toFixed(2)}
                </span>
                <span className={`text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-full border ${isAvailable ? 'text-primary border-primary bg-primary/10' : 'text-red-400 border-red-400/50 bg-red-400/10'}`}>
                  {isAvailable ? 'AVAILABLE NOW' : 'OUT OF STOCK'}
                </span>
             </div>
             <p className="text-[#94a3b8] text-sm leading-relaxed mt-2" dangerouslySetInnerHTML={{ __html: product.description || "" }} />
          </div>

          {/* Customize Me Button for Stock Products */}
          {!showCustomizer && hasNestedCustomization && (
             <div className="flex justify-center pt-4">
               <Button
                 onClick={() => setShowCustomizer(true)}
                 className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary/60 px-8 py-6 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_30px_rgba(26,157,224,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(26,157,224,0.5)]"
               >
                 <span className="relative z-10 flex items-center gap-2">
                   <Settings2 className="h-5 w-5 animate-spin-slow" />
                   Customize Me!
                 </span>
                 <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />
               </Button>
             </div>
          )}

          {showCustomizer && (
            <>
              {/* Configurable Product Controls */}
              {product.type === "configurable" && (rawProduct.optionGroups || rawProduct.stockProduct?.optionGroups)?.map((group: any) => (
                <div key={group.id} className="flex flex-col gap-3">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-primary/80">{group.name} {group.required && '*'}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options?.map((opt: any) => {
                      const isSelected = (configSelections[group.id] || []).includes(String(opt.id));
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleConfigToggle(group, String(opt.id))}
                          className={`text-left p-3 rounded-lg border font-mono text-xs transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(26,157,224,0.2)]"
                              : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate pr-2">{opt.label || opt.name}</span>
                            {Number(opt.priceAdjustment || opt.price || 0) > 0 && (
                              <span className="shrink-0 text-[10px]">+${Number(opt.priceAdjustment || opt.price).toFixed(2)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Parametric Product Controls */}
              {(product.type === "parametric" || hasNestedCustomization) && (rawProduct.inputDefinitions || rawProduct.product?.inputDefinitions)?.map((def: any) => (
                <div key={def.name} className="flex flex-col gap-3">
                   <h4 className="font-mono text-xs uppercase tracking-widest text-primary/80">{def.label || def.name}</h4>
                   
                   {def.type === "number" && def.min !== undefined && def.max !== undefined && (
                      <div className="flex flex-col gap-2 p-4 border border-primary/20 rounded-lg bg-[#0d1520]/50">
                         <div className="flex justify-between items-center font-mono text-[10px] text-primary/60">
                           <span>{def.min} {def.units}</span>
                           <span className="text-primary font-bold text-xs">{parametricValues[def.name]} {def.units}</span>
                           <span>{def.max} {def.units}</span>
                         </div>
                         <input 
                           type="range"
                           min={def.min}
                           max={def.max}
                           step={def.step || 1}
                           value={parametricValues[def.name] || def.min}
                           onChange={(e) => handleParametricChange(def.name, Number(e.target.value))}
                           className="w-full accent-primary h-1.5 bg-primary/20 rounded-lg appearance-none cursor-pointer"
                         />
                      </div>
                   )}

                   {def.type === "discrete" && def.discreteChoices && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {def.discreteChoices.map((choice: any) => {
                           const isSelected = parametricValues[def.name] === choice.value;
                           return (
                             <button
                               key={choice.value}
                               onClick={() => handleParametricChange(def.name, choice.value)}
                               className={`text-left p-3 rounded-lg border font-mono text-xs transition-all ${
                                 isSelected
                                   ? "border-primary bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(26,157,224,0.2)]"
                                   : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                               }`}
                             >
                               <div className="flex justify-between items-center">
                                 <span className="truncate">{choice.label || choice.value}</span>
                                 {Number(choice.priceAdjustment || 0) > 0 && (
                                   <span className="shrink-0 text-[10px]">+${Number(choice.priceAdjustment).toFixed(2)}</span>
                                 )}
                               </div>
                             </button>
                           );
                        })}
                      </div>
                   )}

                   {def.type === "boolean" && (
                      <label className="flex items-center gap-3 cursor-pointer p-3 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
                         <input 
                           type="checkbox"
                           checked={parametricValues[def.name] || false}
                           onChange={(e) => handleParametricChange(def.name, e.target.checked)}
                           className="w-4 h-4 accent-primary rounded border-primary/30"
                         />
                         <span className="font-mono text-xs text-muted-foreground">Enable {def.label || def.name}</span>
                      </label>
                   )}
                </div>
              ))}
            </>
          )}

        </div>
      </div>

      {/* Bottom: Action Area */}
      <div className="shrink-0 bg-[#0d1520] border-t border-primary/20 p-5 flex flex-col gap-3 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <div className="flex justify-between items-center px-1">
           <span className="text-muted-foreground text-xs uppercase tracking-widest font-mono">Total (inc. GST)</span>
           <span className="text-white font-mono text-lg font-medium tracking-tight">NZ${pricing.total.toFixed(2)}</span>
         </div>
         <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-mono uppercase tracking-widest text-xs h-11"
              onClick={handleAddToCart}
              disabled={!isAvailable}
            >
              Add to Cart
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-primary/40 text-primary hover:bg-primary/10 font-mono uppercase tracking-widest text-xs h-11"
              onClick={handleRequestQuote}
            >
              Request Quote for Shipping
            </Button>
         </div>
      </div>

    {/* Quote Modal */}
    <AnimatePresence>
      {isQuoteModalOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsQuoteModalOpen(false)} />
          
          <motion.div
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            className="relative w-full max-w-xl bg-[#080d14] border border-primary/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary/20 bg-[#0d1520]/80">
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Send className="w-4 h-4" /> Request Quote
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsQuoteModalOpen(false)} className="h-8 w-8 rounded-full text-primary hover:text-white hover:bg-primary/20">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="overflow-y-auto p-5 scroll-industrial">
              {isSubmitted ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Quote Request Sent!</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    Thank you for your interest. Our team will review your configuration and contact you shortly.
                  </p>
                  <Button onClick={resetQuoteForm} className="bg-primary text-black hover:bg-primary/90 font-mono uppercase tracking-widest text-xs h-10 px-8">
                    Close &amp; Return
                  </Button>
                </div>
              ) : (
                <form id="quote-form" onSubmit={handleSubmitQuote} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Full Name *</label>
                      <Input required value={quoteForm.fullName} onChange={e => setQuoteForm({...quoteForm, fullName: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Phone *</label>
                      <Input required type="tel" value={quoteForm.phone} onChange={e => setQuoteForm({...quoteForm, phone: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Email Address *</label>
                      <Input required type="email" value={quoteForm.email} onChange={e => setQuoteForm({...quoteForm, email: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                    </div>
                    
                    <div className="space-y-1.5 sm:col-span-2 border-t border-primary/20 pt-4 mt-2">
                      <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Delivery Address (Optional)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                         <Input placeholder="Street Address" value={quoteForm.streetAddress} onChange={e => setQuoteForm({...quoteForm, streetAddress: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                         <Input placeholder="City / Town" value={quoteForm.townCity} onChange={e => setQuoteForm({...quoteForm, townCity: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                         <Input placeholder="Region / Suburb" value={quoteForm.region} onChange={e => setQuoteForm({...quoteForm, region: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                         <Input placeholder="Postcode" value={quoteForm.postcode} onChange={e => setQuoteForm({...quoteForm, postcode: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm h-10 font-mono" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Additional Notes</label>
                    <Textarea value={quoteForm.notes} onChange={e => setQuoteForm({...quoteForm, notes: e.target.value})} className="bg-black/40 border-primary/30 focus:border-primary text-sm min-h-[80px] font-mono" placeholder="Any special requests or structural mods..." />
                  </div>
                </form>
              )}
            </div>

            {!isSubmitted && (
              <div className="px-5 py-4 border-t border-primary/20 bg-[#0d1520]/80 flex justify-end gap-3 shrink-0">
                <Button type="button" variant="ghost" onClick={() => setIsQuoteModalOpen(false)} className="text-primary hover:text-primary/80 font-mono text-xs uppercase tracking-widest h-10">Cancel</Button>
                <Button form="quote-form" type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-black font-mono text-xs uppercase tracking-widest h-10 px-6">
                  {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    </motion.div>
  );
}
