"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ProjectDeleteMode = "keep_media" | "delete_media";

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function DeleteProjectModal({
  open,
  onClose,
  projectId,
  projectName,
  counts,
  paidInvoiceCount = 0,
  onHide,
  hiding = false,
  alreadyHidden = false,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /** Shown in the "delete all media" option so the admin knows what goes. */
  counts?: { media: number; tours: number; models: number };
  /**
   * Paid / processing invoices the viewer can see. Any → the project can only be hidden.
   * (Staff without money access see 0; the server still refuses and the modal switches over.)
   */
  paidInvoiceCount?: number;
  /** Hide the project (same action as the Hide button). Omit to not offer it. */
  onHide?: () => void;
  hiding?: boolean;
  /** The project is already hidden — wording changes; Hide isn't offered. */
  alreadyHidden?: boolean;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState<ProjectDeleteMode | null>(null);
  /** Set when the server refuses because of paid invoices the client-side list didn't show. */
  const [serverPaidCount, setServerPaidCount] = useState(0);
  const paidCount = Math.max(paidInvoiceCount, serverPaidCount);
  const busy = !!pending || hiding;

  async function run(mode: ProjectDeleteMode) {
    if (busy) return;
    setPending(mode);
    try {
      const res = await fetch(`/api/projects/${projectId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; paidInvoices?: number };
        if (body.code === "has_paid_invoices") {
          setServerPaidCount(body.paidInvoices || 1);
          return;
        }
      }
      if (!res.ok) {
        toast.error(await errorText(res, "Failed to delete project"));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { storageObjectsFailed?: number };
      toast.success(mode === "delete_media" ? "Project and its media deleted" : "Project deleted — media kept in Media");
      if (body.storageObjectsFailed) {
        toast.warning(`${plural(body.storageObjectsFailed, "file")} could not be removed from storage.`);
      }
      onDeleted();
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setPending(null);
    }
  }

  if (paidCount > 0) {
    return (
      <Modal
        open={open}
        onClose={() => !busy && onClose()}
        title="This project can’t be deleted"
        footer={
          <div className="flex w-full flex-col gap-2">
            {onHide && (
              <Button variant="accent" className="w-full min-h-11" disabled={busy} onClick={onHide}>
                {hiding ? "Hiding…" : "Hide project instead"}
              </Button>
            )}
            <Button variant="outline" className="w-full min-h-11" disabled={busy} onClick={onClose}>
              {onHide ? "Cancel" : "OK"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-muted">
          <p>
            <strong className="text-heading">{projectName}</strong>{" "}has{" "}
            {plural(paidCount, "paid invoice")}. Paid invoices are kept for your records, so this project
            can only be hidden.
          </p>
          {alreadyHidden ? (
            <p>
              It&rsquo;s already hidden, so it stays off your project lists and dashboard. Nothing else is
              needed.
            </p>
          ) : (
            <p>
              Hiding takes it off your project lists and dashboard. Nothing is erased: the invoices, media and
              history stay, and you can restore the project anytime.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  const assetParts = counts
    ? [
        counts.media ? plural(counts.media, "photo, video or file", "photos, videos and files") : null,
        counts.tours ? plural(counts.tours, "360° tour") : null,
        counts.models ? plural(counts.models, "3D model") : null,
      ].filter(Boolean)
    : [];

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Are you sure you want to delete this project?"
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button
            variant="outline"
            className="w-full min-h-11 text-red-600 hover:text-red-700"
            disabled={busy}
            onClick={() => run("keep_media")}
          >
            {pending === "keep_media" ? "Deleting…" : "Delete project, keep media"}
          </Button>
          <Button
            variant="destructive"
            className="w-full min-h-11"
            disabled={busy}
            onClick={() => run("delete_media")}
          >
            {pending === "delete_media" ? "Deleting…" : "Delete project and all media"}
          </Button>
          <Button variant="outline" className="w-full min-h-11" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-muted">
        <p>
          <strong className="text-heading">{projectName}</strong>{" "}will be permanently deleted. This can’t be
          undone. Its estimates, unpaid invoices, schedule, video reviews, share links and Marketing Kit go with
          it. The client record is not changed.
        </p>
        <p>
          <strong className="text-heading">Delete project, keep media</strong> leaves the photos, videos, files,
          tours and 3D models in your Media library, still listed under this client.
        </p>
        <p>
          <strong className="text-heading">Delete project and all media</strong> also deletes
          {assetParts.length ? ` ${assetParts.join(", ")}` : " every attached photo, video, file, tour and 3D model"}{" "}
          and removes the files from storage, which frees up space.
        </p>
        {!alreadyHidden && (
          <p className="text-xs">Just want it out of the way? Use Hide instead — it can be restored later.</p>
        )}
      </div>
    </Modal>
  );
}

export function DeleteClientModal({
  open,
  onClose,
  clientId,
  clientName,
  projectCount,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  projectCount?: number;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function run() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/delete`, { method: "POST" });
      if (!res.ok) {
        toast.error(await errorText(res, "Failed to delete client"));
        return;
      }
      toast.success("Client deleted — their projects and media were kept");
      onDeleted();
    } catch {
      toast.error("Failed to delete client");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Are you sure you want to delete this client?"
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button variant="destructive" className="w-full min-h-11" disabled={pending} onClick={run}>
            {pending ? "Deleting…" : "Delete client"}
          </Button>
          <Button variant="outline" className="w-full min-h-11" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-muted">
        <p>
          <strong className="text-heading">{clientName}</strong>{" "}and their contact details, notes, messages and
          saved brand profile will be permanently deleted. This can’t be undone. Their portal login will no
          longer show any projects.
        </p>
        <p>
          {projectCount
            ? `Their ${plural(projectCount, "project")} and all media stay in ShootPortal. `
            : "Their projects and media stay in ShootPortal. "}
          A project shared with another client moves to that client; otherwise it is kept with no client.
        </p>
      </div>
    </Modal>
  );
}
