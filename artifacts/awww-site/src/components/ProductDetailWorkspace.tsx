import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, Send, CheckCircle2, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/lib/api-base';
import { QuoteRequestModal } from './QuoteRequestModal';

type ProductCard = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  type: 'product' | 'service' | 'configurable' | 'parametric';
  available: boolean;
  image?: string | null;
};

const GST_RATE = 0.15;

function getPricingBreakdown(price: number) {
  const subtotal = Number((price / (1 + GST_RATE)).toFixed(2));
  const gst = Number((price - subtotal).toFixed(2));
  const total = Number(price.toFixed(2));
  return { subtotal, gst, total };
}

function getInputKey(definition: any): string {
  return String(definition?.key ?? definition?.name ?? definition?.id ?? '').trim();
}

function getInputControlType(definition: any): 'slider' | 'number' | 'dropdown' | 'choice' | 'checkbox' | 'text' {
  const authored = String(definition?.controlType ?? '').trim().toLowerCase();
  if (authored === 'slider' || authored === 'number' || authored === 'dropdown' || authored === 'choice' || authored === 'checkbox') {
    return authored;
  }
  const legacy = String(definition?.inputType ?? definition?.type ?? '').trim().toLowerCase();
  if (legacy === 'discrete' || legacy === 'select' || legacy === 'dropdown') return 'dropdown';
  if (legacy === 'boolean' || legacy === 'checkbox') return 'checkbox';
  if (legacy === 'number' && definition?.min !== undefined && definition?.max !== undefined) return 'slider';
  if (legacy === 'number') return 'number';
  return 'text';
}

function getInputChoices(definition: any): any[] {
  if (Array.isArray(definition?.choices)) return definition.choices;
  if (Array.isArray(definition?.discreteChoices)) return definition.discreteChoices;
  return [];
}

function getInputMinimum(definition: any): number | undefined {
  const value = definition?.minimum ?? definition?.min;
  return value === undefined || value === null || value === '' ? undefined : Number(value);
}

function getInputMaximum(definition: any): number | undefined {
  const value = definition?.maximum ?? definition?.max;
  return value === undefined || value === null || value === '' ? undefined : Number(value);
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
  const purchaseModes = Array.isArray(rawProduct.purchaseModes) ? rawProduct.purchaseModes : [];
  const configurableMode = purchaseModes.find((mode: any) => (mode?.purchaseMode ?? mode?.mode) === 'configurable');
  const parametricMode = purchaseModes.find((mode: any) => (mode?.purchaseMode ?? mode?.mode) === 'parametric');
  const optionGroups = configurableMode?.optionGroups || rawProduct.optionGroups || rawProduct.stockProduct?.optionGroups || [];
  const inputDefinitions = parametricMode?.inputDefinitions || rawProduct.inputDefinitions || rawProduct.product?.inputDefinitions || [];
  const hasCustomization = product.type === "configurable" || product.type === "parametric" || Boolean(configurableMode || parametricMode);
  const isStockProduct = product.type === "product";
  const hasNestedCustomization = optionGroups.length > 0 || inputDefinitions.length > 0;
  
  // If it's explicitly configurable/parametric natively, show immediately. 
  // If it's a Stock product that HAS customization, hide behind "Customize Me!"
  const initialShowCustomizer = hasCustomization && !isStockProduct;
  const [showCustomizer, setShowCustomizer] = useState(initialShowCustomizer);

  // --- QUOTE STATE ---
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // --- INITIALIZE CONFIG DEFAULTS ---
  useEffect(() => {
    const defaults: Record<string, string[]> = {};
    const authoredDefaults = configurableMode?.defaultSelections || configurableMode?.defaultConfiguration?.selections || rawProduct.defaultConfiguration?.selections;

    if (authoredDefaults) {
      Object.assign(defaults, authoredDefaults);
    } else {
      optionGroups.forEach((group: any) => {
        const defaultOptions = group.options?.filter((o: any) => o.isDefault) || [];
        if (defaultOptions.length > 0) {
          defaults[group.id] = defaultOptions.map((o: any) => String(o.id));
        } else {
          defaults[group.id] = [];
        }
      });
    }
    setConfigSelections(defaults);
  }, [product]);

  // --- INITIALIZE PARAMETRIC DEFAULTS ---
  useEffect(() => {
    const defaults: Record<string, any> = {};
    
    inputDefinitions.forEach((def: any) => {
      const key = getInputKey(def);
      if (!key) return;
      const controlType = getInputControlType(def);
      const defaultChoice = getInputChoices(def).find((choice: any) => choice?.isDefault === true);
      if (def.defaultValue !== undefined) defaults[key] = def.defaultValue;
      else if (defaultChoice) defaults[key] = defaultChoice.value;
      else if (controlType === 'checkbox') defaults[key] = false;
    });
    setParametricValues(defaults);
  }, [product]);

  // --- IMAGE GALLERY RESOLUTION ---
  const galleryImages = useMemo(() => {
    const pushUnique = (target: string[], value: unknown) => {
      const normalized = String(value ?? '').trim();
      if (!normalized || target.includes(normalized)) return;
      target.push(normalized);
    };
    const collectOptionImages = (option: any) => {
      const authored = Array.isArray(option?.images)
        ? option.images.map((entry: unknown) => String(entry ?? '').trim()).filter(Boolean)
        : [];
      if (authored.length > 0) return authored;
      const fallback = String(option?.imageUrl || option?.image || option?.media || '').trim();
      return fallback ? [fallback] : [];
    };

    const baseImages: string[] = [];
    pushUnique(baseImages, product.image);
    (rawProduct.stockProduct?.images || rawProduct.images || []).forEach((img: unknown) => pushUnique(baseImages, img));
    (rawProduct.product?.images || []).forEach((img: unknown) => pushUnique(baseImages, img));

    if (optionGroups.length > 0) {
      const selectedGallery: string[] = [];
      optionGroups.forEach((group: any) => {
        const selected = configSelections[group.id] || [];
        selected.forEach((optId) => {
          const opt = group.options?.find((candidate: any) => String(candidate.id) === String(optId));
          collectOptionImages(opt).forEach((image: string) => pushUnique(selectedGallery, image));
        });
      });
      if (selectedGallery.length > 0) {
        return selectedGallery;
      }
    }

    if (inputDefinitions.length > 0) {
      const selectedGallery: string[] = [];
      inputDefinitions.forEach((def: any) => {
        const choices = getInputChoices(def);
        if (choices.length === 0) return;
        const selectedValue = parametricValues[getInputKey(def)];
        const choice = choices.find((candidate: any) => candidate.value === selectedValue);
        const choiceImages = Array.isArray(choice?.images)
          ? choice.images.map((entry: unknown) => String(entry ?? '').trim()).filter(Boolean)
          : [];
        const fallback = String(choice?.imageUrl || choice?.image || '').trim();
        const nextImages = choiceImages.length > 0 ? choiceImages : (fallback ? [fallback] : []);
        nextImages.forEach((image: string) => pushUnique(selectedGallery, image));
      });
      if (selectedGallery.length > 0) {
        return selectedGallery;
      }
    }

    return baseImages;
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
    
    if (optionGroups.length > 0) {
      const selectedIds: string[] = [];
      const details: any[] = [];
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
    
    if (inputDefinitions.length > 0) {
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
  const isBackorder = rawProduct.fulfillmentMode === 'backorder';
  const customerMessage = String(rawProduct.customerMessage || '').trim();

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
          {galleryImages.length > 0 ? (
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
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(26,157,224,0.04) 8px, rgba(26,157,224,0.04) 10px)",
                }}
              />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary/40 z-10 text-center px-4 leading-relaxed">
                Placeholder<br/>Owner Photography Required
              </span>
            </>
          )}

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
                <span className={`text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-full border ${isAvailable ? 'text-cyan-100 border-cyan-400/30 bg-cyan-500/10' : 'text-red-300 border-red-400/40 bg-red-500/10'}`}>
                  {isAvailable ? 'AVAILABLE NOW' : 'OUT OF STOCK'}
                </span>
             </div>
             <p className="text-[#94a3b8] text-sm leading-relaxed mt-2" dangerouslySetInnerHTML={{ __html: product.description || "" }} />
             {customerMessage && (
               <p className="font-mono text-xs text-cyan-100/70 leading-relaxed">{customerMessage}</p>
             )}
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
              {optionGroups.map((group: any) => (
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
              {inputDefinitions.map((def: any) => {
                const inputKey = getInputKey(def);
                const controlType = getInputControlType(def);
                const minimum = getInputMinimum(def);
                const maximum = getInputMaximum(def);
                const choices = getInputChoices(def);
                const unit = def.unit || def.units || '';
                return (
                <div key={inputKey} className="flex flex-col gap-3">
                   <h4 className="font-mono text-xs uppercase tracking-widest text-primary/80">{def.label || inputKey}</h4>

                   {controlType === 'slider' && minimum !== undefined && maximum !== undefined && (
                      <div className="flex flex-col gap-2 p-4 border border-primary/20 rounded-lg bg-[#0d1520]/50">
                         <div className="flex justify-between items-center font-mono text-[10px] text-primary/60">
                           <span>{minimum} {unit}</span>
                           <span className="text-primary font-bold text-xs">{parametricValues[inputKey] ?? minimum} {unit}</span>
                           <span>{maximum} {unit}</span>
                         </div>
                         <input 
                           type="range"
                           min={minimum}
                           max={maximum}
                           step={def.step || 1}
                           value={parametricValues[inputKey] ?? minimum}
                           onChange={(e) => handleParametricChange(inputKey, Number(e.target.value))}
                           className="w-full accent-primary h-1.5 bg-primary/20 rounded-lg appearance-none cursor-pointer"
                         />
                      </div>
                   )}

                   {controlType === 'number' && (
                     <Input
                       type="number"
                       min={minimum}
                       max={maximum}
                       step={def.step || 1}
                       value={parametricValues[inputKey] ?? ''}
                       onChange={(event) => handleParametricChange(inputKey, event.target.value === '' ? undefined : Number(event.target.value))}
                       className="bg-black/30 border-primary/20 text-white"
                     />
                   )}

                   {controlType === 'dropdown' && (
                     <select
                       value={parametricValues[inputKey] ?? ''}
                       onChange={(event) => handleParametricChange(inputKey, event.target.value)}
                       className="h-10 rounded-md border border-primary/20 bg-black/30 px-3 font-mono text-xs text-white"
                     >
                       <option value="">Choose an option</option>
                       {choices.map((choice: any) => <option key={choice.id ?? choice.value} value={choice.value}>{choice.label || choice.value}</option>)}
                     </select>
                   )}

                   {controlType === 'choice' && choices.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {choices.map((choice: any) => {
                           const isSelected = parametricValues[inputKey] === choice.value;
                           return (
                             <button
                               key={choice.id ?? choice.value}
                               onClick={() => handleParametricChange(inputKey, choice.value)}
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

                   {controlType === 'checkbox' && (
                      <label className="flex items-center gap-3 cursor-pointer p-3 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
                         <input 
                           type="checkbox"
                           checked={parametricValues[inputKey] || false}
                           onChange={(e) => handleParametricChange(inputKey, e.target.checked)}
                           className="w-4 h-4 accent-primary rounded border-primary/30"
                         />
                         <span className="font-mono text-xs text-muted-foreground">Enable {def.label || inputKey}</span>
                      </label>
                   )}

                   {controlType === 'text' && (
                     <Input
                       value={parametricValues[inputKey] ?? ''}
                       onChange={(event) => handleParametricChange(inputKey, event.target.value)}
                       className="bg-black/30 border-primary/20 text-white"
                     />
                   )}
                </div>
              );})}
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

    <QuoteRequestModal 
      isOpen={isQuoteModalOpen} 
      onClose={() => setIsQuoteModalOpen(false)} 
      product={{ 
        id: product.id, 
        name: product.name, 
        description: product.description || null, 
        price: pricing.total, 
        image: galleryImages[currentImageIndex] || null 
      }} 
    />

    </motion.div>
  );
}
