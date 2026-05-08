import type { Job } from "../types/job";
import type { FilterState } from "../store/filterStore";
import { distanceFromPA, isInternational, isIndia } from "./locationUtils";
import { computeMatchScore } from "./matchScore";
import { detectJobType } from "./jobType";
import type { ParsedResume } from "../store/resumeStore";

const HOURS: Record<string, number> = {
  "1h": 1, "5h": 5, "12h": 12, "24h": 24, "3d": 72, "7d": 168, "30d": 720,
};

function jobFreshnessTime(job: Job): number {
  return new Date(job.posted_at ?? job.scraped_at).getTime();
}

export function applyFilters(
  jobs: Job[],
  filters: FilterState,
  resume?: ParsedResume | null,
  appliedJobIds?: Set<number>,
  skippedJobIds?: Set<number>,
): Job[] {
  let result = [...jobs];

  // ── Always hide skipped ──────────────────────────────────────────────────────
  if (skippedJobIds && skippedJobIds.size > 0) {
    result = result.filter((j) => !skippedJobIds.has(j.id));
  }

  // ── Hide applied ─────────────────────────────────────────────────────────────
  if (filters.hideApplied && appliedJobIds && appliedJobIds.size > 0) {
    result = result.filter((j) => !appliedJobIds.has(j.id));
  }

  // ── Date posted ──────────────────────────────────────────────────────────────
  if (filters.datePosted !== "all") {
    const cutoff = Date.now() - HOURS[filters.datePosted] * 3_600_000;
    result = result.filter((j) => jobFreshnessTime(j) >= cutoff);
  }

  // ── Country filter (replaces usaOnly boolean) ─────────────────────────────
  if (filters.country === "usa") {
    result = result.filter((j) => !isInternational(j.location));
  } else if (filters.country === "india") {
    result = result.filter((j) => isIndia(j.location) || /\bremote\b/i.test(j.location ?? ""));
  }
  // "all" → no filter

  // ── Min salary ───────────────────────────────────────────────────────────────
  if (filters.salaryMin > 0) {
    result = result.filter((j) => j.salary_min != null && j.salary_min >= filters.salaryMin);
  }

  // ── Job type ─────────────────────────────────────────────────────────────────
  if (filters.jobType !== "all") {
    result = result.filter((j) => detectJobType(j.title) === filters.jobType);
  }

  // ── Company / title keyword search ───────────────────────────────────────────
  if (filters.company.trim()) {
    const q = filters.company.toLowerCase();
    result = result.filter(
      (j) => j.company.name.toLowerCase().includes(q) || j.title.toLowerCase().includes(q),
    );
  }

  // ── Must Apply (match score ≥ 80) ────────────────────────────────────────────
  if (filters.mustApply && resume) {
    result = result.filter((j) => (computeMatchScore(j, resume) ?? 0) >= 80);
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  switch (filters.sortBy) {
    case "date":
      result.sort((a, b) => jobFreshnessTime(b) - jobFreshnessTime(a));
      break;
    case "salary":
      result.sort((a, b) => (b.salary_min ?? -1) - (a.salary_min ?? -1));
      break;
    case "distance":
      result.sort((a, b) => distanceFromPA(a.location) - distanceFromPA(b.location));
      break;
    case "yoe":
      result.sort((a, b) => (a.yoe_min ?? 0) - (b.yoe_min ?? 0));
      break;
    case "match":
      if (resume) {
        result.sort((a, b) => (computeMatchScore(b, resume) ?? 0) - (computeMatchScore(a, resume) ?? 0));
      }
      break;
  }

  return result;
}
