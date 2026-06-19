interface BadgeProps {
  label: string;
  variant?: "critical" | "high" | "medium" | "low" | "open" | "review" | "resolved" | "default" | "privileged";
}

const variants: Record<string, string> = {
  critical:   "bg-red-100 text-red-800 border border-red-300 font-semibold",
  high:       "bg-red-50 text-red-700 border border-red-200",
  medium:     "bg-orange-50 text-orange-700 border border-orange-200",
  low:        "bg-yellow-50 text-yellow-700 border border-yellow-200",
  open:       "bg-red-50 text-red-700 border border-red-200",
  review:     "bg-blue-50 text-blue-700 border border-blue-200",
  resolved:   "bg-green-50 text-green-700 border border-green-200",
  privileged: "bg-purple-50 text-purple-700 border border-purple-200",
  default:    "bg-slate-100 text-slate-600 border border-slate-200",
};

export function Badge({ label, variant = "default" }: BadgeProps) {
  const cls = variants[variant] ?? variants.default;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function riskVariant(level: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    Critical: "critical",
    High: "high",
    Medium: "medium",
    Low: "low",
  };
  return map[level] ?? "default";
}

export function statusVariant(status: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    Open: "open",
    "Under Review": "review",
    Resolved: "resolved",
  };
  return map[status] ?? "default";
}
