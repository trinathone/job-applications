import { useState, useRef, useEffect, useCallback } from "react";
import client from "../api/client";

type Provider = "anthropic" | "openai" | "gemini";

const PROVIDERS: { id: Provider; label: string; placeholder: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-..." },
  { id: "openai",    label: "GPT-4o (OpenAI)",    placeholder: "sk-..."     },
  { id: "gemini",    label: "Gemini (Google)",     placeholder: "AIza..."    },
];

const STORAGE_KEY = "ja-resume-brain";

function loadBrain(): { provider: Provider; key: string } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return { provider: "anthropic", key: "" }; }
}

export default function ResumeBuilderPage() {
  const saved = loadBrain();
  const [provider, setProvider] = useState<Provider>(saved.provider || "anthropic");
  const [apiKey, setApiKey]     = useState(saved.key || "");
  const [keyVisible, setKeyVisible] = useState(false);

  const [resumeText, setResumeText]         = useState("");
  const [writingRules, setWritingRules]     = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [latex, setLatex]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg]     = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, key: apiKey }));
  }, [provider, apiKey]);

  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => { setTestState("idle"); setTestMsg(""); }, [provider, apiKey]);

  const testKey = useCallback(async () => {
    if (!apiKey.trim()) { setTestState("fail"); setTestMsg("Enter a key first."); return; }
    setTestState("testing"); setTestMsg("");
    try {
      const res = await client.post("/resume/test-key", { provider, api_key: apiKey });
      if (res.data.ok) { setTestState("ok"); setTestMsg(res.data.message); }
      else             { setTestState("fail"); setTestMsg(res.data.message); }
    } catch {
      setTestState("fail"); setTestMsg("Connection error.");
    }
  }, [provider, apiKey]);

  async function generate() {
    if (!resumeText.trim() || !jobDescription.trim()) {
      setError("Resume text and job description are required.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Paste your API key in the Brain selector above.");
      return;
    }
    setError(null);
    setLoading(true);
    setLatex("");
    try {
      const res = await client.post("/resume/latex", {
        resume_text: resumeText,
        writing_rules: writingRules,
        job_description: jobDescription,
        provider,
        api_key: apiKey,
      });
      setLatex(res.data.latex);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to generate LaTeX.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLatex() {
    await navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12,
    fontFamily: "JetBrains Mono, monospace",
    color: "var(--text-2)",
    resize: "vertical",
    outline: "none",
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 9, fontWeight: 600,
    letterSpacing: "0.08em", textTransform: "uppercase",
    color: "var(--text-4)", marginBottom: 6,
  };

  const testBorder =
    testState === "ok"      ? "var(--border-2)" :
    testState === "fail"    ? "var(--border-2)" :
    "var(--border)";

  const testBtnStyle: React.CSSProperties =
    testState === "ok"      ? { background: "var(--surface-2)", color: "var(--text-1)", border: "1px solid var(--border-2)" } :
    testState === "fail"    ? { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" } :
    testState === "testing" ? { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)"  } :
    { background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--border)" };

  return (
    <div className="page-container">
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 64px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Resume Builder
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Choose your AI brain, paste resume + rules + JD — get LaTeX ready to compile.
          </p>
        </div>

        {/* Brain selector */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Brain</span>
            <span style={{ fontSize: 11, color: "var(--text-4)" }}>— choose which AI writes your resume</span>
          </div>

          {/* Provider tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  fontFamily: "JetBrains Mono, monospace",
                  background: provider === p.id ? "var(--surface-3)" : "transparent",
                  color: provider === p.id ? "var(--text-1)" : "var(--text-3)",
                  border: provider === p.id ? "1px solid var(--border-2)" : "1px solid var(--border)",
                  transition: "all 0.1s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* API Key input + Test button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type={keyVisible ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Your ${activeProvider.label} key — ${activeProvider.placeholder}`}
                style={{
                  ...inputStyle,
                  paddingRight: 48,
                  border: `1px solid ${testBorder}`,
                  resize: "none",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 12,
                }}
              />
              <button
                onClick={() => setKeyVisible(v => !v)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                  color: "var(--text-4)", background: "none", border: "none",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}
              >
                {keyVisible ? "hide" : "show"}
              </button>
            </div>

            <button
              onClick={testKey}
              disabled={testState === "testing" || !apiKey.trim()}
              style={{
                ...testBtnStyle,
                flexShrink: 0, padding: "7px 14px", borderRadius: 6,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 6, opacity: !apiKey.trim() ? 0.4 : 1,
              }}
            >
              {testState === "testing" && (
                <span className="animate-spin" style={{
                  display: "inline-block", width: 10, height: 10,
                  border: "2px solid var(--text-4)", borderTopColor: "var(--text-2)", borderRadius: "50%",
                }} />
              )}
              {testState === "ok"      && "✓ "}
              {testState === "fail"    && "✗ "}
              {testState === "testing" ? "Testing…" : testState === "ok" ? "Valid" : testState === "fail" ? "Failed" : "Test key"}
            </button>
          </div>

          {testMsg && (
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)" }}>
              {testMsg}
            </p>
          )}

          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "var(--text-4)", letterSpacing: "0.04em" }}>
            Key stored in your browser only — never logged on the server.
          </p>
        </div>

        {/* Three input boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { label: "My Resume (plain text)", value: resumeText, set: setResumeText, placeholder: "Paste your current resume as plain text...", mono: true },
            { label: "Writing Rules & Instructions", value: writingRules, set: setWritingRules, placeholder: "e.g.\n- Use action verbs\n- XYZ format\n- No 'responsible for'\n- Use moderncv LaTeX template", mono: false },
            { label: "Job Description", value: jobDescription, set: setJobDescription, placeholder: "Paste the full job description here...", mono: false },
          ].map(({ label, value, set, placeholder, mono }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={labelStyle}>{label}</p>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                rows={20}
                style={{ ...inputStyle, fontFamily: mono ? "JetBrains Mono, monospace" : "Inter, system-ui, sans-serif" }}
                onFocus={e => (e.target.style.borderColor = "var(--border-2)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
          ))}
        </div>

        {/* Generate */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={generate} disabled={loading} className="btn-primary">
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="animate-spin" style={{
                  display: "inline-block", width: 12, height: 12,
                  border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "currentColor", borderRadius: "50%",
                }} />
                Generating LaTeX…
              </span>
            ) : (
              `Generate LaTeX with ${activeProvider.label}`
            )}
          </button>
          {error && (
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-2)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Output */}
        {latex && (
          <div ref={outputRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={labelStyle}>LaTeX Output</p>
              <button
                onClick={copyLatex}
                className="btn-ghost"
                style={{ padding: "4px 12px", fontSize: 11 }}
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
            <textarea
              value={latex}
              readOnly
              rows={32}
              style={{
                ...inputStyle,
                color: "var(--text-1)",
                background: "var(--surface-2)",
              }}
            />
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)" }}>
              Compile with <code style={{ color: "var(--text-3)" }}>pdflatex resume.tex</code> or paste into Overleaf.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
