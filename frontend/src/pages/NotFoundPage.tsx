import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-5xl font-bold text-gray-700">404</p>
      <p className="text-gray-400">Page not found</p>
      <Link to="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
        ← Back to dashboard
      </Link>
    </div>
  );
}
