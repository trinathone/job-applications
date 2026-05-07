// Strict monochrome badges — no colors, only var(--*) tokens.
const base: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 9, fontWeight: 400,
  letterSpacing: "0.06em", textTransform: "uppercase",
  padding: "2px 6px", borderRadius: 4,
  whiteSpace: "nowrap",
  background: "var(--surface-2)",
  color: "var(--text-3)",
  border: "1px solid var(--border)",
};

export function ATSBadge({ ats }: { ats: string }) {
  return <span style={base}>{ats.replace(/_/g, " ")}</span>;
}

export function RemoteBadge() {
  return (
    <span style={{ ...base, fontWeight: 600, color: "var(--text-2)", border: "1px solid var(--border-2)" }}>
      remote
    </span>
  );
}

export function YOEBadge({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return null;
  const label = min === max || max === null ? `${min}y` : `${min}–${max}y`;
  return <span style={base}>{label}</span>;
}
