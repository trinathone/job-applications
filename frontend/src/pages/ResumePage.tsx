import { useRef } from "react";
import { useResumeStore } from "../store/resumeStore";
import client from "../api/client";

export default function ResumePage() {
  const { resumeText, parsed, isParsing, error, setResumeText, setParsed, setIsParsing, setError, clear } = useResumeStore();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleParse() {
    if (!resumeText.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const { data } = await client.post("/users/resume/parse", { text: resumeText });
      setParsed(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Parse failed. Try again.");
    } finally {
      setIsParsing(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setResumeText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }

  return (
    <div className="page-container">
      <div className="page-inner" style={{ maxWidth: 720 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: 6 }}>
            My Resume
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
            Paste your resume text — we extract your skills and score every job in the feed.
          </p>
        </div>

        {/* Parsed keywords */}
        {parsed && (
          <div
            className="card"
            style={{ padding: "16px 20px", marginBottom: 24 }}
          >
            <p style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 9,
              fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--text-3)", marginBottom: 14,
            }}>
              Extracted Keywords
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <KeywordRow label="Skills"   chips={parsed.skills}   color="var(--text-1)" bg="var(--surface-3)" border="var(--border-2)" />
              <KeywordRow label="Titles"   chips={parsed.titles}   color="var(--text-2)" bg="var(--surface-2)" border="var(--border)" />
              <KeywordRow label="Keywords" chips={parsed.keywords} color="var(--text-3)" bg="var(--surface-2)" border="var(--border)" />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>
              Experience: <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{parsed.yoe} years</span>
            </p>
            <p style={{
              fontSize: 11, color: "var(--text-2)", marginTop: 10,
              fontFamily: "JetBrains Mono, monospace",
            }}>
              ✓ Match scores are now showing on job cards. Use "Sort → Match" in the feed.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border-2)",
            fontSize: 13, color: "var(--text-2)",
          }}>
            {error}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={resumeText}
          onChange={e => setResumeText(e.target.value)}
          placeholder="Paste your full resume here — or use the file button to upload a .txt file..."
          rows={18}
          style={{
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1.7,
            color: "var(--text-2)",
            outline: "none",
            resize: "vertical",
          }}
          onFocus={e => (e.target.style.borderColor = "var(--border-2)")}
          onBlur={e => (e.target.style.borderColor = "var(--border)")}
        />

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <button
            onClick={handleParse}
            disabled={isParsing || !resumeText.trim()}
            className="btn-primary"
          >
            {isParsing ? "Parsing…" : "Parse Resume"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost"
          >
            Upload .txt
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,.text" style={{ display: "none" }} onChange={handleFile} />
          {(resumeText || parsed) && (
            <button
              onClick={clear}
              style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", padding: "7px 8px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
            >
              Clear
            </button>
          )}
          {resumeText.length > 0 && (
            <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)" }}>
              {resumeText.length.toLocaleString()} chars
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KeywordRow({ label, chips, color, bg, border }: {
  label: string; chips: string[]; color: string; bg: string; border: string;
}) {
  if (!chips?.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{
        fontFamily: "JetBrains Mono, monospace", fontSize: 9,
        letterSpacing: "0.07em", textTransform: "uppercase",
        color: "var(--text-4)", width: 56, flexShrink: 0, paddingTop: 3,
      }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {chips.map(c => (
          <span key={c} style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 5,
            background: bg, color, border: `1px solid ${border}`,
          }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
