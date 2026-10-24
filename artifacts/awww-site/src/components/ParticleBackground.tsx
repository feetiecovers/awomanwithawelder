import { useEffect, useRef } from "react";

interface ParticleBackgroundProps {
  isPaused?: boolean;
}

export function ParticleBackground({ isPaused = false }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopFnRef = useRef<(() => void) | null>(null);
  const startFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: { x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }[] = [];
    let animationFrameId: number | null = null;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      resize();
      particles = [];
      const isMobile = window.innerWidth < 640;
      const divisor = isMobile ? 30000 : 18000;
      const maxCount = isMobile ? 18 : 45;
      const particleCount = Math.min(maxCount, Math.floor((window.innerWidth * window.innerHeight) / divisor));
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5 - 0.2, // slight upward drift
          opacity: Math.random() * 0.5 + 0.1
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles (grid is handled efficiently via CSS background)
      particles.forEach((p) => {
        ctx.fillStyle = `rgba(26, 157, 224, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const stop = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const start = () => {
      if (animationFrameId === null) draw();
    };

    stopFnRef.current = stop;
    startFnRef.current = start;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else if (!isPaused) start();
    };

    window.addEventListener("resize", init);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    init();
    if (document.visibilityState === "visible" && !isPaused) start();

    return () => {
      window.removeEventListener("resize", init);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      stopFnRef.current?.();
    } else if (document.visibilityState === "visible") {
      startFnRef.current?.();
    }
  }, [isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${
        isPaused ? "opacity-10" : "opacity-80"
      }`}
      style={{
        backgroundImage: "linear-gradient(to right, rgba(26, 157, 224, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(26, 157, 224, 0.03) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }}
    />
  );
}
