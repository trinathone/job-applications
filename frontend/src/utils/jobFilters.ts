import type { Job } from "../types/job";
import type { FilterState } from "../store/filterStore";
import { distanceFromPA, isInternational } from "./locationUtils";
import { computeMatchScore } from "./matchScore";
import type { ParsedResume } from "../store/resumeStore";

const HOURS: Record<string, number> = { "1h": 1, "5h": 5, "12h": 12, "24h": 24, "3d": 72, "7d": 168, "30d": 720 };

export function applyFilters(
  jobs: Job[],
  filters: FilterState,
  resume?: ParsedResume | null,
  appliedJobIds?: Set<number>,
): Job[] {
  let result = [...jobs];

  // ── Hide applied ─────────────────────────────────────────────────────────────
  if (filters.hideApplied && appliedJobIds && appliedJobIds.size > 0) {
    result = result.filter((j) => !appliedJobIds.has(j.id));
  }

  // ── Date posted ──────────────────────────────────────────────────────────────
  if (filters.datePosted !== "all") {
    const cutoff = Date.now() - HOURS[filters.datePosted] * 3_600_000;
    result = result.filter((j) => new Date(j.scraped_at).getTime() >= cutoff);
  }

  // ── Min salary ───────────────────────────────────────────────────────────────
  if (filters.salaryMin > 0) {
    result = result.filter(
      (j) => j.salary_min != null && j.salary_min >= filters.salaryMin
    );
  }

  // ── USA only ─────────────────────────────────────────────────────────────────
  if (filters.usaOnly) {
    result = result.filter((j) => !isInternational(j.location));
  }

  // ── Company / title keyword search ───────────────────────────────────────────
  if (filters.company.trim()) {
    const q = filters.company.toLowerCase();
    result = result.filter(
      (j) =>
        j.company.name.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q)
    );
  }

  // ── Must Apply (match score >= 80) ───────────────────────────────────────────
  if (filters.mustApply && resume) {
    result = result.filter((j) => computeMatchScore(j, resume) >= 80);
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  switch (filters.sortBy) {
    case "date":
      result.sort(
        (a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
      );
      break;

    case "salary":
      // Jobs with salary listed first, then by salary desc, then salary-unknown last
      result.sort((a, b) => {
        const sa = a.salary_min ?? -1;
        const sb = b.salary_min ?? -1;
        return sb - sa;
      });
      break;

    case "distance":
      result.sort(
        (a, b) => distanceFromPA(a.location) - distanceFromPA(b.location)
      );
      break;

    case "yoe":
      // Entry-level first: null yoe_min jobs (no requirement) come first,
      // then sorted by yoe_min ascending
      result.sort((a, b) => (a.yoe_min ?? 0) - (b.yoe_min ?? 0));
      break;

    case "match":
      if (resume) {
        result.sort((a, b) => computeMatchScore(b, resume) - computeMatchScore(a, resume));
      }
      break;
  }

  return result;
}
