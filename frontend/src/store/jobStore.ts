import { create } from "zustand";
import type { Job } from "../types/job";

interface JobStore {
  jobs: Job[];
  selectedJobId: number | null;
  newJobCount: number;
  appliedJobIds: Set<number>;   // tracks jobs acted on this session

  setJobs(jobs: Job[]): void;
  appendJobs(jobs: Job[]): void;
  prependJobs(jobs: Job[]): void;
  selectJob(id: number | null): void;
  nextJob(): void;
  markDead(id: number): void;
  markApplied(id: number): void;
  resetNewCount(): void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJobId: null,
  newJobCount: 0,
  appliedJobIds: new Set(),

  setJobs(jobs) {
    set({ jobs, selectedJobId: jobs[0]?.id ?? null });
  },

  appendJobs(newJobs) {
    set((s) => {
      const existingIds = new Set(s.jobs.map((j) => j.id));
      const unique = newJobs.filter((j) => !existingIds.has(j.id));
      return { jobs: [...s.jobs, ...unique] };
    });
  },

  prependJobs(newJobs) {
    set((s) => ({
      jobs: [...newJobs, ...s.jobs],
      newJobCount: s.newJobCount + newJobs.length,
    }));
  },

  selectJob(id) {
    set({ selectedJobId: id });
  },

  nextJob() {
    const { jobs, selectedJobId } = get();
    const idx = jobs.findIndex((j) => j.id === selectedJobId);
    const next = jobs[idx + 1];
    if (next) set({ selectedJobId: next.id });
  },

  markDead(id) {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, is_dead: true } : j)),
    }));
  },

  markApplied(id) {
    set((s) => {
      const next = new Set(s.appliedJobIds);
      next.add(id);
      return { appliedJobIds: next };
    });
  },

  resetNewCount() {
    set({ newJobCount: 0 });
  },
}));
