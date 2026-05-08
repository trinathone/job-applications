import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";
import LiveStatus from "../sidebar/LiveStatus";

type SystemStatus = "ok" | "degraded" | "down";

interface HealthData {
  status: SystemStatus;
}

function dotColor(status?: SystemStatus) {
  if (status === "ok") return "var(--text-2)";
  if (status === "degraded") return "var(--text-3)";
  return "var(--text-1)";
}

export default function FloatingStatus() {
  const [open, setOpen] = useState(false);
  const { data, error } = useQuery<HealthData>({
    queryKey: ["floating-health"],
    queryFn: async () => (await client.get("/health")).data,
    refetchInterval: 15_000,
    retry: false,
  });

  const status = error ? "down" : data?.status ?? "degraded";

  return (
    <div style={{
      position: "fixed",
      right: 16,
      bottom: 16,
      zIndex: 80,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 10,
      pointerEvents: "none",
    }}>
      {open && (
        <div style={{
          width: "min(360px, calc(100vw - 32px))",
          maxHeight: "min(620px, calc(100svh - 96px))",
          overflow: "auto",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.82)",
          pointerEvents: "auto",
        }}>
          <LiveStatus />
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          minWidth: 112,
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          padding: "0 13px",
          borderRadius: 999,
          border: "1px solid var(--border-2)",
          background: open ? "var(--text-1)" : "var(--surface)",
          color: open ? "var(--bg)" : "var(--text-1)",
          boxShadow: "0 10px 34px rgba(0,0,0,0.5)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          pointerEvents: "auto",
          touchAction: "manipulation",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: open ? "var(--bg)" : dotColor(status),
            display: "inline-block",
            animation: status === "down" ? "pulse 1.4s infinite" : "none",
          }}
        />
        Status
      </button>
    </div>
  );
}
