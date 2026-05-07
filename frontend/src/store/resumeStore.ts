import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ParsedResume {
  skills: string[];      // e.g. ["Python", "React", "AWS"]
  titles: string[];      // e.g. ["Software Engineer", "Full Stack Developer"]
  keywords: string[];    // other relevant terms
  yoe: number;           // years of experience
}

interface ResumeStore {
  resumeText: string;
  parsed: ParsedResume | null;
  isParsing: boolean;
  error: string | null;

  setResumeText(text: string): void;
  setParsed(parsed: ParsedResume): void;
  setIsParsing(v: boolean): void;
  setError(e: string | null): void;
  clear(): void;
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set) => ({
      resumeText: "",
      parsed: null,
      isParsing: false,
      error: null,

      setResumeText: (text) => set({ resumeText: text }),
      setParsed: (parsed) => set({ parsed, error: null }),
      setIsParsing: (v) => set({ isParsing: v }),
      setError: (e) => set({ error: e }),
      clear: () => set({ resumeText: "", parsed: null, error: null }),
    }),
    {
      name: "jam-resume",
      partialize: (s) => ({ resumeText: s.resumeText, parsed: s.parsed }),
    }
  )
);
