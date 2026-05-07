import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <p style={{ fontSize: 48, fontWeight: 700, color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}>404</p>
      <p style={{ fontSize: 14, color: "var(--text-4)" }}>Page not found</p>
      <Link to="/dashboard" style={{ fontSize: 13, color: "var(--text-2)" }}>← Back to dashboard</Link>
    </div>
  );
}
