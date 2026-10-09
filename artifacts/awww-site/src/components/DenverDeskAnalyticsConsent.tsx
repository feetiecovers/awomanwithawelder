import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import denversDeskLogo from "@assets/Denvers_Desk_New_Chevron_Logo.png";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  initialiseDenverDeskAnalytics,
  trackDenverDeskEvent,
  isDenverDeskAnalyticsConfigured,
  type ConsentStatus,
} from "@/lib/denversDeskAnalytics";

export default function DenverDeskAnalyticsConsent() {
  const prefersReducedMotion = useReducedMotion();
  const [consent, setConsentState] = useState<ConsentStatus>(() => getAnalyticsConsent());
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number; angle: number; speed: number; color: string }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const configured = isDenverDeskAnalyticsConfigured();

  useEffect(() => {
    if (configured && consent === "granted") {
      initialiseDenverDeskAnalytics();
      void trackDenverDeskEvent("page_view");
    }
  }, [configured, consent]);

  useEffect(() => {
    // If analytics is configured and consent has not been decided yet, show popup
    if (configured && consent === null) {
      // Gentle delayed appearance for smooth UX
      const timer = setTimeout(() => setIsVisible(true), 600);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [configured, consent]);

  // Subtle background smoke & electrical particle canvas effect inside the glass panel
  useEffect(() => {
    if (!isVisible || prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      maxAlpha: number;
      hue: number;
      life: number;
      maxLife: number;
    }> = [];

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();

    const addParticle = () => {
      if (particles.length >= 24) return;
      const isPink = Math.random() < 0.22; // Subtle pink accents
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.2 + Math.random() * 0.4),
        size: 8 + Math.random() * 22,
        alpha: 0,
        maxAlpha: isPink ? 0.12 : 0.2,
        hue: isPink ? 330 : 198, // 330 = pink, 198 = electric blue
        life: 0,
        maxLife: 120 + Math.random() * 80,
      });
    };

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (frame % 8 === 0) addParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.08;

        const progress = p.life / p.maxLife;
        if (progress < 0.25) {
          p.alpha = (progress / 0.25) * p.maxAlpha;
        } else {
          p.alpha = (1 - (progress - 0.25) / 0.75) * p.maxAlpha;
        }

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        if (p.hue === 330) {
          grad.addColorStop(0, `rgba(244, 114, 182, ${p.alpha})`);
          grad.addColorStop(1, "rgba(244, 114, 182, 0)");
        } else {
          grad.addColorStop(0, `rgba(26, 157, 224, ${p.alpha})`);
          grad.addColorStop(1, "rgba(26, 157, 224, 0)");
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isVisible, prefersReducedMotion]);

  if (!configured || consent !== null) return null;

  const handleChoice = (status: 'granted' | 'denied') => {
    setAnalyticsConsent(status);
    setConsentState(status);
    setIsVisible(false);
  };

  const handleAllowClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsTriggering(true);

    // Create interactive spark burst particles around the button click position
    const rect = e.currentTarget.getBoundingClientRect();
    const newSparks = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      angle: (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      speed: 2 + Math.random() * 4,
      color: Math.random() < 0.25 ? '#f472b6' : '#38bdf8',
    }));
    setSparks(newSparks);

    setTimeout(() => {
      handleChoice('granted');
    }, 320);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ opacity: 0, y: 35, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 25, scale: 0.95 }}
          transition={{
            duration: prefersReducedMotion ? 0.15 : 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-[100] max-w-[560px] w-full mx-auto pointer-events-auto font-sans select-none"
          aria-label="Analytics privacy consent"
        >
          {/* External Glowing Ambient Halo & Electric Border Spark */}
          <div className="relative rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-r from-[#1a9de0]/50 via-pink-500/25 to-[#1a9de0]/50 shadow-[0_0_50px_rgba(26,157,224,0.3),_0_0_15px_rgba(244,114,182,0.15)] overflow-hidden">
            
            {/* Pulsing electric edge glow line */}
            {!prefersReducedMotion && (
              <motion.div
                animate={{
                  opacity: [0.4, 0.9, 0.4],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-2xl sm:rounded-3xl pointer-events-none bg-gradient-to-r from-transparent via-[#00e1ff]/30 to-transparent blur-[2px]"
              />
            )}

            {/* Dark Glassmorphic Inner Panel */}
            <div className="relative w-full bg-[#060b14]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-center overflow-hidden border border-white/10 shadow-[inset_0_0_35px_rgba(26,157,224,0.12)]">
              
              {/* Subtle background canvas for drifting smoke and micro-orbs */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none w-full h-full opacity-70"
              />

              {/* Close Button X */}
              <button
                type="button"
                onClick={() => handleChoice('denied')}
                className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 h-7 w-7 rounded-full flex items-center justify-center text-cyan-200/60 hover:text-white hover:bg-white/10 hover:shadow-[0_0_14px_rgba(26,157,224,0.6)] transition-all cursor-pointer z-20 border border-transparent hover:border-cyan-400/30"
                aria-label="Close analytics prompt"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Content Container */}
              <div className="relative z-10 flex flex-col items-center">
                
                {/* Heading */}
                <h3 className="text-base sm:text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-200 drop-shadow-[0_0_12px_rgba(26,157,224,0.4)] max-w-md">
                  Help us understand how the site is used
                </h3>

                {/* Body Copy */}
                <p className="mt-2 text-xs sm:text-sm text-cyan-100/75 leading-relaxed max-w-sm sm:max-w-md mx-auto font-normal">
                  With your permission, A Woman With a Welder uses privacy-focused, first-party analytics. It does not send form details or payment information.
                </p>

                {/* Buttons Container */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
                  
                  {/* Primary Button: Allow analytics */}
                  <div className="relative">
                    {/* Hover Branded Sparkles Effect */}
                    {(isHovered || isTriggering) && !prefersReducedMotion && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-3 inset-x-0 flex justify-between px-2 pointer-events-none z-20"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                        <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                      </motion.div>
                    )}

                    <button
                      type="button"
                      onClick={handleAllowClick}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      className={`relative group px-5 sm:px-6 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-[#1a9de0] via-[#00c8ff] to-[#1a9de0] bg-[length:200%_auto] transition-all duration-300 cursor-pointer shadow-[0_0_24px_rgba(26,157,224,0.55)] border border-cyan-300/40 hover:shadow-[0_0_38px_rgba(26,157,224,0.85)] hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2 overflow-hidden ${
                        isTriggering ? "brightness-125 scale-105" : ""
                      }`}
                    >
                      {/* Button sheen animation */}
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                      
                      <span className="relative z-10">Allow analytics</span>
                      <ArrowRight className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-100 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Secondary Button: No thanks */}
                  <button
                    type="button"
                    onClick={() => handleChoice('denied')}
                    className="px-5 sm:px-6 py-2.5 rounded-full font-medium text-xs sm:text-sm text-cyan-100/70 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-cyan-500/20 hover:border-cyan-400/40 transition-all cursor-pointer shadow-inner active:scale-[0.97]"
                  >
                    No thanks
                  </button>

                </div>

                {/* Footer Branding */}
                <div className="mt-4 pt-3.5 border-t border-[#1a9de0]/15 w-full flex items-center justify-center">
                  <a
                    href="https://denversdesk.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity group px-2 py-0.5"
                    title="Powered by Denver's Desk"
                  >
                    <img
                      src={denversDeskLogo}
                      alt="Denver's Desk"
                      className="h-3.5 w-auto object-contain mix-blend-screen brightness-125 filter drop-shadow-[0_0_6px_rgba(26,157,224,0.4)] group-hover:scale-105 transition-transform"
                    />
                    <span className="font-mono text-[10px] sm:text-[11px] tracking-wider text-cyan-200/60 group-hover:text-cyan-200 uppercase font-medium">
                      Powered by Denver&apos;s Desk
                    </span>
                  </a>
                </div>

              </div>

            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
