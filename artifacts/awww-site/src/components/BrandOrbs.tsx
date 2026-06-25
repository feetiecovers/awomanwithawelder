import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const BRANDS = [
  { id: 1, name: "Brand 1", angle: 0,   radius: 148, delay: 0 },
  { id: 2, name: "Brand 2", angle: 72,  radius: 138, delay: 0.5 },
  { id: 3, name: "Brand 3", angle: 144, radius: 132, delay: 1.2 },
  { id: 4, name: "Brand 4", angle: 216, radius: 142, delay: 0.8 },
  { id: 5, name: "Brand 5", angle: 288, radius: 136, delay: 1.5 },
];

function jaggedPath(x1: number, y1: number, x2: number, y2: number, segments: number, jitter: number): string {
  const points: [number, number][] = [[x1, y1]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const bx = x1 + (x2 - x1) * t;
    const by = y1 + (y2 - y1) * t;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (Math.sin(i * 2.7 + 0.9) * 0.5 + Math.cos(i * 1.3 + 0.4) * 0.5) * jitter;
    points.push([bx + nx * offset, by + ny * offset]);
  }
  points.push([x2, y2]);
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

export function BrandOrbs() {
  const { toast } = useToast();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Electricity lines — SVG layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <style>{`
            @keyframes flicker {
              0%,100% { opacity: 0.55; }
              20% { opacity: 0.9; }
              40% { opacity: 0.3; }
              60% { opacity: 0.75; }
              80% { opacity: 0.4; }
            }
            @keyframes flow {
              from { stroke-dashoffset: 200; }
              to   { stroke-dashoffset: 0; }
            }
            .elec-line {
              fill: none;
              stroke: #1a9de0;
              stroke-width: 1.2;
              stroke-dasharray: 6 10;
              animation: flicker 1.4s ease-in-out infinite, flow 2s linear infinite;
            }
            .elec-line-glow {
              fill: none;
              stroke: #1a9de0;
              stroke-width: 3;
              stroke-linecap: round;
              opacity: 0.1;
              animation: flicker 1.6s ease-in-out infinite;
            }
          `}</style>
        </defs>
        {BRANDS.map((brand) => {
          const rad = (brand.angle * Math.PI) / 180;
          const ox = cx + Math.cos(rad) * brand.radius;
          const oy = cy + Math.sin(rad) * brand.radius;
          const path = jaggedPath(cx, cy, ox, oy, 7, 14);
          return (
            <g key={brand.id} style={{ animationDelay: `${brand.delay * 0.3}s` }}>
              <path d={path} className="elec-line-glow" />
              <path d={path} className="elec-line" style={{ animationDelay: `${brand.delay * 0.4}s` }} />
            </g>
          );
        })}
      </svg>

      {/* Brand orbs */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
        {BRANDS.map((brand) => {
          const rad = (brand.angle * Math.PI) / 180;
          const x = Math.cos(rad) * brand.radius;
          const y = Math.sin(rad) * brand.radius;

          return (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [y - 8, y + 8, y - 8],
                x: [x - 4, x + 4, x - 4],
              }}
              transition={{
                opacity: { duration: 1, delay: brand.delay },
                scale: { duration: 1, delay: brand.delay, type: "spring" },
                y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: brand.delay },
                x: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: brand.delay * 1.5 },
              }}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                x: "-50%",
                y: "-50%",
              }}
              onClick={() =>
                toast({ title: `Coming soon: ${brand.name}`, description: "Partner brand integration in progress." })
              }
            >
              <motion.div
                whileHover={{ scale: 1.25, boxShadow: "0 0 36px rgba(26, 157, 224, 0.9)" }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="w-20 h-20 rounded-full bg-[#0d1420]/90 border border-primary/40 backdrop-blur-sm flex items-center justify-center shadow-[0_0_18px_rgba(26,157,224,0.35)]"
              >
                <span className="font-mono text-[10px] text-primary font-bold tracking-widest uppercase">
                  {brand.name}
                </span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
