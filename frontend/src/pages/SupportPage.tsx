const SUPPORT_LINKS = [
  {
    label: "LinkedIn",
    value: "linkedin.com/in/neverest",
    href: "https://linkedin.com/in/neverest/",
    primary: true,
  },
  {
    label: "Telegram",
    value: "@TNT3ME",
    href: "https://t.me/TNT3ME",
    primary: false,
  },
  {
    label: "Email",
    value: "trinath.connect@proton.me",
    href: "mailto:trinath.connect@proton.me",
    primary: false,
  },
];

export default function SupportPage() {
  return (
    <main style={{
      minHeight: "100%",
      background: "var(--bg)",
      color: "var(--text-1)",
      overflow: "auto",
    }}>
      <section style={{
        minHeight: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: 28,
        alignItems: "stretch",
        padding: "clamp(20px, 5vw, 72px)",
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 520,
        }}>
          <div>
            <p style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--text-4)",
              marginBottom: 22,
            }}>
              support
            </p>
            <h1 style={{
              maxWidth: 760,
              fontSize: "clamp(44px, 8vw, 112px)",
              lineHeight: 0.92,
              fontWeight: 900,
              letterSpacing: 0,
            }}>
              Need help getting unstuck?
            </h1>
            <p style={{
              maxWidth: 560,
              marginTop: 28,
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--text-3)",
            }}>
              Reach out directly. LinkedIn is the best place for context, Telegram is fastest, email is steady.
            </p>
          </div>

          <a
            href="https://linkedin.com/in/neverest/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 10,
              marginTop: 36,
              padding: "13px 18px",
              borderRadius: 8,
              background: "var(--text-1)",
              color: "var(--bg)",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Connect on LinkedIn
          </a>
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
        }}>
          {SUPPORT_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("mailto:") ? undefined : "_blank"}
              rel={link.href.startsWith("mailto:") ? undefined : "noreferrer"}
              style={{
                display: "block",
                padding: "18px",
                borderRadius: 8,
                border: link.primary ? "1px solid var(--border-2)" : "1px solid var(--border)",
                background: link.primary ? "var(--surface-3)" : "var(--surface)",
                textDecoration: "none",
                color: "var(--text-1)",
              }}
            >
              <p style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--text-4)",
                marginBottom: 8,
              }}>
                {link.label}
              </p>
              <p style={{ fontSize: 18, fontWeight: 800, overflowWrap: "anywhere" }}>
                {link.value}
              </p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
