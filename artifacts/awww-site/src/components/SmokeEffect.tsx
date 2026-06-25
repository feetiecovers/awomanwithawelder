import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
  life: number;
  maxLife: number;
}

export function SmokeEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spark is ~115px right and ~50px above center of the logo
    const getEmitX = () => window.innerWidth / 2 + 110 + (Math.random() - 0.5) * 18;
    const getEmitY = () => window.innerHeight / 2 - 42 + (Math.random() - 0.5) * 12;

    let frameCount = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frameCount++;

      // Emit a new smoke particle every ~12 frames (low density — subtle)
      if (frameCount % 12 === 0 && particles.length < 18) {
        const life = 90 + Math.random() * 60;
        particles.push({
          x: getEmitX(),
          y: getEmitY(),
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.35 + Math.random() * 0.35),
          opacity: 0,
          size: 6 + Math.random() * 10,
          life: 0,
          maxLife: life,
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter(p => p.life < p.maxLife);

      particles.forEach((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.15;
        p.vx *= 0.995;

        // Fade in then fade out
        const t = p.life / p.maxLife;
        p.opacity = t < 0.2 ? (t / 0.2) * 0.18 : (1 - t) * 0.18;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(220, 230, 240, ${p.opacity})`);
        grad.addColorStop(1, `rgba(180, 200, 215, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
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
