"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen, MoreHorizontal, User } from "lucide-react";
import { toast } from "sonner";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { getStatusLabel, normalizeStatus, type ProjectStatus } from "@/lib/constants";
import { formatShootDateTime } from "@/lib/scheduling";
import { CLIENT_VIEW_STAGES, STAGE_ACCENTS, projectShootAt } from "@/lib/client-view";
import type { PipelineProjectRow } from "@/lib/admin-project-pipeline";
import { cn } from "@/lib/utils";
import { useOpenClientProfile } from "@/components/admin/client-view/client-profile-modal";

export type ClientViewProjectRow = PipelineProjectRow;

export function formatCardDate(project: ClientViewProjectRow): string | null {
  const when = projectShootAt(project);
  return when ? formatShootDateTime(when, { month: "short", day: "numeric", year: "numeric" }) : null;
}

export function StagePill({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STAGE_ACCENTS[status].bar)} />
      <span className="truncate">{getStatusLabel(status)}</span>
    </span>
  );
}

export function ServicePill({ service, className }: { service: string; className?: string }) {
  if (!service) return null;
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent",
        className
      )}
      title={service}
    >
      {service}
    </span>
  );
}

/**
 * Stage moves for the Client View — same PATCH /api/projects call the Pipeline
 * View makes, with an optimistic local override until the refresh lands.
 */
export function useProjectStageMove(projects: ClientViewProjectRow[]) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, ProjectStatus>>({});
  // Fresh server data (after refresh or a filter change) replaces optimistic moves.
  const [source, setSource] = useState(projects);
  if (source !== projects) {
    setSource(projects);
    setOverrides({});
  }

  async function moveProject(project: ClientViewProjectRow, next: ProjectStatus) {
    const current = overrides[project.id] ?? normalizeStatus(project.status);
    if (current === next) return;
    setOverrides((o) => ({ ...o, [project.id]: next }));

    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: project.id, status: next }),
    });

    if (!res.ok) {
      setOverrides((o) => {
        const copy = { ...o };
        delete copy[project.id];
        return copy;
      });
      toast.error("Failed to update status");
      return;
    }
    toast.success(`Moved to ${getStatusLabel(next)}`);
    router.refresh();
  }

  const current = projects.map((p) => {
    const status = overrides[p.id] ?? normalizeStatus(p.status);
    return status === p.status ? p : { ...p, status };
  });

  return { moveProject, projects: current };
}

/** "···" actions on a Client View project: open, move stage, client profile. */
export function ProjectActionsButton({
  project,
  onMove,
  canOpenClients,
  className,
}: {
  project: ClientViewProjectRow;
  onMove: (project: ClientViewProjectRow, next: ProjectStatus) => void;
  canOpenClients: boolean;
  className?: string;
}) {
  const router = useRouter();
  const openClientProfile = useOpenClientProfile();
  const [anchor, setAnchor] = useState<ActionMenuAnchor | null>(null);

  const items: ActionMenuItem[] = [
    {
      id: "open",
      label: "Open project",
      icon: FolderOpen,
      onSelect: () => router.push(`/admin/projects/${project.id}`),
    },
    {
      id: "open-tab",
      label: "Open in new tab",
      icon: ExternalLink,
      onSelect: () => window.open(`/admin/projects/${project.id}`, "_blank", "noopener"),
    },
    { type: "separator", id: "sep-stage" },
    { type: "label", id: "move-label", label: "Move to stage" },
    ...CLIENT_VIEW_STAGES.map((s) => ({
      id: `move-${s.value}`,
      label: s.label,
      disabled: s.value === project.status,
      hint: s.value === project.status ? "Current" : undefined,
      onSelect: () => onMove(project, s.value),
    })),
  ];
  if (canOpenClients && project.client_id) {
    items.push(
      { type: "separator", id: "sep-client" },
      {
        id: "client",
        label: "View client profile",
        icon: User,
        onSelect: () => {
          const clientId = project.client_id!;
          if (openClientProfile) openClientProfile(clientId);
          else router.push(`/admin/clients/${clientId}`);
        },
      }
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Actions for ${project.project_name}`}
        aria-haspopup="menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAnchor({ kind: "element", element: e.currentTarget });
        }}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-subtle hover:text-heading",
          className
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <ActionMenu anchor={anchor} onClose={() => setAnchor(null)} items={items} title={project.project_name} />
    </>
  );
}
