import clsx from "clsx";

const ATS_COLORS: Record<string, string> = {
  greenhouse:    "bg-green-900 text-green-300",
  lever:         "bg-blue-900 text-blue-300",
  ashby:         "bg-purple-900 text-purple-300",
  remotive:      "bg-yellow-900 text-yellow-300",
  jobicy:        "bg-orange-900 text-orange-300",
  working_nomads:"bg-teal-900 text-teal-300",
  adzuna:        "bg-pink-900 text-pink-300",
  the_muse:      "bg-rose-900 text-rose-300",
  hn_hiring:     "bg-amber-900 text-amber-300",
  default:       "bg-gray-800 text-gray-300",
};

interface BadgeProps {
  ats: string;
  className?: string;
}

export function ATSBadge({ ats, className }: BadgeProps) {
  const color = ATS_COLORS[ats] ?? ATS_COLORS.default;
  return (
    <span className={clsx("px-1.5 py-0.5 rounded text-xs font-mono uppercase", color, className)}>
      {ats.replace(/_/g, " ")}
    </span>
  );
}

export function RemoteBadge() {
  return (
    <span className="px-1.5 py-0.5 rounded text-xs bg-cyan-900 text-cyan-300">
      Remote
    </span>
  );
}

export function YOEBadge({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return null;
  const label = min === max || max === null ? `${min}y` : `${min}–${max}y`;
  return (
    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
      {label}
    </span>
  );
}
