import { useEffect, useRef } from "react";

interface SmokeParticle {
  x: number; y: number;
  vx: number; vy: number;
  opacity: number; size: number;
  life: number; maxLife: number;
}

interface Spatter {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; hue: number;
}

export function SmokeEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let smoke: SmokeParticle[] = [];
    let spatters: Spatter[] = [];
    let animId: number;
    let frame = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spark tip: positioned at the center of the blue arc in the center logo image
    const isMobile = () => window.innerWidth < 640;
    const sparkX = () => window.innerWidth  / 2 + (isMobile() ? 38.0 : 53.2);
    const sparkY = () => window.innerHeight / 2 - (isMobile() ? 2.0  : 2.8);

    // ── Welding arc flicker state ──
    let arcBrightness = 1;
    let arcNextFlip   = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame++;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sx = sparkX();
      const sy = sparkY();

      // ── 1. Welding arc — high-frequency blue-white flash ──
      if (frame >= arcNextFlip) {
        // Random flicker: bright burst or dim, changes every 2-6 frames
        arcBrightness = Math.random() > 0.35 ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.25;
        arcNextFlip   = frame + 2 + Math.floor(Math.random() * 5);

        // Occasionally fire a spatter particle
        if (Math.random() < 0.55 && spatters.length < 30) {
          const angle = -Math.PI * 0.6 + Math.random() * Math.PI * 1.2;
          const speed = 1.5 + Math.random() * 3.5;
          spatters.push({
            x: sx, y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 0,
            maxLife: 20 + Math.random() * 25,
            size: 1 + Math.random() * 2.2,
            hue: Math.random() < 0.6 ? 200 : 35, // blue-white or amber
          });
        }
      }

      // Draw arc glow layers
      const arcAlpha = arcBrightness;

      // Outer bloom
      const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28 * arcBrightness);
      bloom.addColorStop(0, `rgba(180, 220, 255, ${arcAlpha * 0.35})`);
      bloom.addColorStop(0.4, `rgba(26, 157, 224, ${arcAlpha * 0.18})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(sx, sy, 28 * arcBrightness, 0, Math.PI * 2);
      ctx.fillStyle = bloom;
      ctx.fill();

      // Inner hot core
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7 * arcBrightness);
      core.addColorStop(0, `rgba(255, 255, 255, ${arcAlpha * 0.95})`);
      core.addColorStop(0.4, `rgba(160, 210, 255, ${arcAlpha * 0.7})`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(sx, sy, 7 * arcBrightness, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Tiny bright pinpoint
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${arcAlpha})`;
      ctx.fill();

      // ── 2. Spatter particles ──
      spatters = spatters.filter(p => p.life < p.maxLife);
      spatters.forEach(p => {
        p.life++;
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.97;

        const t = p.life / p.maxLife;
        const alpha = (1 - t) * 0.85;
        const sat   = p.hue === 200 ? "80%" : "90%";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${sat}, 70%, ${alpha})`;
        ctx.fill();
      });

      // ── 3. Smoke wisps ──
      if (frame % 14 === 0 && smoke.length < 18) {
        const life = 90 + Math.random() * 60;
        smoke.push({
          x: sx + (Math.random() - 0.5) * 14,
          y: sy + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -(0.3 + Math.random() * 0.3),
          opacity: 0, size: 5 + Math.random() * 9,
          life: 0, maxLife: life,
        });
      }

      smoke = smoke.filter(p => p.life < p.maxLife);
      smoke.forEach(p => {
        p.life++;
        p.x  += p.vx;
        p.y  += p.vy;
        p.size += 0.13;
        p.vx *= 0.997;

        const t = p.life / p.maxLife;
        p.opacity = t < 0.2 ? (t / 0.2) * 0.16 : (1 - t) * 0.16;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, `rgba(210, 225, 235, ${p.opacity})`);
        g.addColorStop(1, "rgba(180,200,215,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });
    };

    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}
