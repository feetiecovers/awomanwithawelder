import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import tradieGagsLogo from "@assets/Tradie_Gags_Logo_1782377451413.png";
import feetieCoversLogo from "@assets/Feetie_Covers_Logo_Black.png";
import trailerBrainLogo from "@assets/Logo_-_The_Trailer_Brain_(Long)_1782370414661.png";
import ladyLuggerLogo from "@assets/Lady_Lugger_Logo.png";
import denversDeskLogo from "@assets/Denvers_Desk_New_Chevron_Logo.png";
import cableCadLogo from "@assets/Cable_CAD_Logo.png";

const BRANDS = [
  { id: 1, name: "Tradie Gags",     angle: 0,   radius: 395, delay: 0,   logo: tradieGagsLogo,     live: false, dark: false, sizeMultiplier: 1.35, lightningOffset: 40 },
  { id: 2, name: "Feetie Covers",   angle: 60,  radius: 280, delay: 0.5, logo: feetieCoversLogo,   live: true,  url: "https://www.feetiecovers.co.nz", dark: false, widthMultiplier: 1.45, sizeMultiplier: 1.35, lightningOffset: 10 },
  { id: 3, name: "Trailer Brain",   angle: 120, radius: 275, delay: 1.2, logo: trailerBrainLogo,   live: true,  url: "https://www.thetrailerbrain.co.nz", dark: false, widthMultiplier: 1.25, sizeMultiplier: 1.62, glowOpacity: 0.2, blueGlowOpacity: 0.25, brightness: 0.85, lightningOffset: 10 },
  { id: 4, name: "The Lady Lugger", angle: 180, radius: 350, delay: 0.8, logo: ladyLuggerLogo,     live: true,  dark: false, sizeMultiplier: 1.485, stripWhiteBg: true, glowOpacity: 0.1, blueGlowOpacity: 0.1, brightness: 0.8, lightningOffset: 46 },
  { id: 5, name: "Denver's Desk",   angle: 240, radius: 278, delay: 1.5, logo: denversDeskLogo,    live: false, dark: false, widthMultiplier: 2.1, sizeMultiplier: 1.9, stripWhiteBg: true, invertBlackText: true, lightningOffset: 25 },
  { id: 6, name: "CableCAD",        angle: 300, radius: 285, delay: 1.8, logo: cableCadLogo,        live: true,  url: "https://cablecad.awomanwithawelder.co.nz", dark: false, sizeMultiplier: 1.35, glowOpacity: 0.2, blueGlowOpacity: 0.2, brightness: 0.75, lightningOffset: 12 },
];

/** Strip near-white backgrounds & optional dark text inversion using off-screen canvas */
function removeWhiteBg(src: string, invertBlackText?: boolean): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const threshold = 230;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r >= threshold && g >= threshold && b >= threshold) {
          d[i + 3] = 0;
        } else if (invertBlackText && r < 70 && g < 70 && b < 70) {
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/** Process logos requiring background transparency or text inversion */
function useProcessedLogos() {
  const [processed, setProcessed] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const brandsToProcess = BRANDS.filter((b) => (b as any).stripWhiteBg);
    Promise.all(
      brandsToProcess.map(async (brand) => {
        const cleaned = await removeWhiteBg(brand.logo, (brand as any).invertBlackText);
        return { id: brand.id, src: cleaned };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<number, string> = {};
      for (const r of results) map[r.id] = r.src;
      setProcessed(map);
    });
    return () => { cancelled = true; };
  }, []);

  return processed;
}

const BASE_LOGO_RX = 138;
const BASE_LOGO_RY = 90;

function hash(seed: number, i: number): number {
  const x = Math.sin(seed * 13.7 + i * 37.3 + seed * i * 0.07) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function lightningPath(
  x1: number, y1: number, x2: number, y2: number,
  segments: number, jitter: number, seed: number
): string {
  const pts: [number, number][] = [[x1, y1]];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const taper = Math.sin(t * Math.PI);
    const offset = hash(seed, i) * jitter * taper;
    pts.push([x1 + dx * t + nx * offset, y1 + dy * t + ny * offset]);
  }
  pts.push([x2, y2]);
  return pts.map(([px, py], idx) => `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
}

interface BrandOrbsProps {
  onOpenConfigurator?: () => void;
}

export function BrandOrbs({ onOpenConfigurator }: BrandOrbsProps = {}) {
  const { toast } = useToast();
  const processedLogos = useProcessedLogos();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    const iv = setInterval(() => setTick(t => t + 1), 130);
    return () => { window.removeEventListener("resize", onResize); clearInterval(iv); };
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;
  const isMobile = size.w < 640;
  const scale   = isMobile 
    ? 0.5 
    : Math.min(1, Math.max(0.35, (size.w - 48) / 900));
  const orbSize = Math.round(62 + (110 - 62) * scale);
  const logoRX  = isMobile ? 65 : Math.round(BASE_LOGO_RX * scale * 1.55);
  const logoRY  = isMobile ? 75 : Math.round(BASE_LOGO_RY * scale * 1.55);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Electricity SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <filter id="elec-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {BRANDS.map(brand => {
          let angle = brand.angle;
          let originAngle = brand.angle;

          if (isMobile) {
            if (brand.id === 1) { // Tradie Gags
              angle = 32; 
              originAngle = 55; // from "R" in welder (bottom right)
            } else if (brand.id === 4) { // Lady Lugger
              angle = 212;
              originAngle = 235; // from "A" in woman (top left)
            }
          }

          const rad = (angle * Math.PI) / 180;
          const originRad = (originAngle * Math.PI) / 180;
          const mobileHorizontalRadius = Math.max(135, Math.min(150, (size.w / 2) - 45));
          const rx  = isMobile 
            ? (brand.angle === 0 || brand.angle === 180 ? mobileHorizontalRadius : 125) 
            : brand.radius * scale * 1.15;
          const ry  = isMobile ? 175 : brand.radius * scale * 1.15;
          const sx  = cx + Math.cos(originRad) * logoRX;
          const sy  = cy + Math.sin(originRad) * logoRY;
          const ox  = Math.cos(rad) * rx;
          const oy  = Math.sin(rad) * ry;
          
          // Calculate vector from start point (sx, sy) to orb center (cx + ox, cy + oy)
          const orbCenterX = cx + ox;
          const orbCenterY = cy + oy;
          const pathDx = orbCenterX - sx;
          const pathDy = orbCenterY - sy;
          const pathDist = Math.sqrt(pathDx * pathDx + pathDy * pathDy);
          
          // Calculate target distance so lightning line reaches the orb border for all brands
          const baseOrbRadius = orbSize / 2;
          const customOffset = isMobile
            ? Math.round(((brand as any).lightningOffset ?? 8) * 0.4)
            : ((brand as any).lightningOffset ?? 8);
            
          const targetDist = Math.max(0, pathDist - baseOrbRadius - customOffset);
          const ratio = pathDist > 0 ? targetDist / pathDist : 0;
          const ex  = sx + pathDx * ratio;
          const ey  = sy + pathDy * ratio;
          const s1  = tick + brand.id * 11;
          const s2  = tick + brand.id * 11 + 6;
          const b1  = lightningPath(sx, sy, ex, ey, 18, 16 * scale, s1);
          const b2  = lightningPath(sx, sy, ex, ey, 13,  9 * scale, s2);
          const flk = 0.55 + Math.abs(hash(tick, brand.id)) * 0.35;
          return (
            <g key={brand.id}>
              <path d={b1} fill="none" stroke="#1a9de0" strokeWidth="8"
                    strokeLinecap="round" opacity={flk * 0.1} filter="url(#elec-glow)" />
              <path d={b2} fill="none" stroke="#60c8ff" strokeWidth="2"
                    strokeLinecap="round" opacity={flk * 0.4} />
              <path d={b1} fill="none" stroke="#b8e4ff" strokeWidth="1.2"
                    strokeLinecap="round" opacity={flk * 0.85} />
              <circle cx={sx} cy={sy} r={2.5} fill="#ffffff"
                      opacity={0.3 + Math.abs(hash(tick * 2, brand.id)) * 0.7} />
            </g>
          );
        })}
      </svg>

      {/* Brand Orbs */}
      {BRANDS.map(brand => {
        let angle = brand.angle;
        if (isMobile) {
          if (brand.id === 1) { // Tradie Gags
            angle = 32; 
          } else if (brand.id === 4) { // Lady Lugger
            angle = 212;
          }
        }

        const rad = (angle * Math.PI) / 180;
        const mobileHorizontalRadius = Math.max(135, Math.min(150, (size.w / 2) - 45));
        const rx  = isMobile 
          ? (brand.angle === 0 || brand.angle === 180 ? mobileHorizontalRadius : 125) 
          : brand.radius * scale * 1.15;
        const ry  = isMobile ? 175 : brand.radius * scale * 1.15;
        const x   = Math.cos(rad) * rx;
        const y   = Math.sin(rad) * ry;

        const logoSrc = (brand as any).stripWhiteBg
          ? (processedLogos[brand.id] || brand.logo)
          : brand.logo;

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
              if (brand.id === 4 && onOpenConfigurator) {
                onOpenConfigurator();
              } else if (!brand.live) {
                toast({ title: "Coming Soon", description: `${brand.name} partner launch coming shortly.` });
              } else if (brand.url) {
                window.open(brand.url, "_blank", "noopener,noreferrer");
              } else {
                toast({ title: brand.name, description: "Partner link coming soon." });
              }
            }}
            data-testid={`orb-brand-${brand.id}`}
          >
            <motion.div
              animate={{ y: [-6, 6, -6], x: [-3, 3, -3] }}
              transition={{
                y: { duration: 4 + brand.id * 0.3, repeat: Infinity, ease: "easeInOut", delay: brand.delay },
                x: { duration: 5 + brand.id * 0.4, repeat: Infinity, ease: "easeInOut", delay: brand.delay * 1.5 },
              }}
            >
              <motion.div
                whileHover={{ scale: 1.22 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
                style={{ 
                  width: (brand as any).widthMultiplier 
                    ? Math.round(orbSize * (brand as any).widthMultiplier * (isMobile ? 1.0 : (brand.sizeMultiplier || 1.0))) 
                    : Math.round(orbSize * (isMobile ? 1.0 : (brand.sizeMultiplier || 1.0))), 
                  height: Math.round(orbSize * (isMobile ? 1.0 : (brand.sizeMultiplier || 1.0))) 
                }}
                className="relative flex flex-col items-center justify-center rounded-2xl overflow-visible"
              >
                {brand.logo ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={logoSrc}
                      alt={brand.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        ...((brand as any).stripWhiteBg
                          ? {
                              filter: `brightness(${(brand as any).brightness || 0.8}) drop-shadow(0 0 6px rgba(255,255,255,0.35)) drop-shadow(0 0 15px rgba(26,157,224,0.25))${!brand.live ? " blur(3.5px) opacity(0.4)" : ""}`,
                            }
                          : {
                              mixBlendMode: "screen" as const,
                              filter: `${(brand as any).brightness ? `brightness(${(brand as any).brightness}) ` : ""}drop-shadow(0 0 8px rgba(255,255,255,${brand.glowOpacity ?? 0.6})) drop-shadow(0 0 20px rgba(26,157,224,${(brand as any).blueGlowOpacity ?? 0.6}))${!brand.live ? " blur(3.5px) opacity(0.4)" : ""}`,
                            }),
                      }}
                    />

                    {/* Original Glowing Cyan Coming Soon Text Overlay */}
                    {!brand.live && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span
                          className="font-mono font-bold tracking-widest uppercase text-center leading-tight whitespace-nowrap"
                          style={{
                            fontSize: Math.max(8, 10 * scale),
                            color: "#60c8ff",
                            textShadow: "0 0 8px rgba(96,200,255,0.8), 0 0 15px rgba(26,157,224,0.6)",
                          }}
                        >
                          Coming
                        </span>
                        <span
                          className="font-mono font-bold tracking-widest uppercase whitespace-nowrap"
                          style={{
                            fontSize: Math.max(8, 10 * scale),
                            color: "#60c8ff",
                            textShadow: "0 0 8px rgba(96,200,255,0.8), 0 0 15px rgba(26,157,224,0.6)",
                          }}
                        >
                          Soon
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-mono font-bold text-[#60c8ff] uppercase">{brand.name}</span>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
