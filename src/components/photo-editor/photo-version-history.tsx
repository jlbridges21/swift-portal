"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatFileSize } from "@/lib/brand";
import type { PhotoEditorPhoto, PhotoVersionSummary } from "@/lib/photo-editor/shared";
import { restorePhotoVersion } from "./save-to-project";

/**
 * Original + saved edits for one photo. Choosing a version changes what clients receive;
 * nothing is deleted, so it can always be switched back.
 */
export function PhotoVersionHistory({
  open,
  onClose,
  photo,
  canEdit,
  onRestored,
  overlayClassName = "z-[260]",
}: {
  open: boolean;
  onClose: () => void;
  photo: Pick<PhotoEditorPhoto, "id" | "name">;
  canEdit: boolean;
  onRestored: (kind: "original" | "edit", versionNumber: number, settings: PhotoVersionSummary["settings"]) => void;
  overlayClassName?: string;
}) {
  const [versions, setVersions] = useState<PhotoVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVersions(null);
    setError(null);
    fetch(`/api/media/editor/photos/${photo.id}/versions`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't load versions.");
        if (!cancelled) setVersions(data.versions as PhotoVersionSummary[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load versions.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, photo.id]);

  async function choose(v: PhotoVersionSummary) {
    setBusyId(v.id);
    try {
      await restorePhotoVersion(photo.id, v.kind === "original" ? "original" : v.id);
      setVersions((prev) => prev?.map((x) => ({ ...x, isCurrent: x.id === v.id })) ?? prev);
      onRestored(v.kind, v.versionNumber, v.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the version.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Versions & original" overlayClassName={overlayClassName}>
      <p className="mb-3 text-sm text-muted">
        <span className="font-medium text-foreground">{photo.name}</span> — the version marked{" "}
        <span className="font-medium text-foreground">Delivered</span> is what clients see and download.
      </p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {!versions ? (
        error ? null : (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        )
      ) : versions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          This photo hasn&apos;t been edited yet, so clients see the original upload.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-subtle">
                {v.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-heading">
                  {v.kind === "original" ? "Original upload" : `Edited version ${v.versionNumber - 1}`}
                </p>
                <p className="truncate text-xs text-muted">
                  {format(new Date(v.createdAt), "MMM d, yyyy · h:mm a")}
                  {v.createdByName && v.kind === "edit" ? ` · ${v.createdByName}` : ""}
                  {v.fileSize ? ` · ${formatFileSize(v.fileSize)}` : ""}
                </p>
              </div>
              {v.isCurrent ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 surface-dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Delivered
                </span>
              ) : canEdit ? (
                <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => void choose(v)}>
                  {busyId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {v.kind === "original" ? "Restore original" : "Deliver this"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
