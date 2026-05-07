import { create } from "zustand";
import type { Job } from "../types/job";

interface JobStore {
  jobs: Job[];
  selectedJobId: number | null;
  newJobCount: number;
  appliedJobIds:  Set<number>;
  skippedJobIds:  Set<number>;

  setJobs(jobs: Job[]): void;
  appendJobs(jobs: Job[]): void;
  prependJobs(jobs: Job[]): void;
  selectJob(id: number | null): void;
  nextJob(): void;
  markDead(id: number): void;
  markApplied(id: number): void;
  skipJob(id: number): void;
  undoSkip(id: number): void;
  resetNewCount(): void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJobId: null,
  newJobCount: 0,
  appliedJobIds: new Set(),
  skippedJobIds: new Set(),

  setJobs(jobs) {
    set({ jobs, selectedJobId: jobs[0]?.id ?? null });
  },

  appendJobs(newJobs) {
    set((s) => {
      const existing = new Set(s.jobs.map((j) => j.id));
      return { jobs: [...s.jobs, ...newJobs.filter((j) => !existing.has(j.id))] };
    });
  },

  prependJobs(newJobs) {
    set((s) => ({
      jobs: [...newJobs, ...s.jobs],
      newJobCount: s.newJobCount + newJobs.length,
    }));
  },

  selectJob(id) { set({ selectedJobId: id }); },

  nextJob() {
    const { jobs, selectedJobId, skippedJobIds, appliedJobIds } = get();
    const idx = jobs.findIndex((j) => j.id === selectedJobId);
    for (let i = idx + 1; i < jobs.length; i++) {
      const j = jobs[i];
      if (!skippedJobIds.has(j.id) && !appliedJobIds.has(j.id)) {
        set({ selectedJobId: j.id });
        return;
      }
    }
    set({ selectedJobId: null });
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

  skipJob(id) {
    set((s) => {
      const next = new Set(s.skippedJobIds);
      next.add(id);
      return { skippedJobIds: next };
    });
    get().nextJob();
  },

  /** Undo: remove from skipped set and restore selection */
  undoSkip(id) {
    set((s) => {
      const next = new Set(s.skippedJobIds);
      next.delete(id);
      return { skippedJobIds: next, selectedJobId: id };
    });
  },

  resetNewCount() { set({ newJobCount: 0 }); },
}));
