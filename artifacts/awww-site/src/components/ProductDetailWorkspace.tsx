import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  // Raw product for nested payload access
  const rawProduct = product as any;

  // --- STATE ---
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Configurable State: record of groupId -> selected optionIds
  const [configSelections, setConfigSelections] = useState<Record<string, string[]>>({});
  
  // Parametric State: record of input name -> value
  const [parametricValues, setParametricValues] = useState<Record<string, any>>({});

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
    onRequestQuote({ product, options: configurationPayload });
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
          {product.type === "parametric" && (rawProduct.inputDefinitions || rawProduct.product?.inputDefinitions)?.map((def: any) => (
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

    </motion.div>
  );
}
