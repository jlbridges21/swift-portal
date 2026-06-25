import type { Project, ShootProposal } from "@/lib/types";

/**
 * Single source of truth for scheduled shoot datetime.
 * Prefers confirmed shoot proposal; falls back to project.shoot_date.
 */
export function getConfirmedShootProposal(proposals: ShootProposal[]): ShootProposal | null {
  return proposals.find((p) => p.status === "confirmed") ?? null;
}

export function getProjectShootDateTime(
  project: Pick<Project, "shoot_date">,
  proposals: ShootProposal[] = []
): string | null {
  const confirmed = getConfirmedShootProposal(proposals);
  if (confirmed?.proposed_at) return confirmed.proposed_at;
  if (project.shoot_date) {
    return `${project.shoot_date}T09:00:00.000Z`;
  }
  return null;
}

export function formatShootDateTime(iso: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", options ?? {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShootDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
