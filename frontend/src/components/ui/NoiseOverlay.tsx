/**
 * NoiseOverlay — animated film grain texture, rabenrifaie-style.
 * A 300×300 SVG feTurbulence tile, scaled 200% and translated randomly
 * every frame step to create the classic film grain shimmer.
 */
export default function NoiseOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: "-50%",
        left: "-50%",
        width: "200%",
        height: "200%",
        pointerEvents: "none",
        zIndex: 9997,
        opacity: 0.045,
        animation: "grain 0.9s steps(1) infinite",
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
