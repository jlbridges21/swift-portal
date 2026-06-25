import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, getClientStatusLabel, normalizeStatus } from "@/lib/constants";

interface BadgeProps {
  status: string;
  className?: string;
  audience?: "admin" | "client";
}

export function StatusBadge({ status, className, audience = "admin" }: BadgeProps) {
  const normalized = normalizeStatus(status);
  const label = audience === "client" ? getClientStatusLabel(normalized) : getStatusLabel(normalized);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        getStatusColor(normalized),
        className
      )}
    >
      {label}
    </span>
  );
}

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
