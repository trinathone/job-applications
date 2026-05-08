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

interface VisitorSummary {
  id: number;
  name: string;
  email: string;
  role: "student" | "teacher" | "other";
  joined: string;
}

interface AdminData {
  users: UserSummary[];
  visitors: VisitorSummary[];
}

const emailKey = "jam-admin-email";
const passKey = "jam-admin-pass";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleLabel(role: VisitorSummary["role"]) {
  if (role === "student") return "Student";
  if (role === "teacher") return "Teacher";
  return "Other";
}

export default function AdminPage() {
  const [email, setEmail] = useState(() => sessionStorage.getItem(emailKey) ?? "");
  const [password, setPassword] = useState(() => sessionStorage.getItem(passKey) ?? "");
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftPassword, setDraftPassword] = useState("");
  const unlocked = email.length > 0 && password.length > 0;

  const headers = {
    "X-Admin-Email": email,
    "X-Admin-Password": password,
  };

  const { data, isLoading, error } = useQuery<AdminData>({
    queryKey: ["admin-data", email, unlocked],
    enabled: unlocked,
    queryFn: async () => {
      const [users, visitors] = await Promise.all([
        client.get<UserSummary[]>("/admin/users", { headers }),
        client.get<VisitorSummary[]>("/admin/visitors", { headers }),
      ]);
      return { users: users.data, visitors: visitors.data };
    },
    retry: false,
  });

  function unlock(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = draftEmail.trim().toLowerCase();
    sessionStorage.setItem(emailKey, cleanEmail);
    sessionStorage.setItem(passKey, draftPassword);
    setEmail(cleanEmail);
    setPassword(draftPassword);
  }

  function lock() {
    sessionStorage.removeItem(emailKey);
    sessionStorage.removeItem(passKey);
    setEmail("");
    setPassword("");
    setDraftEmail("");
    setDraftPassword("");
  }

  if (!unlocked) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={unlock} className="card" style={{ width: "min(380px, 100%)", padding: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
            Admin
          </h1>
          <input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            placeholder="Admin email"
            autoComplete="email"
            style={{
              width: "100%", padding: "11px 12px", borderRadius: 8,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              color: "var(--text-1)", marginBottom: 10,
            }}
          />
          <input
            type="password"
            value={draftPassword}
            onChange={(e) => setDraftPassword(e.target.value)}
            placeholder="Admin password"
            autoComplete="current-password"
            style={{
              width: "100%", padding: "11px 12px", borderRadius: 8,
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
          Loading...
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
          <button onClick={lock} className="btn-ghost">Try again</button>
        </div>
      </div>
    );
  }

  const visitors = data?.visitors ?? [];
  const users = data?.users ?? [];
  const studentCount = visitors.filter((v) => v.role === "student").length;
  const teacherCount = visitors.filter((v) => v.role === "teacher").length;

  return (
    <div className="page-container">
      <div className="page-inner">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 750, color: "var(--text-1)", marginBottom: 6 }}>
              Admin
            </h1>
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)", letterSpacing: "0.06em" }}>
              {visitors.length} visitors / {users.length} old accounts
            </p>
          </div>
          <button onClick={lock} className="btn-ghost">Lock</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
          {[
            ["Visitors", visitors.length],
            ["Students", studentCount],
            ["Teachers", teacherCount],
            ["Accounts", users.length],
          ].map(([label, value]) => (
            <div key={label} className="card" style={{ padding: 14 }}>
              <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "var(--text-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
              </p>
              <p style={{ marginTop: 8, fontSize: 24, fontWeight: 750, color: "var(--text-1)" }}>{value}</p>
            </div>
          ))}
        </div>

        <section className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Landing visitors</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Email", "Role", "Joined"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-4)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitors.map((v, idx) => (
                  <tr key={v.id} style={{ borderBottom: idx < visitors.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 650, color: "var(--text-1)" }}>{v.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-3)" }}>{v.email}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-2)" }}>{roleLabel(v.role)}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>{timeAgo(v.joined)}</td>
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 18, fontSize: 12, color: "var(--text-4)", textAlign: "center" }}>
                      No landing visitors yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Old login accounts</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["User", "Joined", "Applied", "Last active", "Status"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-4)", textAlign: i >= 2 && i !== 4 ? "right" : i === 4 ? "center" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.id} style={{ borderBottom: idx < users.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{u.display_name || u.email}</p>
                      {u.display_name && <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>{u.email}</p>}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>{timeAgo(u.joined)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: u.total_applied > 0 ? "var(--text-1)" : "var(--text-4)" }}>{u.total_applied}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>{u.last_applied ? timeAgo(u.last_applied) : "-"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: u.is_active ? "var(--text-2)" : "var(--text-4)" }} />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 18, fontSize: 12, color: "var(--text-4)", textAlign: "center" }}>
                      No old login accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
