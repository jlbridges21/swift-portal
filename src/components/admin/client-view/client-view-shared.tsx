"use client";

import { compactServiceLabel, projectServiceNames } from "@/lib/project-service-names";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, FolderOpen, MoreHorizontal, Shuffle, User, UserPlus } from "lucide-react";
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
  // Several services ("A + B"): "A +1", full list on hover / for screen readers.
  const names = projectServiceNames({ service_type: service });
  const label = compactServiceLabel({ service_type: service });
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent",
        className
      )}
      title={names.join(", ")}
      aria-label={names.length > 1 ? `Services: ${names.join(", ")}` : undefined}
    >
      {label}
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

/** Extra per-project actions the Projects workspace adds to the "···" menu. */
export type ProjectMenuActions = {
  /** Shows "Assign staff" → staff picker (adds the person; existing assignments are kept). */
  assignStaff?: {
    options: { id: string; email: string; full_name: string | null }[];
    onAssign: (member: { id: string; email: string; full_name: string | null }) => void;
  };
  /** After Change stage / Assign staff (e.g. Hide, Restore). */
  items?: ActionMenuItem[];
  /** Last group, after a separator (e.g. Delete). */
  dangerItems?: ActionMenuItem[];
  disabled?: boolean;
};

/**
 * "···" actions on a project: open, Change stage (→ stage list), Assign staff (→ staff list),
 * Hide / Delete when provided, client profile. Stages live one click deeper on purpose.
 */
export function ProjectActionsButton({
  project,
  onMove,
  canOpenClients,
  className,
  actions,
}: {
  project: ClientViewProjectRow;
  onMove: (project: ClientViewProjectRow, next: ProjectStatus) => void;
  canOpenClients: boolean;
  className?: string;
  actions?: ProjectMenuActions;
}) {
  const router = useRouter();
  const openClientProfile = useOpenClientProfile();
  const [anchor, setAnchor] = useState<ActionMenuAnchor | null>(null);
  const [view, setView] = useState<"main" | "stage" | "staff">("main");

  // ActionMenu closes before running an item, so re-open at the same trigger to show a sub-list.
  const openView = (next: "main" | "stage" | "staff") => {
    if (!anchor) return;
    const element = anchor.element;
    setView(next);
    setAnchor({ kind: "element", element });
  };
  const back: ActionMenuItem = { id: "back", label: "Back", icon: ChevronLeft, onSelect: () => openView("main") };

  let items: ActionMenuItem[];
  let title = project.project_name;
  if (view === "stage") {
    title = "Change stage";
    items = [
      back,
      { type: "separator", id: "sep-back" },
      { type: "label", id: "move-label", label: "Move to stage" },
      ...CLIENT_VIEW_STAGES.map((s) => ({
        id: `move-${s.value}`,
        label: s.label,
        disabled: s.value === project.status,
        hint: s.value === project.status ? "Current" : undefined,
        onSelect: () => onMove(project, s.value),
      })),
    ];
  } else if (view === "staff" && actions?.assignStaff) {
    const { options, onAssign } = actions.assignStaff;
    title = "Assign staff";
    items = [
      back,
      { type: "separator", id: "sep-back" },
      { type: "label", id: "staff-label", label: "Assign staff" },
      ...options.map((m) => ({ id: `staff-${m.id}`, label: m.full_name || m.email, onSelect: () => onAssign(m) })),
    ];
  } else {
    items = [
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
      { id: "change-stage", label: "Change stage", icon: Shuffle, disabled: actions?.disabled, onSelect: () => openView("stage") },
    ];
    if (actions?.assignStaff?.options.length) {
      items.push({ id: "assign-staff", label: "Assign staff", icon: UserPlus, disabled: actions.disabled, onSelect: () => openView("staff") });
    }
    if (actions?.items?.length) items.push(...actions.items);
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
    if (actions?.dangerItems?.length) items.push({ type: "separator", id: "sep-danger" }, ...actions.dangerItems);
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
          setView("main");
          setAnchor({ kind: "element", element: e.currentTarget });
        }}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-subtle hover:text-heading",
          className
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <ActionMenu anchor={anchor} onClose={() => setAnchor(null)} items={items} title={title} />
    </>
  );
}
