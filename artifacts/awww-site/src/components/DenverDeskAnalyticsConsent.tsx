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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const configured = isDenverDeskAnalyticsConfigured();

  useEffect(() => {
    if (configured && consent === "granted") {
      initialiseDenverDeskAnalytics();
      void trackDenverDeskEvent("page_view");
    }
  }, [configured, consent]);

  useEffect(() => {
    if (configured && consent === null) {
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
      if (particles.length >= 18) return;
      const isPink = Math.random() < 0.22;
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.2 + Math.random() * 0.35),
        size: 6 + Math.random() * 18,
        alpha: 0,
        maxAlpha: isPink ? 0.12 : 0.18,
        hue: isPink ? 330 : 198,
        life: 0,
        maxLife: 110 + Math.random() * 70,
      });
    };

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (frame % 10 === 0) addParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.06;

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

  const handleAllowClick = () => {
    setIsTriggering(true);
    setTimeout(() => {
      handleChoice('granted');
    }, 280);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.94 }}
          transition={{
            duration: prefersReducedMotion ? 0.15 : 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-[450px] pointer-events-auto font-sans select-none"
          aria-label="Analytics privacy consent"
        >
          {/* External Glowing Ambient Halo & Border Spark */}
          <div className="relative rounded-xl sm:rounded-2xl p-[1px] bg-gradient-to-r from-[#1a9de0]/50 via-pink-500/25 to-[#1a9de0]/50 shadow-[0_0_40px_rgba(26,157,224,0.28),_0_0_12px_rgba(244,114,182,0.12)] overflow-hidden">
            
            {/* Pulsing electric edge glow line */}
            {!prefersReducedMotion && (
              <motion.div
                animate={{
                  opacity: [0.35, 0.85, 0.35],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none bg-gradient-to-r from-transparent via-[#00e1ff]/30 to-transparent blur-[2px]"
              />
            )}

            {/* Dark Glassmorphic Inner Panel (scaled down 15% in proportion) */}
            <div className="relative w-full bg-[#060b14]/92 backdrop-blur-2xl rounded-xl sm:rounded-2xl p-4 sm:p-5 text-center overflow-hidden border border-white/10 shadow-[inset_0_0_28px_rgba(26,157,224,0.12)]">
              
              {/* Background canvas for drifting smoke and micro-orbs */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none w-full h-full opacity-65"
              />

              {/* Close Button X */}
              <button
                type="button"
                onClick={() => handleChoice('denied')}
                className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 h-6 w-6 rounded-full flex items-center justify-center text-cyan-200/60 hover:text-white hover:bg-white/10 hover:shadow-[0_0_12px_rgba(26,157,224,0.6)] transition-all cursor-pointer z-20 border border-transparent hover:border-cyan-400/30"
                aria-label="Close analytics prompt"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Content Container */}
              <div className="relative z-10 flex flex-col items-center">
                
                {/* Heading */}
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-200 drop-shadow-[0_0_10px_rgba(26,157,224,0.4)] max-w-xs sm:max-w-sm">
                  Help us understand how the site is used
                </h3>

                {/* Body Copy */}
                <p className="mt-1.5 text-[11px] sm:text-xs text-cyan-100/75 leading-relaxed max-w-xs sm:max-w-sm mx-auto font-normal">
                  With your permission, A Woman With a Welder uses privacy-focused, first-party analytics. It does not send form details or payment information.
                </p>

                {/* Buttons Container */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 w-full sm:w-auto">
                  
                  {/* Primary Button: Allow analytics */}
                  <div className="relative">
                    {(isHovered || isTriggering) && !prefersReducedMotion && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.05 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-2.5 inset-x-0 flex justify-between px-2 pointer-events-none z-20"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
                        <Sparkles className="w-3 h-3 text-pink-400 animate-pulse" />
                      </motion.div>
                    )}

                    <button
                      type="button"
                      onClick={handleAllowClick}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      className={`relative group px-4 sm:px-5 py-2 rounded-full font-semibold text-[11px] sm:text-xs text-white bg-gradient-to-r from-[#1a9de0] via-[#00c8ff] to-[#1a9de0] bg-[length:200%_auto] transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(26,157,224,0.55)] border border-cyan-300/40 hover:shadow-[0_0_30px_rgba(26,157,224,0.85)] hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-1.5 overflow-hidden ${
                        isTriggering ? "brightness-125 scale-105" : ""
                      }`}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                      
                      <span className="relative z-10">Allow analytics</span>
                      <ArrowRight className="relative z-10 w-3 h-3 text-cyan-100 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Secondary Button: No thanks */}
                  <button
                    type="button"
                    onClick={() => handleChoice('denied')}
                    className="px-4 sm:px-5 py-2 rounded-full font-medium text-[11px] sm:text-xs text-cyan-100/70 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-cyan-500/20 hover:border-cyan-400/40 transition-all cursor-pointer shadow-inner active:scale-[0.97]"
                  >
                    No thanks
                  </button>

                </div>

                {/* Footer Branding */}
                <div className="mt-3 pt-2.5 border-t border-[#1a9de0]/15 w-full flex items-center justify-center">
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
                      className="h-3 w-auto object-contain mix-blend-screen brightness-125 filter drop-shadow-[0_0_6px_rgba(26,157,224,0.4)] group-hover:scale-105 transition-transform"
                    />
                    <span className="font-mono text-[9px] sm:text-[10px] tracking-wider text-cyan-200/60 group-hover:text-cyan-200 uppercase font-medium">
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
