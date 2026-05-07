/**
 * CursorTrail — rabenrifaie-style cursor: small inner dot + lagging outer ring.
 * Click + drag fast → throw a physics ball that bounces and gets "caught".
 *
 * Cursor anatomy:
 *   • Inner dot   — 3 px white, no lag, snaps exactly to pointer
 *   • Outer ring  — 24 px, follows with spring lerp (0.10 factor)
 *   • On mousedown: ring shrinks + brightens (charge state)
 *   • On hover over interactive elements: ring expands to 40 px, fills slightly
 *
 * Ball physics (throw on fast release):
 *   gravity 0.45, bounce 0.52, friction 0.985
 *   Catch triggers: near cursor after ≥1 bounce | slow after ≥2 | max 5 bounces
 *   Catch burst: golden expanding glow, 18 frames
 */
import { useEffect, useRef } from "react";

const GRAVITY  = 0.45;
const BOUNCE   = 0.52;
const FRICTION = 0.985;
const GLOW     = "99,102,241";

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
  bounces: number;
  catching: boolean; catchTimer: number;
}

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;

    // ── State ──────────────────────────────────────────────────────────────────
    const mouse  = { x: W / 2, y: H / 2 };
    const ring   = { x: W / 2, y: H / 2 };   // lagging ring position
    const vel    = { x: 0, y: 0 };            // mouse velocity for throw
    let pressing    = false;
    let overHover   = false;                   // hovering interactive element?
    const balls: Ball[] = [];

    // ── Events ────────────────────────────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      vel.x = e.clientX - mouse.x;
      vel.y = e.clientY - mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Detect if cursor is over something interactive
      const el = document.elementFromPoint(e.clientX, e.clientY);
      overHover = !!(el && (
        el.tagName === "BUTTON" ||
        el.tagName === "A" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "LABEL" ||
        el.closest("button,a,input,select,label,[role=button]")
      ));
    };

    const onDown = () => { pressing = true; };

    const onUp = () => {
      pressing = false;
      const speed = Math.hypot(vel.x, vel.y);
      if (speed > 3) {
        const power = Math.min(speed * 1.6, 28);
        const nx = vel.x / speed, ny = vel.y / speed;
        balls.push({
          x: ring.x, y: ring.y,
          vx: nx * power + (Math.random() - 0.5) * 2,
          vy: ny * power - Math.abs(ny * power) * 0.3 - 2,
          r: 7 + Math.random() * 4,
          alpha: 1, bounces: 0,
          catching: false, catchTimer: 0,
        });
      }
    };

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("resize",    onResize);

    // ── Helpers ───────────────────────────────────────────────────────────────
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

    // ── Animation ─────────────────────────────────────────────────────────────
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, W, H);

      // Spring lerp ring toward mouse
      const lerpFactor = pressing ? 0.18 : overHover ? 0.09 : 0.12;
      ring.x += (mouse.x - ring.x) * lerpFactor;
      ring.y += (mouse.y - ring.y) * lerpFactor;

      // ── Draw outer ring ──────────────────────────────────────────────────────
      const targetR  = pressing ? 14 : overHover ? 38 : 22;
      const ringA    = pressing ? 0.9 : overHover ? 0.55 : 0.45;
      const ringW    = pressing ? 1.5 : 1;

      // Soft glow behind ring when hovering
      if (overHover) {
        drawGlow(ring.x, ring.y, targetR * 1.8, 0.08, GLOW);
      }

      ctx.beginPath();
      ctx.arc(ring.x, ring.y, targetR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${GLOW},${ringA})`;
      ctx.lineWidth   = ringW;
      ctx.stroke();

      // Fill ring slightly when pressing (charge indicator)
      if (pressing) {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, targetR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${GLOW},0.08)`;
        ctx.fill();
      }

      // ── Draw inner dot ───────────────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = pressing ? `rgba(${GLOW},1)` : "rgba(255,255,255,0.92)";
      ctx.fill();

      // ── Balls ────────────────────────────────────────────────────────────────
      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];

        if (b.catching) {
          b.catchTimer++;
          const t  = b.catchTimer / 18;
          const cr = b.r * (1 + t * 3);
          drawGlow(b.x, b.y, cr * 3, (1 - t) * 0.8, "255,220,100");
          ctx.beginPath();
          ctx.arc(b.x, b.y, cr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,220,100,${(1 - t) * 0.5})`;
          ctx.fill();
          if (b.catchTimer >= 18) balls.splice(bi, 1);
          continue;
        }

        // Physics
        b.vy += GRAVITY;
        b.vx *= FRICTION;
        b.x  += b.vx;
        b.y  += b.vy;

        if (b.y + b.r > H) { b.y = H - b.r; b.vy *= -BOUNCE; b.vx *= 0.88; b.bounces++; }
        if (b.y - b.r < 0) { b.y = b.r;     b.vy *= -BOUNCE; }
        if (b.x - b.r < 0) { b.x = b.r;     b.vx *= -BOUNCE; }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -BOUNCE; }

        const dx = b.x - mouse.x, dy = b.y - mouse.y;
        const nearCursor = Math.hypot(dx, dy) < 60 && b.bounces >= 1;
        const slowEnough = Math.hypot(b.vx, b.vy) < 2.5 && b.bounces >= 2;
        const tooOld     = b.bounces >= 5;

        if (nearCursor || slowEnough || tooOld) {
          b.catching = true; b.catchTimer = 0; continue;
        }

        // Draw ball
        const speed = Math.hypot(b.vx, b.vy);
        const ballA = b.alpha;

        // Shadow on floor
        ctx.beginPath();
        ctx.ellipse(b.x, H - 4, b.r * 1.2, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${ballA * 0.25})`;
        ctx.fill();

        // Glow
        drawGlow(b.x, b.y, b.r * 3.5, ballA * 0.4, "160,130,255");

        // Core gradient
        const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 1, b.x, b.y, b.r);
        grad.addColorStop(0,   `rgba(220,210,255,${ballA})`);
        grad.addColorStop(0.5, `rgba(${GLOW},${ballA})`);
        grad.addColorStop(1,   `rgba(50,30,120,${ballA})`);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Specular highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${ballA * 0.7})`;
        ctx.fill();

        // Speed trail
        if (speed > 8) {
          ctx.beginPath();
          ctx.moveTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(180,150,255,${ballA * 0.3})`;
          ctx.lineWidth   = b.r * 0.7;
          ctx.lineCap     = "round";
          ctx.stroke();
        }
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("resize",    onResize);
    };
  }, []);

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
