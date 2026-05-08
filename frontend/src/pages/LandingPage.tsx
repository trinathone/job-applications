import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveVisitorLead, type VisitorRole } from "../api/visitors";

const STORAGE_KEY = "ja-visitor";

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.16)", paddingTop: 14 }}>
      <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0, color: "white" }}>{value}</p>
      <p style={{
        marginTop: 4,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.46)",
      }}>
        {label}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VisitorRole>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email needed.");
      return;
    }

    const lead = { name: name.trim(), email: email.trim().toLowerCase(), role };
    setBusy(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
    try {
      await saveVisitorLead(lead);
    } catch {
      // Do not block the user if lead capture is temporarily unavailable.
    } finally {
      setBusy(false);
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <main className="landing-page" style={{
      minHeight: "100svh",
      background: "#050505",
      color: "white",
      display: "grid",
      overflow: "hidden",
    }}>
      <section className="landing-hero" style={{
        position: "relative",
        padding: "min(8vw, 88px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100svh",
      }}>
        <div className="landing-metrics" style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px),
            radial-gradient(circle at 30% 20%, rgba(255,255,255,0.24), transparent 28%),
            radial-gradient(circle at 70% 70%, rgba(255,255,255,0.14), transparent 32%)
          `,
          backgroundSize: "52px 52px, 52px 52px, 100% 100%, 100% 100%",
          opacity: 0.72,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.48)",
            marginBottom: 28,
          }}>
            JA job signal
          </p>
          <h1 style={{
            maxWidth: 780,
            fontSize: "clamp(54px, 8vw, 124px)",
            lineHeight: 0.86,
            fontWeight: 900,
            letterSpacing: 0,
            color: "white",
          }}>
            Jobs first. Login never.
          </h1>
          <p style={{
            maxWidth: 560,
            marginTop: 30,
            fontSize: "clamp(17px, 2vw, 23px)",
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.68)",
          }}>
            Live software jobs gathered into one sharp board. No account wall, no waiting room.
          </p>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 26,
          }}>
            <a
              href="https://linkedin.com/in/neverest/"
              target="_blank"
              rel="noreferrer"
              style={heroLinkStyle}
            >
              LinkedIn
            </a>
            <a href="https://t.me/TNT3ME" target="_blank" rel="noreferrer" style={heroLinkStyle}>
              Telegram
            </a>
            <a href="mailto:trinath.connect@proton.me" style={heroLinkStyle}>
              Email
            </a>
          </div>
        </div>

        <div style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 22,
          maxWidth: 720,
        }}>
          <Metric value="1x" label="cloud run daily" />
          <Metric value="7d" label="rolling job window" />
          <Metric value="0$" label="public access" />
        </div>
      </section>

      <section className="landing-form-panel" style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        padding: "32px",
        background: "rgba(255,255,255,0.045)",
        borderLeft: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(18px)",
      }}>
        <form onSubmit={enter} style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          <div style={{ marginBottom: 18 }}>
            <p style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.42)",
              marginBottom: 10,
            }}>
              tiny door
            </p>
            <h2 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: "white" }}>
              Tell us who is entering.
            </h2>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            style={inputStyle}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {(["student", "teacher", "other"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: role === item ? "1px solid white" : "1px solid rgba(255,255,255,0.16)",
                  background: role === item ? "white" : "rgba(255,255,255,0.06)",
                  color: role === item ? "black" : "rgba(255,255,255,0.72)",
                  fontWeight: 700,
                  textTransform: "capitalize",
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)" }}>{error}</p>
          )}

          <button
            disabled={busy}
            style={{
              marginTop: 8,
              height: 52,
              borderRadius: 8,
              border: "none",
              background: "white",
              color: "black",
              fontWeight: 800,
              fontSize: 15,
              opacity: busy ? 0.62 : 1,
            }}
          >
            {busy ? "Opening..." : "Open job board"}
          </button>

          <p style={{
            marginTop: 10,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            lineHeight: 1.7,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.32)",
          }}>
            We ask this once so the board can learn who it helps.
          </p>
        </form>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.22)",
  color: "white",
  padding: "0 14px",
  outline: "none",
  fontSize: 15,
};

const heroLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.78)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};
