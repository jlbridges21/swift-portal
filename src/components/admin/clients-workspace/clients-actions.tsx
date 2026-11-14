"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, FolderPlus, Loader2, Plus, RotateCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { ClientPortalRecoveryCard } from "@/components/admin/client-portal-recovery-card";
import type { ClientProfileView } from "@/lib/client-profile-view";
import { REFERRAL_SOURCES } from "@/lib/referral-sources";
import {
  canInvite,
  canResend,
  clientsToCsv,
  EMAIL_RE,
  type ClientWorkspaceRow,
} from "@/lib/clients-workspace";
import { cn } from "@/lib/utils";

export type ClientsPermissions = {
  canCreate: boolean;
  /** clients.edit — edit details, Hide, Restore. */
  canEdit: boolean;
  /** clients.delete — permanent delete. */
  canDelete: boolean;
  canAddToProjects: boolean;
  canCreateProject: boolean;
  /** Owner/admin — portal invites and access recovery. */
  canManagePortal: boolean;
  /** area.messages — read the thread. */
  canMessage: boolean;
  /** messages.send — send from the panel. */
  canSendMessages: boolean;
  canViewMoney: boolean;
};

type Failure = { client: ClientWorkspaceRow; reason: string };
type Outcome = { done: ClientWorkspaceRow[]; failed: Failure[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

async function runPool(
  clients: ClientWorkspaceRow[],
  concurrency: number,
  worker: (c: ClientWorkspaceRow) => Promise<string | null>,
  onProgress: (n: number) => void
): Promise<Outcome> {
  const done: ClientWorkspaceRow[] = [];
  const failed: Failure[] = [];
  let next = 0;
  let finished = 0;
  async function lane() {
    while (next < clients.length) {
      const client = clients[next++];
      try {
        const err = await worker(client);
        if (err) failed.push({ client, reason: err });
        else done.push(client);
      } catch {
        failed.push({ client, reason: "Network error — try again." });
      }
      onProgress(++finished);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, clients.length) }, lane));
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

type InviteConfirm = { mode: "send" | "resend"; eligible: ClientWorkspaceRow[]; skipped: { reason: string; count: number }[] };

/** Why a client can't receive an invite (or resend) right now. */
function inviteSkipReason(c: ClientWorkspaceRow, mode: "send" | "resend"): string {
  if (!c.email) return "no email on file";
  if (c.portal_status === "active") return "already active";
  if (c.portal_status === "unavailable") return "login belongs to another business";
  if (mode === "send" && c.portal_status === "invite_sent") return "invite already pending — use Resend";
  if (mode === "resend" && c.portal_status === "not_invited") return "never invited — use Send Portal Invite";
  return "not eligible";
}

function groupSkips(clients: ClientWorkspaceRow[], mode: "send" | "resend") {
  const map = new Map<string, number>();
  for (const c of clients) {
    const r = inviteSkipReason(c, mode);
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return [...map.entries()].map(([reason, count]) => ({ reason, count }));
}

export function downloadClientsCsv(rows: ClientWorkspaceRow[], includeMoney: boolean, label = "clients") {
  const csv = clientsToCsv(rows, { includeMoney });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`Exported ${plural(rows.length, "client")}`);
}

export function useClientActions({
  permissions,
  onPatch,
  onRemoved,
  onSettled,
}: {
  permissions: ClientsPermissions;
  /** Optimistic local update for one row (e.g. portal status after an invite). */
  onPatch: (id: string, patch: Partial<ClientWorkspaceRow>) => void;
  /** Rows that left this list (hidden / restored / deleted). */
  onRemoved: (ids: string[]) => void;
  /** After a bulk run: these succeeded and leave the selection (failures stay selected). */
  onSettled: (doneIds: string[]) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ label: string; total: number; finished: number } | null>(null);
  const busyRef = useRef(false);
  const [inviteConfirm, setInviteConfirm] = useState<InviteConfirm | null>(null);
  const [resetConfirm, setResetConfirm] = useState<ClientWorkspaceRow[] | null>(null);
  const [hideConfirm, setHideConfirm] = useState<ClientWorkspaceRow[] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientWorkspaceRow[] | null>(null);
  const [projectPicker, setProjectPicker] = useState<ClientWorkspaceRow[] | null>(null);
  const [editing, setEditing] = useState<ClientWorkspaceRow | null>(null);
  const [accessFor, setAccessFor] = useState<ClientWorkspaceRow | null>(null);
  const [report, setReport] = useState<{ title: string; outcome: Outcome } | null>(null);

  async function run(
    label: string,
    clients: ClientWorkspaceRow[],
    worker: (c: ClientWorkspaceRow) => Promise<string | null>,
    after: (o: Outcome) => void,
    concurrency = 4
  ) {
    if (busyRef.current || clients.length === 0) return;
    busyRef.current = true;
    setBusy({ label, total: clients.length, finished: 0 });
    try {
      const outcome = await runPool(clients, concurrency, worker, (finished) =>
        setBusy((b) => (b ? { ...b, finished } : b))
      );
      after(outcome);
      onSettled(outcome.done.map((c) => c.id));
      if (outcome.done.length) router.refresh();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function summarize(title: string, outcome: Outcome, success: string, extra?: string) {
    if (outcome.done.length) toast.success(success, extra ? { description: extra } : undefined);
    if (outcome.failed.length) {
      if (outcome.failed.length === 1 && outcome.done.length === 0) {
        toast.error(outcome.failed[0].reason);
      } else {
        setReport({ title, outcome });
      }
    }
  }

  // ── Portal invites ──
  function requestInvites(clients: ClientWorkspaceRow[], mode: "send" | "resend") {
    const eligible = clients.filter((c) => (mode === "send" ? canInvite(c) : canResend(c)));
    const skipped = groupSkips(clients.filter((c) => !eligible.includes(c)), mode);
    if (eligible.length === 0) {
      toast.message(
        clients.length === 1
          ? `Can’t ${mode === "send" ? "invite" : "resend to"} this client — ${skipped[0]?.reason ?? "not eligible"}.`
          : `None of these clients can be ${mode === "send" ? "invited" : "re-sent an invite"} right now.`,
        { description: skipped.map((s) => `${plural(s.count, "client")}: ${s.reason}`).join(" · ") || undefined }
      );
      return;
    }
    // One explicit client: send straight away. Several: confirm first (these are emails).
    if (clients.length === 1) sendInvites(eligible, mode);
    else setInviteConfirm({ mode, eligible, skipped });
  }

  function sendInvites(clients: ClientWorkspaceRow[], mode: "send" | "resend") {
    setInviteConfirm(null);
    void run(
      mode === "send" ? "Sending invites" : "Resending invites",
      clients,
      async (c) => {
        const res = await fetch(`/api/clients/${c.id}/portal-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "send" }),
        });
        if (!res.ok) return errorOf(res, "Couldn’t send the invite.");
        onPatch(c.id, { portal_status: "invite_sent", invite_sent_at: new Date().toISOString() });
        return null;
      },
      (o) =>
        summarize(
          "Some invites weren’t sent",
          o,
          o.done.length === 1
            ? `Portal invite ${mode === "send" ? "sent" : "re-sent"} to ${o.done[0].email}`
            : `Portal invites ${mode === "send" ? "sent" : "re-sent"} to ${plural(o.done.length, "client")}`
        ),
      3
    );
  }

  // ── Password reset (active portal accounts) ──
  function requestPasswordReset(clients: ClientWorkspaceRow[]) {
    const eligible = clients.filter((c) => c.portal_status === "active" && c.email);
    if (!eligible.length) {
      toast.message("Password resets are only for clients with an active portal account.");
      return;
    }
    setResetConfirm(eligible);
  }

  function sendPasswordResets(clients: ClientWorkspaceRow[]) {
    setResetConfirm(null);
    void run(
      "Sending reset emails",
      clients,
      async (c) => {
        const res = await fetch(`/api/clients/${c.id}/portal-recovery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "send_reset" }),
        });
        return res.ok ? null : errorOf(res, "Couldn’t send the reset email.");
      },
      (o) => summarize("Some reset emails weren’t sent", o, `Password reset email sent to ${plural(o.done.length, "client")}`),
      3
    );
  }

  // ── Hide / Restore / Delete ──
  function hide(clients: ClientWorkspaceRow[]) {
    setHideConfirm(null);
    void run(
      "Hiding",
      clients,
      async (c) => {
        const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE", credentials: "include" });
        return res.ok ? null : errorOf(res, "Couldn’t hide this client.");
      },
      (o) => {
        onRemoved(o.done.map((c) => c.id));
        summarize(
          "Some clients weren’t hidden",
          o,
          o.done.length === 1 ? `${o.done[0].name} hidden` : `${plural(o.done.length, "client")} hidden`,
          "Find them under Hidden Clients — nothing was deleted."
        );
      }
    );
  }

  function restore(clients: ClientWorkspaceRow[]) {
    void run(
      "Restoring",
      clients,
      async (c) => {
        const res = await fetch(`/api/clients/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "restore" }),
        });
        return res.ok ? null : errorOf(res, "Couldn’t restore this client.");
      },
      (o) => {
        onRemoved(o.done.map((c) => c.id));
        summarize("Some clients weren’t restored", o, `${plural(o.done.length, "client")} restored to your client list`);
      }
    );
  }

  function remove(clients: ClientWorkspaceRow[]) {
    setDeleteConfirm(null);
    void run(
      "Deleting",
      clients,
      async (c) => {
        const res = await fetch(`/api/clients/${c.id}/delete`, { method: "POST", credentials: "include" });
        return res.ok ? null : errorOf(res, "Couldn’t delete this client.");
      },
      (o) => {
        onRemoved(o.done.map((c) => c.id));
        summarize(
          "Some clients weren’t deleted",
          o,
          `${plural(o.done.length, "client")} permanently deleted`,
          "Their projects and media were kept."
        );
      },
      2
    );
  }

  // ── Add to project ──
  function addToProject(clients: ClientWorkspaceRow[], project: ProjectOption) {
    setProjectPicker(null);
    const name = project.project_name || project.property_address || "the project";
    void run(
      `Adding to ${name}`,
      clients,
      async (c) => {
        const res = await fetch("/api/project-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ project_id: project.id, client_id: c.id, is_primary: false }),
        });
        return res.ok ? null : errorOf(res, "Couldn’t add this client to the project.");
      },
      (o) => {
        // Project counts come back with the refresh.
        summarize("Some clients weren’t added", o, `${plural(o.done.length, "client")} added to ${name}`, undefined);
      },
      2
    );
  }

  const disabled = Boolean(busy);

  const dialogs = (
    <>
      {/* Bulk invite confirmation */}
      <Modal
        open={!!inviteConfirm}
        onClose={() => setInviteConfirm(null)}
        title={
          inviteConfirm
            ? `${inviteConfirm.mode === "send" ? "Send" : "Resend"} portal invites to ${plural(inviteConfirm.eligible.length, "client")}?`
            : ""
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setInviteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              className="min-h-11 sm:min-h-10"
              disabled={disabled}
              onClick={() => inviteConfirm && sendInvites(inviteConfirm.eligible, inviteConfirm.mode)}
            >
              {inviteConfirm?.mode === "resend" ? "Resend" : "Send"} {plural(inviteConfirm?.eligible.length ?? 0, "invite")}
            </Button>
          </div>
        }
      >
        {inviteConfirm ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              Each client gets an email with a secure link to create their own password. Links last 7 days and
              work once. You never see or set their password.
            </p>
            <NameList clients={inviteConfirm.eligible} />
            {inviteConfirm.skipped.length ? (
              <div className="rounded-xl border border-border bg-subtle/50 px-3 py-2 text-xs">
                <p className="font-semibold text-heading">Skipped — no email will be sent:</p>
                <ul className="mt-1 space-y-0.5">
                  {inviteConfirm.skipped.map((s) => (
                    <li key={s.reason}>
                      {plural(s.count, "client")}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Password reset confirmation */}
      <Modal
        open={!!resetConfirm}
        onClose={() => setResetConfirm(null)}
        title={resetConfirm ? `Email a password reset to ${plural(resetConfirm.length, "client")}?` : ""}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setResetConfirm(null)}>
              Cancel
            </Button>
            <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={disabled} onClick={() => resetConfirm && sendPasswordResets(resetConfirm)}>
              Send reset emails
            </Button>
          </div>
        }
      >
        {resetConfirm ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              These clients already have a portal account. Each gets an email to choose a new password — their
              current password keeps working until they do.
            </p>
            <NameList clients={resetConfirm} />
          </div>
        ) : null}
      </Modal>

      {/* Hide confirmation */}
      <Modal
        open={!!hideConfirm}
        onClose={() => setHideConfirm(null)}
        title={hideConfirm ? (hideConfirm.length === 1 ? `Hide ${hideConfirm[0].name}?` : `Hide ${plural(hideConfirm.length, "client")}?`) : ""}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setHideConfirm(null)}>
              Cancel
            </Button>
            <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={disabled} onClick={() => hideConfirm && hide(hideConfirm)}>
              <EyeOff className="h-4 w-4" aria-hidden /> Hide
            </Button>
          </div>
        }
      >
        {hideConfirm ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              Hidden clients and their projects leave your lists and dashboard. Nothing is erased — payments, media
              and notes stay, and you can restore them any time from Hidden Clients.
            </p>
            {hideConfirm.length > 1 ? <NameList clients={hideConfirm} /> : null}
          </div>
        ) : null}
      </Modal>

      {/* Permanent delete */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => !busy && setDeleteConfirm(null)}
        title={deleteConfirm ? `Permanently delete ${deleteConfirm.length === 1 ? deleteConfirm[0].name : plural(deleteConfirm.length, "client")}?` : ""}
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button variant="destructive" className="min-h-11 w-full" disabled={disabled} onClick={() => deleteConfirm && remove(deleteConfirm)}>
              Delete {plural(deleteConfirm?.length ?? 0, "client")} permanently
            </Button>
            {permissions.canEdit && deleteConfirm?.every((c) => !c.deleted_at) ? (
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={disabled}
                onClick={() => {
                  const list = deleteConfirm ?? [];
                  setDeleteConfirm(null);
                  hide(list);
                }}
              >
                <EyeOff className="h-4 w-4" aria-hidden /> Hide instead
              </Button>
            ) : null}
            <Button variant="outline" className="min-h-11 w-full" disabled={disabled} onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
          </div>
        }
      >
        {deleteConfirm ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              <strong className="text-heading">This can’t be undone.</strong> Contact details, internal notes,
              messages and saved brand profiles are deleted for good, and their portal login will no longer show
              any projects.
            </p>
            <NameList clients={deleteConfirm} showProjects />
            <p>
              Projects, invoices, payment history and media are <strong className="text-heading">kept</strong>. A
              project shared with another client moves to that client; otherwise it stays with no client.
            </p>
          </div>
        ) : null}
      </Modal>

      <ProjectPickerModal
        clients={projectPicker}
        canCreateProject={permissions.canCreateProject}
        onClose={() => setProjectPicker(null)}
        onPick={(project) => projectPicker && addToProject(projectPicker, project)}
        disabled={disabled}
      />

      <EditClientModal
        client={editing}
        onClose={() => setEditing(null)}
        onSaved={(patch) => {
          if (editing) onPatch(editing.id, patch);
          setEditing(null);
          router.refresh();
        }}
      />

      <ManageAccessModal
        client={accessFor}
        onClose={() => {
          setAccessFor(null);
          // Invites / resets sent from the card change portal status — resync the list.
          router.refresh();
        }}
      />

      {/* Partial-failure report */}
      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title={report?.title ?? ""}
        footer={
          <div className="flex justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={() => setReport(null)}>
              Close
            </Button>
          </div>
        }
      >
        {report ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              {report.outcome.done.length ? `${plural(report.outcome.done.length, "client")} done. ` : ""}
              {plural(report.outcome.failed.length, "client")} couldn’t be changed
              {report.outcome.failed.length ? " and stay selected" : ""}:
            </p>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {report.outcome.failed.map((f) => (
                <li key={f.client.id} className="px-3 py-2">
                  <p className="truncate font-medium text-heading">{f.client.name}</p>
                  <p className="text-xs">{f.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </>
  );

  return {
    busy,
    disabled,
    dialogs,
    invite: (clients: ClientWorkspaceRow[]) => requestInvites(clients, "send"),
    resend: (clients: ClientWorkspaceRow[]) => requestInvites(clients, "resend"),
    passwordReset: requestPasswordReset,
    hide: (clients: ClientWorkspaceRow[]) => setHideConfirm(clients),
    restore,
    remove: (clients: ClientWorkspaceRow[]) => setDeleteConfirm(clients),
    addToProject: (clients: ClientWorkspaceRow[]) => setProjectPicker(clients),
    edit: (client: ClientWorkspaceRow) => setEditing(client),
    manageAccess: (client: ClientWorkspaceRow) => setAccessFor(client),
  };
}

export type ClientActions = ReturnType<typeof useClientActions>;

function NameList({ clients, showProjects }: { clients: ClientWorkspaceRow[]; showProjects?: boolean }) {
  return (
    <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-subtle/50 px-3 py-2 text-xs text-foreground">
      {clients.map((c) => (
        <li key={c.id} className="flex justify-between gap-3">
          <span className="truncate">
            {c.name} <span className="text-muted">· {c.email || "no email"}</span>
          </span>
          {showProjects && c.total_projects ? (
            <span className="shrink-0 text-muted">{plural(c.total_projects, "project")}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ── Project picker ──────────────────────────────────────────────────────────

type ProjectOption = {
  id: string;
  project_name: string | null;
  property_address: string | null;
  status: string;
  client_id: string | null;
};

function ProjectPickerModal({
  clients,
  canCreateProject,
  onClose,
  onPick,
  disabled,
}: {
  clients: ClientWorkspaceRow[] | null;
  canCreateProject: boolean;
  onClose: () => void;
  onPick: (p: ProjectOption) => void;
  disabled: boolean;
}) {
  const open = !!clients;
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string | null; projects: ProjectOption[] }>({
    loading: false,
    error: null,
    projects: [],
  });
  const [chosen, setChosen] = useState<ProjectOption | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setChosen(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      fetch(`/api/clients/project-options?q=${encodeURIComponent(query.trim())}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await errorOf(res, "Couldn’t load projects."));
          setState({ loading: false, error: null, projects: (await res.json()) as ProjectOption[] });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState({ loading: false, error: err instanceof Error ? err.message : "Couldn’t load projects.", projects: [] });
        });
    }, query ? 250 : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [open, query]);

  const single = clients?.length === 1 ? clients[0] : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={single ? `Add ${single.name} to a project` : `Add ${plural(clients?.length ?? 0, "client")} to a project`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {single && canCreateProject ? (
            <Link
              href={`/admin/projects/new?client=${encodeURIComponent(single.id)}`}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent-subtle sm:min-h-10"
            >
              <Plus className="h-4 w-4" aria-hidden /> New project for {single.name.split(" ")[0]}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={!chosen || disabled} onClick={() => chosen && onPick(chosen)}>
              <FolderPlus className="h-4 w-4" aria-hidden /> Add to project
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by name or address…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          {state.loading && !state.projects.length ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading projects…
            </p>
          ) : state.error ? (
            <p className="px-3 py-6 text-sm text-red-600">{state.error}</p>
          ) : state.projects.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted">{query ? "No projects match." : "No active projects yet."}</p>
          ) : (
            <ul role="listbox" aria-label="Projects" className="divide-y divide-border">
              {state.projects.map((p) => {
                const on = chosen?.id === p.id;
                const already = clients?.every((c) => c.id === p.client_id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => setChosen(p)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        on ? "bg-accent/[0.08]" : "hover:bg-subtle/70"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-full border-2",
                          on ? "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-card,white)]" : "border-slate-300 surface-dark:border-border"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-heading">{p.project_name || "Untitled project"}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.property_address || "No address"}
                          {already ? " · already their project" : ""}
                        </span>
                      </span>
                      <StatusBadge status={p.status} className="shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted">
          {single ? "They’re" : "Each client is"} added alongside the project’s current client and gets the usual
          “added to project” notification.
        </p>
      </div>
    </Modal>
  );
}

// ── Edit client ─────────────────────────────────────────────────────────────

function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: ClientWorkspaceRow | null;
  onClose: () => void;
  onSaved: (patch: Partial<ClientWorkspaceRow>) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", referral_source: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        email: client.email,
        phone: client.phone ?? "",
        company: client.company ?? "",
        referral_source: client.referral_source ?? "",
      });
    }
  }, [client]);

  async function save() {
    if (!client) return;
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!EMAIL_RE.test(form.email.trim())) return toast.error("Enter a valid email address.");
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: client.id,
          name: form.name.trim(),
          full_name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          referral_source: form.referral_source || null,
        }),
      });
      if (!res.ok) throw new Error(await errorOf(res, "Couldn’t save changes."));
      toast.success("Client updated");
      onSaved({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        referral_source: form.referral_source || null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t save changes.");
    } finally {
      setSaving(false);
    }
  }

  const referralOptions = REFERRAL_SOURCES.includes(form.referral_source as (typeof REFERRAL_SOURCES)[number]) || !form.referral_source
    ? REFERRAL_SOURCES
    : [form.referral_source, ...REFERRAL_SOURCES];

  return (
    <Modal
      open={!!client}
      onClose={onClose}
      title="Edit client"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-client-name">Name</Label>
          <Input id="edit-client-name" className="min-h-11" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-client-email">Email</Label>
          <Input id="edit-client-email" type="email" className="min-h-11" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          {client && client.portal_status !== "not_invited" && form.email.trim().toLowerCase() !== client.email.toLowerCase() ? (
            <p className="text-xs text-amber-700 surface-dark:text-amber-300">
              Changing the email cancels any outstanding invite link. Their portal login keeps its current email.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-client-phone">Phone</Label>
            <Input id="edit-client-phone" className="min-h-11" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-client-company">Company</Label>
            <Input id="edit-client-company" className="min-h-11" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-client-referral">Referral source</Label>
          <Select
            id="edit-client-referral"
            value={form.referral_source}
            onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))}
            options={[{ value: "", label: "Not set" }, ...referralOptions.map((s) => ({ value: s, label: s }))]}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Manage access (reuses the client profile's portal access card) ─────────

function ManageAccessModal({ client, onClose }: { client: ClientWorkspaceRow | null; onClose: () => void }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; view: ClientProfileView }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const id = client?.id ?? null;

  useEffect(() => {
    if (!id) return;
    setState({ status: "loading" });
    const controller = new AbortController();
    fetch(`/api/admin/clients/${encodeURIComponent(id)}/profile`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "This client isn’t available." : "Couldn’t load portal access.");
        setState({ status: "ready", view: (await res.json()) as ClientProfileView });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Couldn’t load portal access." });
      });
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <Modal open={!!client} onClose={onClose} title={client ? `Portal access · ${client.name}` : "Portal access"}>
      {state.status === "ready" ? (
        state.view.data.portalStatus && state.view.data.client.email ? (
          <ClientPortalRecoveryCard
            clientId={state.view.data.client.id}
            clientEmail={state.view.data.client.email}
            initialStatus={state.view.data.portalStatus}
          />
        ) : (
          <p className="text-sm text-muted">
            {state.view.data.client.deleted_at
              ? "Restore this client to manage their portal access."
              : "Add an email address for this client to manage portal access."}
          </p>
        )
      ) : state.status === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-medium text-heading">{state.message}</p>
          <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCw className="h-4 w-4" aria-hidden /> Try again
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading portal access…
        </div>
      )}
    </Modal>
  );
}
