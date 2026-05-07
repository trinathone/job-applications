/**
 * CursorTrail — glowing cursor trail + ball-throw physics on click.
 *
 * Normal: indigo glowing orb trails the cursor with spring follow.
 * Throw:  press and hold, move fast, release → ball launches in that direction.
 *         Ball arcs with gravity, bounces off screen edges, then fades out
 *         with a "catch" burst when it slows or after max bounces.
 */
import { useEffect, useRef } from "react";

const TRAIL  = 24;
const GLOW   = "99,102,241";
const GRAVITY = 0.45;
const BOUNCE  = 0.52;
const FRICTION = 0.985;

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number;
  bounces: number;
  catching: boolean;
  catchTimer: number;
}

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;

    // Mouse state
    const mouse  = { x: W / 2, y: H / 2 };
    const smooth = { x: W / 2, y: H / 2 };
    const vel    = { x: 0, y: 0, px: W/2, py: H/2 }; // velocity tracking
    let   pressing = false;
    let   holdTime  = 0;

    // Trail dots
    const trail = Array.from({ length: TRAIL }, () => ({ x: W/2, y: H/2 }));

    // Live balls
    const balls: Ball[] = [];

    // ── Event listeners ──────────────────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      vel.x = e.clientX - mouse.x;
      vel.y = e.clientY - mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const onDown = () => { pressing = true; holdTime = 0; };

    const onUp = () => {
      pressing = false;
      const speed = Math.hypot(vel.x, vel.y);
      // Only throw if moving fast enough
      if (speed > 3) {
        const power = Math.min(speed * 1.6, 28);
        const nx = vel.x / speed;
        const ny = vel.y / speed;
        balls.push({
          x: smooth.x, y: smooth.y,
          vx: nx * power + (Math.random() - 0.5) * 2,
          vy: ny * power - Math.abs(ny * power) * 0.3 - 2,
          r: 7 + Math.random() * 4,
          alpha: 1,
          bounces: 0,
          catching: false,
          catchTimer: 0,
        });
      }
    };

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mousedown",  onDown);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("resize",     onResize);

    // ── Helpers ──────────────────────────────────────────────────────────────
    function drawGlow(x: number, y: number, r: number, alpha: number, color: string) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,   `rgba(${color},${alpha})`);
      g.addColorStop(0.4, `rgba(${color},${alpha * 0.3})`);
      g.addColorStop(1,   `rgba(${color},0)`);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, W, H);

      if (pressing) holdTime++;

      // Smooth cursor
      smooth.x += (mouse.x - smooth.x) * 0.16;
      smooth.y += (mouse.y - smooth.y) * 0.16;

      // Shift trail
      for (let i = trail.length - 1; i > 0; i--) {
        trail[i].x = trail[i-1].x;
        trail[i].y = trail[i-1].y;
      }
      trail[0].x = smooth.x;
      trail[0].y = smooth.y;

      // Draw trail
      trail.forEach((d, i) => {
        const t = 1 - i / trail.length;
        const r = (pressing ? 9 : 6) * t;
        drawGlow(d.x, d.y, r * 3, t * t * 0.45, GLOW);
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.3, r * 0.5), 0, Math.PI*2);
        ctx.fillStyle = `rgba(${GLOW},${t * t * 0.7})`;
        ctx.fill();
      });

      // Wind-up ring when holding
      if (pressing && holdTime > 4) {
        const pulse = Math.sin(holdTime * 0.25) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(smooth.x, smooth.y, 14 + holdTime * 0.3, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(${GLOW},${pulse * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Cursor ring + dot
      ctx.beginPath();
      ctx.arc(smooth.x, smooth.y, pressing ? 7 : 10, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${GLOW},${pressing ? 0.9 : 0.5})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(smooth.x, smooth.y, 2.5, 0, Math.PI*2);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();

      // ── Balls ──────────────────────────────────────────────────────────────
      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];

        if (b.catching) {
          // Catch burst — expand + fade
          b.catchTimer++;
          const t = b.catchTimer / 18;
          const cr = b.r * (1 + t * 3);
          drawGlow(b.x, b.y, cr * 3, (1 - t) * 0.8, "255,220,100");
          ctx.beginPath();
          ctx.arc(b.x, b.y, cr, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,220,100,${(1-t)*0.6})`;
          ctx.fill();
          if (b.catchTimer >= 18) balls.splice(bi, 1);
          continue;
        }

        // Physics
        b.vy += GRAVITY;
        b.vx *= FRICTION;
        b.x  += b.vx;
        b.y  += b.vy;

        // Floor bounce
        if (b.y + b.r > H) {
          b.y  = H - b.r;
          b.vy *= -BOUNCE;
          b.vx *= 0.88;
          b.bounces++;
        }
        // Ceiling
        if (b.y - b.r < 0) { b.y = b.r; b.vy *= -BOUNCE; }
        // Walls
        if (b.x - b.r < 0)  { b.x = b.r;     b.vx *= -BOUNCE; }
        if (b.x + b.r > W)  { b.x = W - b.r; b.vx *= -BOUNCE; }

        // Check if near cursor → catch
        const dx = b.x - smooth.x, dy = b.y - smooth.y;
        const nearCursor = Math.hypot(dx, dy) < 60 && b.bounces >= 1;
        const slowEnough = Math.hypot(b.vx, b.vy) < 2.5 && b.bounces >= 2;
        const tooOld     = b.bounces >= 5;

        if (nearCursor || slowEnough || tooOld) {
          b.catching = true; b.catchTimer = 0; continue;
        }

        // Draw ball
        const speed  = Math.hypot(b.vx, b.vy);
        const ballA  = Math.min(1, b.alpha);
        // Shadow
        ctx.beginPath();
        ctx.ellipse(b.x, H - 4, b.r * 1.2, 3, 0, 0, Math.PI*2);
        ctx.fillStyle = `rgba(0,0,0,${ballA * 0.25})`;
        ctx.fill();
        // Glow
        drawGlow(b.x, b.y, b.r * 3.5, ballA * 0.4, "160,130,255");
        // Core
        const grad = ctx.createRadialGradient(b.x - b.r*0.3, b.y - b.r*0.3, 1, b.x, b.y, b.r);
        grad.addColorStop(0, `rgba(220,210,255,${ballA})`);
        grad.addColorStop(0.5, `rgba(${GLOW},${ballA})`);
        grad.addColorStop(1, `rgba(50,30,120,${ballA})`);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r*0.3, b.y - b.r*0.3, b.r*0.28, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${ballA * 0.7})`;
        ctx.fill();
        // Spin trail when fast
        if (speed > 8) {
          ctx.beginPath();
          ctx.moveTo(b.x - b.vx*1.2, b.y - b.vy*1.2);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(180,150,255,${ballA * 0.35})`;
          ctx.lineWidth = b.r * 0.7;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mousedown",  onDown);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("resize",     onResize);
    };
  }, []);

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
