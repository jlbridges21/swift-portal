import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoogleIndexState, HealthStatus } from "@/lib/seo-growth/health";
import type { EvidenceType, Level } from "@/lib/seo-growth/opportunities";
import { EVIDENCE_LABELS } from "@/lib/seo-growth/opportunities";
import { SAMPLE_LABELS, type SampleConfidence } from "@/lib/seo-growth/conversions";

const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
  unknown: "Unknown",
};

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  healthy: "#10B981",
  attention: "#F59E0B",
  critical: "#E11D48",
  unknown: "#94A3B8",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const Icon = status === "healthy" ? CheckCircle2 : status === "critical" ? XCircle : status === "attention" ? AlertTriangle : CircleHelp;
  return (
    <span
      className={cn(
        chip,
        status === "healthy" && "bg-emerald-50 text-emerald-700",
        status === "attention" && "bg-amber-50 text-amber-800",
        status === "critical" && "bg-rose-50 text-rose-700",
        status === "unknown" && "bg-subtle text-muted"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {HEALTH_LABELS[status]}
    </span>
  );
}

export function GoogleBadge({ state, label }: { state: GoogleIndexState; label: string }) {
  return (
    <span
      className={cn(
        chip,
        state === "indexed" && "bg-emerald-50 text-emerald-700",
        (state === "waiting" || state === "unknown_to_google") && "bg-sky-50 text-sky-800",
        (state === "crawled_not_indexed" || state === "excluded") && "bg-rose-50 text-rose-700",
        (state === "not_checked" || state === "error") && "bg-subtle text-muted"
      )}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Level }) {
  return (
    <span
      className={cn(
        chip,
        priority === "high" && "bg-indigo-600 text-white",
        priority === "medium" && "bg-indigo-50 text-indigo-700",
        priority === "low" && "bg-subtle text-muted"
      )}
    >
      {priority === "high" ? "High priority" : priority === "medium" ? "Medium" : "Low"}
    </span>
  );
}

export function EvidenceBadge({ type }: { type: EvidenceType }) {
  return (
    <span
      className={cn(
        chip,
        "border",
        type === "google" && "border-emerald-200 text-emerald-700",
        type === "analytics" && "border-teal-200 text-teal-700",
        type === "site" && "border-slate-300 text-slate-700",
        type === "research" && "border-dashed border-violet-300 text-violet-700"
      )}
      title={
        type === "research"
          ? "Based on public search research and product review, not measured performance."
          : type === "site"
            ? "From our own crawl of the live site. Describes the page, not search performance."
            : "Measured data."
      }
    >
      {EVIDENCE_LABELS[type]}
    </span>
  );
}

export function LevelChip({ label, level }: { label: string; level: Level }) {
  return (
    <span className={cn(chip, "bg-subtle text-heading")}>
      {label}: <span className="font-semibold capitalize">{level}</span>
    </span>
  );
}

export function SampleBadge({ confidence }: { confidence: SampleConfidence }) {
  return (
    <span
      className={cn(
        chip,
        confidence === "reasonable" && "bg-emerald-50 text-emerald-700",
        confidence === "directional" && "bg-amber-50 text-amber-800",
        (confidence === "too_early" || confidence === "none") && "bg-subtle text-muted"
      )}
    >
      {SAMPLE_LABELS[confidence]}
    </span>
  );
}
