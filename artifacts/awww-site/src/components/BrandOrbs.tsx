import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import tradieGagsLogo from "@assets/ChatGPT_Image_Jun_22,_2026,_11_20_52_PM_1782370414661.png";
import homeHeaderLogo from "@assets/Home_-_Header_Logo_(PNG)_1782370414661.png";
import trailerBrainLogo from "@assets/Logo_-_The_Trailer_Brain_(Long)_1782370414661.png";

const BRANDS = [
  { id: 1, name: "Tradie Gags",   angle: 0,   radius: 290, delay: 0,   logo: tradieGagsLogo,   live: true,  url: "#" },
  { id: 2, name: "Home Base",     angle: 72,  radius: 280, delay: 0.5, logo: homeHeaderLogo,   live: true,  url: "#" },
  { id: 3, name: "Trailer Brain", angle: 144, radius: 275, delay: 1.2, logo: trailerBrainLogo, live: true,  url: "#" },
  { id: 4, name: "Coming Soon",   angle: 216, radius: 285, delay: 0.8, logo: null,             live: false, url: null },
  { id: 5, name: "Coming Soon",   angle: 288, radius: 278, delay: 1.5, logo: null,             live: false, url: null },
];

// Electricity line start — just outside the logo edges
const LOGO_RX = 138;  // logo half-width + small gap
const LOGO_RY = 90;   // logo half-height + small gap

/** Hash pseudo-random in [-1, 1] — deterministic so it's stable per tick */
function hash(seed: number, i: number): number {
  const x = Math.sin(seed * 13.7 + i * 37.3 + seed * i * 0.07) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function lightningPath(
  x1: number, y1: number,
  x2: number, y2: number,
  segments: number,
  jitter: number,
  seed: number
): string {
  const pts: [number, number][] = [[x1, y1]];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny =  dx / len;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const bx = x1 + dx * t;
    const by = y1 + dy * t;
    const taper = Math.sin(t * Math.PI); // zero at endpoints, max at midpoint
    const offset = hash(seed, i) * jitter * taper;
    pts.push([bx + nx * offset, by + ny * offset]);
  }
  pts.push([x2, y2]);
  return pts.map(([px, py], idx) => `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
}

export function BrandOrbs() {
  const { toast } = useToast();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    // Re-randomise bolt shape every ~130ms — makes electricity "move"
    const iv = setInterval(() => setTick(t => t + 1), 130);
    return () => { window.removeEventListener("resize", onResize); clearInterval(iv); };
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* ── Electricity SVG ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <filter id="elec-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {BRANDS.map((brand) => {
          const rad = (brand.angle * Math.PI) / 180;

          // Start on the logo perimeter ellipse — so lines come off the logo EDGES
          const sx = cx + Math.cos(rad) * LOGO_RX;
          const sy = cy + Math.sin(rad) * LOGO_RY;

          // End just before the orb face (orb half-size ≈ 55px)
          const ex = cx + Math.cos(rad) * (brand.radius - 58);
          const ey = cy + Math.sin(rad) * (brand.radius - 58);

          const seed1 = tick + brand.id * 11;
          const seed2 = tick + brand.id * 11 + 6;

          const bolt1 = lightningPath(sx, sy, ex, ey, 18, 16, seed1);
          const bolt2 = lightningPath(sx, sy, ex, ey, 13,  9, seed2);

          const flicker = 0.55 + Math.abs(hash(tick, brand.id)) * 0.35;

          return (
            <g key={brand.id}>
              {/* Wide ambient halo */}
              <path d={bolt1} fill="none" stroke="#1a9de0" strokeWidth="8"
                    strokeLinecap="round" opacity={flicker * 0.1}
                    filter="url(#elec-glow)" />
              {/* Secondary bolt */}
              <path d={bolt2} fill="none" stroke="#60c8ff" strokeWidth="2"
                    strokeLinecap="round" opacity={flicker * 0.4} />
              {/* Primary bolt bright core */}
              <path d={bolt1} fill="none" stroke="#b8e4ff" strokeWidth="1.2"
                    strokeLinecap="round" opacity={flicker * 0.85} />
              {/* Anchor spark at logo edge */}
              <circle cx={sx} cy={sy} r={2.5} fill="#ffffff"
                      opacity={0.3 + Math.abs(hash(tick * 2, brand.id)) * 0.7} />
            </g>
          );
        })}
      </svg>

      {/* ── Brand orbs — correct positioning: CSS left/top + translateX/Y for centering, animate for bob ── */}
      {BRANDS.map((brand) => {
        const rad = (brand.angle * Math.PI) / 180;
        const x = Math.cos(rad) * brand.radius;
        const y = Math.sin(rad) * brand.radius;

        return (
          <motion.div
            key={brand.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: brand.delay, type: "spring" }}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: `calc(50% + ${x}px)`,
              top:  `calc(50% + ${y}px)`,
              translateX: "-50%",
              translateY: "-50%",
              zIndex: 2,
            }}
            onClick={() => {
              if (!brand.live) {
                toast({ title: "Coming Soon", description: "This partner brand is launching shortly." });
              } else {
                toast({ title: brand.name, description: "Partner link coming soon." });
              }
            }}
            data-testid={`orb-brand-${brand.id}`}
          >
            {/* Inner bobbing wrapper */}
            <motion.div
              animate={{
                y: [-8, 8, -8],
                x: [-4, 4, -4],
              }}
              transition={{
                y: { duration: 4 + brand.id * 0.3, repeat: Infinity, ease: "easeInOut", delay: brand.delay },
                x: { duration: 5 + brand.id * 0.4, repeat: Infinity, ease: "easeInOut", delay: brand.delay * 1.5 },
              }}
            >
              <motion.div
                whileHover={{ scale: 1.22, boxShadow: "0 0 42px rgba(26, 157, 224, 0.9)" }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
                className="relative w-[110px] h-[110px] rounded-full bg-[#0a0f1a]/95 border border-primary/35 backdrop-blur-sm flex flex-col items-center justify-center shadow-[0_0_20px_rgba(26,157,224,0.3)] overflow-hidden"
              >
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="w-[90px] h-[90px] object-contain"
                    style={{ mixBlendMode: "screen" }}
                  />
                ) : (
                  <>
                    <span className="font-mono text-[9px] text-primary/50 font-bold tracking-widest uppercase text-center leading-tight px-2 mb-4">
                      {brand.name}
                    </span>
                    <div
                      className="absolute bottom-0 left-0 right-0 text-center py-[4px]"
                      style={{ background: "rgba(26,157,224,0.15)", borderTop: "1px solid rgba(26,157,224,0.25)" }}
                    >
                      <span className="font-mono text-[7px] text-primary tracking-[0.18em] uppercase">Coming Soon</span>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
