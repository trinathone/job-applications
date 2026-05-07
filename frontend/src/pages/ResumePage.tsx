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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">My Resume</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste your resume text — Claude extracts your skills and scores every job in the feed.
        </p>
      </div>

      {/* Parsed keywords */}
      {parsed && (
        <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Extracted Keywords</p>
          <div className="space-y-2">
            <KeywordRow label="Skills" chips={parsed.skills} color="bg-blue-900/50 text-blue-300 border-blue-700" />
            <KeywordRow label="Titles" chips={parsed.titles} color="bg-purple-900/50 text-purple-300 border-purple-700" />
            <KeywordRow label="Keywords" chips={parsed.keywords} color="bg-gray-800 text-gray-300 border-gray-600" />
            <p className="text-xs text-gray-500 mt-1">Experience: <span className="text-gray-300">{parsed.yoe} years</span></p>
          </div>
          <p className="text-xs text-green-400 mt-3">✓ Match scores are now showing on job cards. Use "Sort → Match score" in the feed.</p>
        </div>
      )}

      {/* Error */}
      {error && <p className="mb-4 text-sm text-red-400 bg-red-900/20 rounded p-3 border border-red-800">{error}</p>}

      {/* Textarea */}
      <textarea
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        placeholder="Paste your full resume here — or use the file button to upload a .txt file..."
        rows={18}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y font-mono leading-relaxed"
      />

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleParse}
          disabled={isParsing || !resumeText.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          {isParsing ? "Parsing with Claude…" : "Parse Resume"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700"
        >
          Upload .txt
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.text" className="hidden" onChange={handleFile} />
        {(resumeText || parsed) && (
          <button onClick={clear} className="px-4 py-2 text-gray-500 hover:text-red-400 text-sm">
            Clear
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto">
          {resumeText.length > 0 ? `${resumeText.length.toLocaleString()} chars` : ""}
        </span>
      </div>
    </div>
  );
}

function KeywordRow({ label, chips, color }: { label: string; chips: string[]; color: string }) {
  if (!chips?.length) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span key={c} className={`text-xs px-2 py-0.5 rounded border ${color}`}>{c}</span>
        ))}
      </div>
    </div>
  );
}
