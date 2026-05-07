export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className="animate-spin"
      style={{ color: "var(--text-3)" }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="40 20" strokeLinecap="round" />
    </svg>
  );
}
