import { create } from "zustand";

export type SortBy = "date" | "salary" | "distance" | "yoe" | "match";
export type DateFilter = "all" | "1h" | "5h" | "12h" | "24h" | "3d" | "7d" | "30d";
export type RemoteFilter = "all" | "remote" | "onsite";

export interface FilterState {
  sortBy: SortBy;
  datePosted: DateFilter;
  remote: RemoteFilter;
  salaryMin: number; // 0 = no filter
  yoeMax: number | null; // null = any
  ats: string; // "" = all
  company: string; // search across company name + title
  usaOnly: boolean; // hide international postings
  mustApply: boolean; // show only match score >= 80
  hideApplied: boolean; // hide jobs already applied to
}

interface FilterStore extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

export const FILTER_DEFAULTS: FilterState = {
  sortBy: "date",
  datePosted: "all",
  remote: "all",
  salaryMin: 0,
  yoeMax: null,
  ats: "",
  company: "",
  usaOnly: true,
  mustApply: false,
  hideApplied: true,
};

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.sortBy !== "date") n++;
  if (f.datePosted !== "all") n++;
  if (f.remote !== "all") n++;
  if (f.salaryMin > 0) n++;
  if (f.yoeMax !== null) n++;
  if (f.ats !== "") n++;
  if (f.company.trim()) n++;
  if (!f.usaOnly) n++;
  if (f.mustApply) n++;
  if (!f.hideApplied) n++; // hiding applied is default ON, so OFF is non-default
  return n;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...FILTER_DEFAULTS,
  set: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set({ ...FILTER_DEFAULTS }),
}));
