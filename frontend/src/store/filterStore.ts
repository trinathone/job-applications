import { create } from "zustand";
import type { JobType } from "../utils/jobType";

export type SortBy        = "date" | "salary" | "distance" | "yoe" | "match";
export type DateFilter    = "all" | "1h" | "5h" | "12h" | "24h" | "3d" | "7d" | "30d";
export type RemoteFilter  = "all" | "remote" | "onsite";
export type JobTypeFilter = "all" | JobType;
export type CountryFilter = "all" | "usa" | "india";

export interface FilterState {
  sortBy:      SortBy;
  datePosted:  DateFilter;
  remote:      RemoteFilter;
  jobType:     JobTypeFilter;
  country:     CountryFilter;   // replaces usaOnly boolean
  salaryMin:   number;
  yoeMax:      number | null;
  ats:         string;
  company:     string;
  mustApply:   boolean;
  hideApplied: boolean;
}

interface FilterStore extends FilterState {
  set:   (patch: Partial<FilterState>) => void;
  reset: () => void;
}

export const FILTER_DEFAULTS: FilterState = {
  sortBy:      "date",
  datePosted:  "all",
  remote:      "all",
  jobType:     "all",
  country:     "usa",
  salaryMin:   0,
  yoeMax:      null,
  ats:         "",
  company:     "",
  mustApply:   false,
  hideApplied: true,
};

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.sortBy     !== "date")  n++;
  if (f.datePosted !== "all")   n++;
  if (f.remote     !== "all")   n++;
  if (f.jobType    !== "all")   n++;
  if (f.country    !== "usa")   n++;   // "usa" is default ON
  if (f.salaryMin  >  0)        n++;
  if (f.yoeMax     !== null)    n++;
  if (f.ats        !== "")      n++;
  if (f.company.trim())         n++;
  if (f.mustApply)              n++;
  if (!f.hideApplied)           n++;
  return n;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...FILTER_DEFAULTS,
  set:   (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set({ ...FILTER_DEFAULTS }),
}));
