/**
 * CursorTrail — canvas-based glowing cursor trail that follows the mouse.
 * Renders on top of everything via a fixed full-screen canvas.
 * Skipped on touch-only devices.
 */
import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  vx: number;
  vy: number;
}

const TRAIL_LENGTH = 22;
const GLOW_COLOR   = "99,102,241"; // indigo

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Skip on pure touch devices
    if (window.matchMedia("(hover: none)").matches) return;

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const mouse = { x: W / 2, y: H / 2 };
    const cursor = { x: W / 2, y: H / 2 }; // smooth follow

    // Trail dots
    const dots: Dot[] = Array.from({ length: TRAIL_LENGTH }, (_, i) => ({
      x: W / 2, y: H / 2,
      r: Math.max(0.5, (TRAIL_LENGTH - i) / TRAIL_LENGTH * 7),
      alpha: 0,
      vx: 0, vy: 0,
    }));

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, W, H);

      // Smooth cursor follows mouse
      cursor.x += (mouse.x - cursor.x) * 0.18;
      cursor.y += (mouse.y - cursor.y) * 0.18;

      // Shift all dots along the chain
      for (let i = dots.length - 1; i > 0; i--) {
        dots[i].x = dots[i - 1].x;
        dots[i].y = dots[i - 1].y;
      }
      dots[0].x = cursor.x;
      dots[0].y = cursor.y;

      // Draw each dot
      dots.forEach((dot, i) => {
        const t = 1 - i / dots.length;       // 1 at head, 0 at tail
        const r = dot.r * t;
        const a = t * t * 0.65;             // quadratic fade

        // Outer glow
        const grd = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, r * 3.5);
        grd.addColorStop(0,   `rgba(${GLOW_COLOR},${a * 0.5})`);
        grd.addColorStop(0.4, `rgba(${GLOW_COLOR},${a * 0.15})`);
        grd.addColorStop(1,   `rgba(${GLOW_COLOR},0)`);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, Math.max(0.3, r * 0.55), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${GLOW_COLOR},${a})`;
        ctx.fill();
      });

      // Main cursor ring
      const a = 0.7;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${GLOW_COLOR},${a * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,0.9)`;
      ctx.fill();
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
