import { useQuery } from "@tanstack/react-query";
import client from "../api/client";

interface UserSummary {
  id: number;
  email: string;
  display_name: string | null;
  is_active: boolean;
  joined: string;
  total_applied: number;
  last_applied: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminPage() {
  const { data, isLoading, error } = useQuery<UserSummary[]>({
    queryKey: ["admin-users"],
    queryFn: async () => (await client.get("/admin/users")).data,
    retry: false,
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500 animate-pulse">Loading users…</div>;
  }

  if (error) {
    const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    return (
      <div className="p-8 text-sm text-red-400">
        {msg || "Access denied or API error."}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data?.length ?? 0} registered accounts</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
                <th className="text-right px-4 py-3 font-medium">Applied</th>
                <th className="text-right px-4 py-3 font-medium">Last active</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-gray-200 font-medium">{u.display_name || u.email}</p>
                    {u.display_name && (
                      <p className="text-xs text-gray-500">{u.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {timeAgo(u.joined)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${u.total_applied > 0 ? "text-green-400" : "text-gray-600"}`}>
                      {u.total_applied}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {u.last_applied ? timeAgo(u.last_applied) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${u.is_active ? "bg-green-400" : "bg-gray-600"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
