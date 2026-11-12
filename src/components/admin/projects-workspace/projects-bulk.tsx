"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, EyeOff, Loader2, Shuffle, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionMenu, type ActionMenuAnchor } from "@/components/ui/action-menu";
import type { ClientViewProjectRow } from "@/components/admin/client-view/client-view-shared";
import { CLIENT_VIEW_STAGES, STAGE_ACCENTS } from "@/lib/client-view";
import { getStatusLabel, type ProjectStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Projects List bulk actions. Every action calls the same per-project endpoint the single
 * action uses (status PATCH, Hide, permanent delete, staff assign, restore), so tenant
 * scoping, per-project access checks, activity logs and notifications stay exactly as they
 * are for one project. Requests run a few at a time; results are reported per project.
 */

export type ProjectBulkPermissions = {
  /** projects.edit — stage changes. */
  canEdit: boolean;
  /** projects.delete — Hide (soft delete). */
  canHide: boolean;
  /** projects.manage_staff */
  canManageStaff: boolean;
  /** Owner/admin — permanent delete (server requires business-admin access). */
  canDelete: boolean;
  /** media.delete — "Delete project and all media". */
  canDeleteMedia: boolean;
  /** Owner/admin — Restore from Hidden Projects. */
  canRestore: boolean;
};

type StaffOption = { id: string; email: string; full_name: string | null };
type Failure = { project: ClientViewProjectRow; reason: string };
type Outcome = { done: ClientViewProjectRow[]; failed: Failure[] };

const CONCURRENCY = 4;

async function runPool(
  projects: ClientViewProjectRow[],
  worker: (p: ClientViewProjectRow) => Promise<string | null>,
  onProgress?: (n: number) => void
): Promise<Outcome> {
  const done: ClientViewProjectRow[] = [];
  const failed: Failure[] = [];
  let next = 0;
  let finished = 0;
  async function lane() {
    while (next < projects.length) {
      const project = projects[next++];
      try {
        const err = await worker(project);
        if (err) failed.push({ project, reason: err });
        else done.push(project);
      } catch {
        failed.push({ project, reason: "Network error — try again." });
      }
      onProgress?.(++finished);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, projects.length) }, lane));
  return { done, failed };
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  if (res.status === 404) return "Not found, or you no longer have access.";
  if (res.status === 401 || res.status === 403) return "You don’t have permission for this.";
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const nameOf = (p: ClientViewProjectRow) => p.project_name || p.property_address || "Untitled project";

const hideRequest = async (p: ClientViewProjectRow) => {
  const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE", credentials: "include" });
  return res.ok ? null : errorOf(res, "Couldn’t hide this project.");
};

export function useProjectBulkActions({
  permissions,
  staff,
  showDeleted,
  onRemoved,
  onSettled,
}: {
  permissions: ProjectBulkPermissions;
  staff: StaffOption[];
  showDeleted: boolean;
  /** Projects that left this list (hidden / restored / deleted) — removed optimistically. */
  onRemoved: (ids: string[]) => void;
  /** After a run: these succeeded and leave the selection (failures stay selected). */
  onSettled: (doneIds: string[]) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ label: string; total: number; finished: number } | null>(null);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState<{ kind: "stage" | "staff"; anchor: ActionMenuAnchor } | null>(null);
  const [confirmStage, setConfirmStage] = useState<{ status: ProjectStatus; projects: ClientViewProjectRow[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClientViewProjectRow[] | null>(null);
  const [report, setReport] = useState<{ title: string; outcome: Outcome; hideBlocked?: boolean } | null>(null);

  async function run(
    label: string,
    projects: ClientViewProjectRow[],
    worker: (p: ClientViewProjectRow) => Promise<string | null>,
    after: (o: Outcome) => void
  ) {
    if (busyRef.current || projects.length === 0) return;
    busyRef.current = true;
    setBusy({ label, total: projects.length, finished: 0 });
    try {
      const outcome = await runPool(projects, worker, (finished) => setBusy((b) => (b ? { ...b, finished } : b)));
      after(outcome);
      onSettled(outcome.done.map((p) => p.id));
      if (outcome.done.length) router.refresh();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function summarize(title: string, outcome: Outcome, success: string, extra?: { hideBlocked?: boolean }) {
    if (outcome.failed.length === 0) {
      toast.success(success);
      return;
    }
    if (outcome.done.length) toast.success(success);
    setReport({ title, outcome, ...extra });
  }

  // ── Stage ──
  function changeStage(projects: ClientViewProjectRow[], status: ProjectStatus) {
    const moving = projects.filter((p) => p.status !== status);
    const label = getStatusLabel(status);
    if (moving.length === 0) {
      toast.message(`${projects.length === 1 ? "It’s" : "They’re all"} already in ${label}.`);
      return;
    }
    setConfirmStage(null);
    void run(`Moving to ${label}`, moving, async (p) => {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: p.id, status }),
      });
      return res.ok ? null : errorOf(res, "Couldn’t change the stage.");
    }, (o) => summarize("Some projects didn’t move", o, `${plural(o.done.length, "project")} moved to ${label}`));
  }

  // ── Staff (adds the person; existing assignments are kept) ──
  function assignStaff(projects: ClientViewProjectRow[], member: StaffOption) {
    const who = member.full_name || member.email;
    void run(`Assigning ${who}`, projects, async (p) => {
      const res = await fetch("/api/project-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: p.id, user_id: member.id }),
      });
      return res.ok ? null : errorOf(res, "Couldn’t assign staff.");
    }, (o) => summarize("Some assignments failed", o, `${who} assigned to ${plural(o.done.length, "project")}`));
  }

  // ── Hide / Restore ──
  function hide(projects: ClientViewProjectRow[]) {
    void run("Hiding", projects, hideRequest, (o) => {
      onRemoved(o.done.map((p) => p.id));
      summarize(
        "Some projects weren’t hidden",
        o,
        o.done.length === 1 ? `“${nameOf(o.done[0])}” hidden — find it under Hidden Projects` : `${plural(o.done.length, "project")} hidden — find them under Hidden Projects`
      );
    });
  }

  function restore(projects: ClientViewProjectRow[]) {
    void run("Restoring", projects, async (p) => {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "restore" }),
      });
      return res.ok ? null : errorOf(res, "Couldn’t restore this project.");
    }, (o) => {
      onRemoved(o.done.map((p) => p.id));
      summarize("Some projects weren’t restored", o, `${plural(o.done.length, "project")} restored to active projects`);
    });
  }

  // ── Permanent delete ──
  function remove(projects: ClientViewProjectRow[], mode: "keep_media" | "delete_media") {
    setConfirmDelete(null);
    let storageFailed = 0;
    void run("Deleting", projects, async (p) => {
      const res = await fetch(`/api/projects/${p.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
        if (body.code === "has_paid_invoices") return "Has paid invoices — kept for your records. It can only be hidden.";
        return body.error || "Couldn’t delete this project.";
      }
      if (!res.ok) return errorOf(res, "Couldn’t delete this project.");
      const body = (await res.json().catch(() => ({}))) as { storageObjectsFailed?: number };
      storageFailed += body.storageObjectsFailed ?? 0;
      return null;
    }, (o) => {
      onRemoved(o.done.map((p) => p.id));
      const blocked = o.failed.some((f) => f.reason.startsWith("Has paid invoices"));
      summarize("Some projects weren’t deleted", o, `${plural(o.done.length, "project")} permanently deleted`, {
        hideBlocked: blocked && !showDeleted && permissions.canHide,
      });
      if (storageFailed) toast.warning(`${plural(storageFailed, "file")} could not be removed from storage.`);
    });
  }

  function bar(selected: ClientViewProjectRow[], onClear: () => void) {
    if (selected.length === 0) return null;
    const disabled = !!busy;
    return (
      <div
        className="media-bulk-bar fixed left-[calc(var(--admin-sidebar-w,0px)+0.75rem)] right-3 z-40 mx-auto max-w-4xl rounded-2xl border border-border bg-card/95 px-2.5 py-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur sm:px-3"
        role="toolbar"
        aria-label="Bulk project actions"
      >
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="min-w-0 truncate pl-1 text-sm font-semibold text-heading" aria-live="polite">
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
                {busy.label}… {busy.finished}/{busy.total}
              </span>
            ) : (
              <>
                {selected.length.toLocaleString()}
                <span className="hidden min-[420px]:inline"> {selected.length === 1 ? "project" : "projects"}</span> selected
              </>
            )}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            {!showDeleted && permissions.canEdit ? (
              <BulkButton icon={Shuffle} label="Change Stage" disabled={disabled} onClick={(el) => setMenu({ kind: "stage", anchor: { kind: "element", element: el } })} />
            ) : null}
            {!showDeleted && permissions.canManageStaff && staff.length ? (
              <BulkButton icon={UserPlus} label="Assign Staff" disabled={disabled} onClick={(el) => setMenu({ kind: "staff", anchor: { kind: "element", element: el } })} />
            ) : null}
            {!showDeleted && permissions.canHide ? <BulkButton icon={EyeOff} label="Hide" disabled={disabled} onClick={() => hide(selected)} /> : null}
            {showDeleted && permissions.canRestore ? <BulkButton icon={ArchiveRestore} label="Restore" disabled={disabled} onClick={() => restore(selected)} /> : null}
            {permissions.canDelete ? (
              <>
                <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
                <BulkButton icon={Trash2} label="Delete" tone="danger" disabled={disabled} onClick={() => setConfirmDelete(selected)} />
              </>
            ) : null}
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              aria-label="Clear selection"
              title="Clear selection"
              className="flex h-10 w-8 items-center justify-center rounded-xl text-muted hover:bg-subtle hover:text-heading disabled:opacity-40 sm:w-10"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <ActionMenu
          anchor={menu?.anchor ?? null}
          onClose={() => setMenu(null)}
          title={menu?.kind === "staff" ? "Assign staff" : "Move to stage"}
          items={
            menu?.kind === "staff"
              ? [
                  { type: "label" as const, id: "staff-label", label: `Add to ${plural(selected.length, "project")}` },
                  ...staff.map((m) => ({ id: `staff-${m.id}`, label: m.full_name || m.email, onSelect: () => assignStaff(selected, m) })),
                ]
              : [
                  { type: "label" as const, id: "stage-label", label: "Move to stage" },
                  ...CLIENT_VIEW_STAGES.map((s) => {
                    const already = selected.filter((p) => p.status === s.value).length;
                    return {
                      id: `stage-${s.value}`,
                      label: s.label,
                      disabled: already === selected.length,
                      hint: already ? (already === selected.length ? "Current" : `${already} already`) : undefined,
                      onSelect: () => setConfirmStage({ status: s.value, projects: selected }),
                    };
                  }),
                ]
          }
        />
      </div>
    );
  }

  const stageMoving = confirmStage ? confirmStage.projects.filter((p) => p.status !== confirmStage.status) : [];

  const dialogs = (
    <>
      <Modal
        open={!!confirmStage}
        onClose={() => setConfirmStage(null)}
        title={confirmStage ? `Move ${plural(stageMoving.length, "project")} to ${getStatusLabel(confirmStage.status)}?` : ""}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setConfirmStage(null)}>
              Cancel
            </Button>
            <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={!!busy} onClick={() => confirmStage && changeStage(confirmStage.projects, confirmStage.status)}>
              Move {plural(stageMoving.length, "project")}
            </Button>
          </div>
        }
      >
        {confirmStage ? (
          <div className="space-y-3 text-sm text-muted">
            <p className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_ACCENTS[confirmStage.status].bar)} aria-hidden />
              <span>
                Each project moves exactly as if you dragged it on the board, including the client’s usual stage-update
                notification and any automations for that stage.
              </span>
            </p>
            {confirmStage.projects.length > stageMoving.length ? (
              <p>{plural(confirmStage.projects.length - stageMoving.length, "project is", "projects are")} already there and won’t change.</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => !busy && setConfirmDelete(null)}
        title={confirmDelete ? `Permanently delete ${plural(confirmDelete.length, "project")}?` : ""}
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button variant="outline" className="min-h-11 w-full text-red-600 hover:text-red-700" disabled={!!busy} onClick={() => confirmDelete && remove(confirmDelete, "keep_media")}>
              Delete {plural(confirmDelete?.length ?? 0, "project")}, keep media
            </Button>
            {permissions.canDeleteMedia ? (
              <Button variant="destructive" className="min-h-11 w-full" disabled={!!busy} onClick={() => confirmDelete && remove(confirmDelete, "delete_media")}>
                Delete {plural(confirmDelete?.length ?? 0, "project")} and all media
              </Button>
            ) : null}
            {!showDeleted && permissions.canHide ? (
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={!!busy}
                onClick={() => {
                  const list = confirmDelete ?? [];
                  setConfirmDelete(null);
                  hide(list);
                }}
              >
                <EyeOff className="h-4 w-4" aria-hidden /> Hide instead
              </Button>
            ) : null}
            <Button variant="outline" className="min-h-11 w-full" disabled={!!busy} onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
          </div>
        }
      >
        {confirmDelete ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              <strong className="text-heading">This can’t be undone.</strong> {confirmDelete.length === 1 ? "This project is" : `These ${confirmDelete.length.toLocaleString()} projects are`} deleted
              for good, with their estimates, unpaid invoices, schedule, video reviews, share links and Marketing Kit.
              Client records are not changed.
            </p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-subtle/50 px-3 py-2 text-xs text-foreground">
              {confirmDelete.map((p) => (
                <li key={p.id} className="truncate">
                  {nameOf(p)}
                </li>
              ))}
            </ul>
            <p>
              <strong className="text-heading">Keep media</strong> leaves photos, videos, files, tours and 3D models in your Media library.
              {permissions.canDeleteMedia ? (
                <>
                  {" "}
                  <strong className="text-heading">All media</strong> also deletes them from storage.
                </>
              ) : null}
            </p>
            <p className="text-xs">Projects with paid invoices are never deleted — they’re kept for your records and can only be hidden.</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title={report?.title ?? ""}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setReport(null)}>
              Close
            </Button>
            {report?.hideBlocked ? (
              <Button
                variant="accent"
                className="min-h-11 sm:min-h-10"
                onClick={() => {
                  const blocked = report.outcome.failed.filter((f) => f.reason.startsWith("Has paid invoices")).map((f) => f.project);
                  setReport(null);
                  hide(blocked);
                }}
              >
                <EyeOff className="h-4 w-4" aria-hidden /> Hide those instead
              </Button>
            ) : null}
          </div>
        }
      >
        {report ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              {report.outcome.done.length ? `${plural(report.outcome.done.length, "project")} done. ` : ""}
              {plural(report.outcome.failed.length, "project")} couldn’t be changed and {report.outcome.failed.length === 1 ? "is" : "are"} still selected:
            </p>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {report.outcome.failed.map((f) => (
                <li key={f.project.id} className="px-3 py-2">
                  <p className="truncate font-medium text-heading">{nameOf(f.project)}</p>
                  <p className="text-xs">{f.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </>
  );

  return { bar, dialogs, hide, restore, busy: !!busy };
}

function BulkButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (el: HTMLButtonElement) => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-semibold transition-colors disabled:opacity-50 sm:w-10 lg:w-auto lg:px-3.5",
        tone === "danger"
          ? "border-red-200 text-red-600 hover:bg-red-50 surface-dark:border-red-500/30 surface-dark:hover:bg-red-500/10"
          : "border-border text-heading hover:bg-subtle"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

/** Media Library–style checkbox (accent fill, check / dash). */
export function SelectCheckbox({
  checked,
  onToggle,
  label,
  className,
}: {
  checked: boolean | "mixed";
  onToggle: (e: React.MouseEvent) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      className={cn("flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", className)}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 transition-colors",
          checked ? "border-accent bg-accent text-accent-foreground" : "border-slate-300 bg-card surface-dark:border-border"
        )}
      >
        {checked === true ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : checked === "mixed" ? (
          <span className="h-0.5 w-2 rounded bg-current" aria-hidden />
        ) : null}
      </span>
    </button>
  );
}
