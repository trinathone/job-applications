export type JobType = "full_time" | "part_time" | "contract";

const CONTRACT_RE  = /\b(contract(?:or|ing)?|c2c|corp[\s-]to[\s-]corp|1099|freelance|temp(?:orary)?|interim|locum)\b/i;
const PART_TIME_RE = /\bpart[\s-]time\b|parttime|\bpt\b/i;

export function detectJobType(title: string): JobType {
  if (CONTRACT_RE.test(title))  return "contract";
  if (PART_TIME_RE.test(title)) return "part_time";
  return "full_time";
}

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract:  "Contract",
};

// All styles are identical — monochrome only.
// Kept for API compatibility; consumers should use JOB_TYPE_LABEL only.
export const JOB_TYPE_STYLE: Record<JobType, { bg: string; color: string; border: string }> = {
  full_time: { bg: "var(--surface-2)", color: "var(--text-3)", border: "var(--border)" },
  part_time: { bg: "var(--surface-2)", color: "var(--text-3)", border: "var(--border)" },
  contract:  { bg: "var(--surface-2)", color: "var(--text-3)", border: "var(--border)" },
};
