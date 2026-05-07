import { useState, useRef, useEffect } from "react";
import client from "../api/client";

type Provider = "anthropic" | "openai" | "gemini";

const PROVIDERS: { id: Provider; label: string; placeholder: string; color: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-...", color: "border-orange-500 text-orange-400" },
  { id: "openai",    label: "GPT-4o (OpenAI)",    placeholder: "sk-...",     color: "border-green-500 text-green-400" },
  { id: "gemini",    label: "Gemini (Google)",     placeholder: "AIza...",    color: "border-blue-500 text-blue-400" },
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

  const [resumeText, setResumeText]       = useState("");
  const [writingRules, setWritingRules]   = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [latex, setLatex]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Persist brain selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, key: apiKey }));
  }, [provider, apiKey]);

  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

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

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Resume Builder</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose your AI brain, paste resume + rules + JD — get LaTeX ready to compile.
          </p>
        </div>

        {/* ── Brain selector ── */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-200">Brain</span>
            <span className="text-xs text-gray-500">— choose which AI writes your resume</span>
          </div>

          {/* Provider tabs */}
          <div className="flex gap-2 flex-wrap">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  provider === p.id
                    ? `${p.color} bg-gray-800`
                    : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* API Key input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={keyVisible ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Your ${activeProvider.label} key — ${activeProvider.placeholder}`}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500 pr-20"
              />
              <button
                onClick={() => setKeyVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 px-2 py-0.5"
              >
                {keyVisible ? "hide" : "show"}
              </button>
            </div>
            {apiKey && (
              <span className={`text-xs font-medium ${activeProvider.color.split(" ")[1]}`}>
                key set
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">
            Key is stored in your browser only — never sent to our server in plaintext (it goes directly to the AI provider via our API).
          </p>
        </div>

        {/* ── Three input boxes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              My Resume (plain text)
            </label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your current resume as plain text..."
              rows={20}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              My Writing Rules &amp; Instructions
            </label>
            <textarea
              value={writingRules}
              onChange={(e) => setWritingRules(e.target.value)}
              placeholder={`e.g.\n- Use action verbs\n- XYZ format: Accomplished [X] by doing [Y] resulting in [Z]\n- No "responsible for"\n- Use moderncv LaTeX template\n- Keep bullets to one line\n- Tailor to keywords in JD`}
              rows={20}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={20}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Generate */}
        <div className="flex items-center gap-4">
          <button
            onClick={generate}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Generating LaTeX…
              </span>
            ) : (
              `Generate LaTeX with ${activeProvider.label}`
            )}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Output */}
        {latex && (
          <div ref={outputRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                LaTeX Output
              </label>
              <button
                onClick={copyLatex}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors font-medium"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
            <textarea
              value={latex}
              readOnly
              rows={32}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-green-300 font-mono resize-none focus:outline-none"
            />
            <p className="text-xs text-gray-600">
              Compile with <code className="text-gray-400">pdflatex resume.tex</code> or paste into{" "}
              <span className="text-gray-400">Overleaf</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
