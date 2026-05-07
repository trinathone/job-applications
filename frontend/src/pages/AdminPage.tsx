import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import client from "../api/client";

interface UserSummary {
  id: number;
  email: string;
  display_name: string | null;
  is_active: boolean;
  joined: string;
  total_applied: number;
  last_applied: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("jam-admin-pass") ?? "");
  const [draft, setDraft] = useState("");
  const unlocked = password.length > 0;
  const { data, isLoading, error } = useQuery<UserSummary[]>({
    queryKey: ["admin-users", unlocked],
    enabled: unlocked,
    queryFn: async () => (
      await client.get("/admin/users", { headers: { "X-Admin-Password": password } })
    ).data,
    retry: false,
  });

  function unlock(e: FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("jam-admin-pass", draft);
    setPassword(draft);
  }

  if (!unlocked) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={unlock} className="card" style={{ width: 340, padding: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
            Admin
          </h1>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Admin password"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              color: "var(--text-1)", marginBottom: 12,
            }}
          />
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-4)", letterSpacing: "0.06em" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (error) {
    const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>{msg || "Access denied or API error."}</p>
          <button
            onClick={() => {
              sessionStorage.removeItem("jam-admin-pass");
              setPassword("");
              setDraft("");
            }}
            className="btn-ghost"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-inner">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Users
          </h1>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)", letterSpacing: "0.06em" }}>
            {data?.length ?? 0} registered accounts
          </p>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["User", "Joined", "Applied", "Last active", "Status"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      fontSize: 9, fontWeight: 600,
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--text-4)",
                      textAlign: i >= 2 && i !== 4 ? "right" : i === 4 ? "center" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map((u, idx) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: idx < (data.length - 1) ? "1px solid var(--border)" : "none",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                      {u.display_name || u.email}
                    </p>
                    {u.display_name && (
                      <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>{u.email}</p>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>
                      {timeAgo(u.joined)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 13, fontWeight: 700,
                      color: u.total_applied > 0 ? "var(--text-1)" : "var(--text-4)",
                    }}>
                      {u.total_applied}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>
                      {u.last_applied ? timeAgo(u.last_applied) : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                        background: u.is_active ? "var(--text-2)" : "var(--text-4)",
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
