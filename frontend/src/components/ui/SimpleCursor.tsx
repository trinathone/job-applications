import { useEffect, useRef } from "react";

/**
 * Minimal red arrow cursor — direct DOM mutation on every mousemove,
 * no React state, no lerp, no lag. Tip of the arrow sits at (0,0)
 * so it aligns perfectly with the actual pointer position.
 */
// Detect touch/mobile — no custom cursor needed there
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

export default function SimpleCursor() {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || isTouchDevice) return;

    const onMove = (e: MouseEvent) => {
      // translate3d forces GPU compositing for zero-lag movement
      el.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      if (el.style.opacity !== "1") el.style.opacity = "1";
    };
    const onLeave  = () => { el.style.opacity = "0"; };
    const onEnter  = () => { el.style.opacity = "1"; };

    window.addEventListener("mousemove",   onMove,  { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    return () => {
      window.removeEventListener("mousemove",   onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  if (isTouchDevice) return null;

  return (
    <div
      ref={elRef}
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         0,
        height:        0,
        pointerEvents: "none",
        zIndex:        999999,
        opacity:       0,
        willChange:    "transform",
      }}
    >
      {/* Arrow tip sits at (0,0) — aligns exactly with mouse hotspot */}
      <svg
        width="18"
        height="22"
        viewBox="0 0 18 22"
        fill="none"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* White outline for contrast on both dark and light backgrounds */}
        <path
          d="M1 1 L1 17 L5.5 12.5 L9 20.5 L12.5 19 L9 11.5 L15 11.5 Z"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Red fill */}
        <path
          d="M1 1 L1 17 L5.5 12.5 L9 20.5 L12.5 19 L9 11.5 L15 11.5 Z"
          fill="#ff1414"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
