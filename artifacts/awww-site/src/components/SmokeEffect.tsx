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

    // Spark tip: precisely aligned at the center of the blue arc in the resized center logo image
    const getLogoWidth = () => {
      const w = window.innerWidth;
      if (w < 640) return 190;
      if (w < 768) return 300;
      return 370;
    };
    const sparkX = () => window.innerWidth / 2 + getLogoWidth() * 0.3008;
    const sparkY = () => window.innerHeight / 2 - (getLogoWidth() / 2.1027) * 0.019;

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
        // Occasionally fire a spatter particle
        if (Math.random() < 0.70 && spatters.length < 40) {
          const angle = -Math.PI * 0.65 + Math.random() * Math.PI * 1.3;
          const speed = 1.8 + Math.random() * 4.2;
          spatters.push({
            x: sx, y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            life: 0,
            maxLife: 22 + Math.random() * 28,
            size: 1.2 + Math.random() * 2.5,
            hue: Math.random() < 0.6 ? 200 : 35, // blue-white or amber
          });
        }
      }

      // Draw arc glow layers
      const arcAlpha = arcBrightness;

      // Outer bloom
      const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, 36 * arcBrightness);
      bloom.addColorStop(0, `rgba(180, 220, 255, ${arcAlpha * 0.45})`);
      bloom.addColorStop(0.4, `rgba(26, 157, 224, ${arcAlpha * 0.28})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(sx, sy, 36 * arcBrightness, 0, Math.PI * 2);
      ctx.fillStyle = bloom;
      ctx.fill();

      // Inner hot core
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9 * arcBrightness);
      core.addColorStop(0, `rgba(255, 255, 255, ${arcAlpha * 1.0})`);
      core.addColorStop(0.4, `rgba(160, 210, 255, ${arcAlpha * 0.8})`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(sx, sy, 9 * arcBrightness, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Tiny bright pinpoint
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
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
        const alpha = (1 - t) * 0.95;
        const sat   = p.hue === 200 ? "85%" : "95%";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${sat}, 70%, ${alpha})`;
        ctx.fill();
      });

      // ── 3. Smoke wisps ──
      if (frame % 10 === 0 && smoke.length < 24) {
        const life = 100 + Math.random() * 60;
        smoke.push({
          x: sx + (Math.random() - 0.5) * 14,
          y: sy + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.35 + Math.random() * 0.35),
          opacity: 0, size: 6 + Math.random() * 10,
          life: 0, maxLife: life,
        });
      }

      smoke = smoke.filter(p => p.life < p.maxLife);
      smoke.forEach(p => {
        p.life++;
        p.x  += p.vx;
        p.y  += p.vy;
        p.size += 0.15;
        p.vx *= 0.997;

        const t = p.life / p.maxLife;
        p.opacity = t < 0.2 ? (t / 0.2) * 0.22 : (1 - t) * 0.22;

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
