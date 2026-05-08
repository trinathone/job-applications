import { create } from "zustand";
import type { Job } from "../types/job";

export interface AppliedJob {
  id: number;
  title: string;
  companyName: string;
  url: string;
  location: string | null;
  remote: boolean | null;
  ats: string;
  appliedAt: string;
}

const APPLIED_KEY = "ja-applied-jobs";

function readAppliedJobs(): AppliedJob[] {
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((job): job is AppliedJob =>
      typeof job?.id === "number" &&
      typeof job?.title === "string" &&
      typeof job?.companyName === "string" &&
      typeof job?.url === "string" &&
      typeof job?.appliedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeAppliedJobs(jobs: AppliedJob[]) {
  localStorage.setItem(APPLIED_KEY, JSON.stringify(jobs));
}

function toAppliedJob(job: Job): AppliedJob {
  return {
    id: job.id,
    title: job.title,
    companyName: job.company.name,
    url: job.url,
    location: job.location,
    remote: job.remote,
    ats: job.ats,
    appliedAt: new Date().toISOString(),
  };
}

const initialAppliedJobs = readAppliedJobs();
const initialAppliedIds = new Set(initialAppliedJobs.map((job) => job.id));

interface JobStore {
  jobs: Job[];
  selectedJobId: number | null;
  newJobCount: number;
  appliedJobIds:  Set<number>;
  appliedJobs: AppliedJob[];
  skippedJobIds:  Set<number>;

  setJobs(jobs: Job[]): void;
  appendJobs(jobs: Job[]): void;
  prependJobs(jobs: Job[]): void;
  selectJob(id: number | null): void;
  nextJob(): void;
  markDead(id: number): void;
  markApplied(job: Job): void;
  removeApplied(id: number): void;
  skipJob(id: number): void;
  undoSkip(id: number): void;
  resetNewCount(): void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJobId: null,
  newJobCount: 0,
  appliedJobIds: initialAppliedIds,
  appliedJobs: initialAppliedJobs,
  skippedJobIds: new Set(),

  setJobs(jobs) {
    const selectedJobId = get().selectedJobId;
    set({
      jobs,
      selectedJobId: selectedJobId && jobs.some((job) => job.id === selectedJobId)
        ? selectedJobId
        : jobs[0]?.id ?? null,
    });
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

  markApplied(job) {
    set((s) => {
      const next = new Set(s.appliedJobIds);
      next.add(job.id);
      const appliedJob = toAppliedJob(job);
      const appliedJobs = [
        appliedJob,
        ...s.appliedJobs.filter((item) => item.id !== job.id),
      ];
      writeAppliedJobs(appliedJobs);
      return { appliedJobIds: next, appliedJobs };
    });
  },

  removeApplied(id) {
    set((s) => {
      const next = new Set(s.appliedJobIds);
      next.delete(id);
      const appliedJobs = s.appliedJobs.filter((job) => job.id !== id);
      writeAppliedJobs(appliedJobs);
      return { appliedJobIds: next, appliedJobs };
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
