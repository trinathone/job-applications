import { useQuery } from "@tanstack/react-query";
import { listApplications } from "../api/applications";
import type { Application } from "../types/application";

export default function WeeklyPage() {
  const { data: apps } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: listApplications,
  });

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);

  const thisWeek = (apps ?? []).filter(
    (a) => new Date(a.session_date) >= monday
  );

  const byStatus = thisWeek.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const applied = byStatus.applied ?? 0;
  const interviewing = byStatus.interviewing ?? 0;
  const offers = byStatus.offer ?? 0;
  const rejected = byStatus.rejected ?? 0;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-100 mb-1">Weekly Review</h1>
      <p className="text-sm text-gray-500 mb-6">
        Week of {monday.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <Card label="Applied" value={applied} color="text-blue-400" />
        <Card label="Interviewing" value={interviewing} color="text-yellow-400" />
        <Card label="Offers" value={offers} color="text-green-400" />
        <Card label="Rejected" value={rejected} color="text-red-400" />
      </div>

      <h2 className="text-sm font-semibold text-gray-300 mb-3">This week's applications</h2>
      {thisWeek.length === 0 ? (
        <p className="text-sm text-gray-500">No applications this week yet. Press A on a job to apply.</p>
      ) : (
        <div className="space-y-2">
          {thisWeek.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-900 rounded-lg">
              <span className="text-sm text-gray-300">Job #{a.job_id}</span>
              <StatusChip status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-900 text-blue-300",
  interviewing: "bg-yellow-900 text-yellow-300",
  offer: "bg-green-900 text-green-300",
  rejected: "bg-red-900 text-red-300",
  saved: "bg-gray-800 text-gray-400",
  skipped: "bg-gray-800 text-gray-500",
  archived: "bg-gray-800 text-gray-500",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${STATUS_COLORS[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  );
}
