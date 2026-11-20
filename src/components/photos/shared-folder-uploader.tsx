"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, ChevronUp, FolderPlus, Loader2, Plus, RotateCw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LIBRARY_FOLDER_NAME_MAX, normalizeLibraryFolderName } from "@/lib/library-folder-types";
import { formatFileSize } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Guest uploads for a Media Library folder shared with "Can upload". The share token is the only
 * credential: each file is signed by /api/public/shared/{token}/upload, PUT straight to storage,
 * then saved into the folder. The gallery refreshes as files land.
 */

const PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXT = new Set(["mp4", "mov", "m4v"]);
const MAX_PARALLEL = 3;
/** Accept attribute for the file picker. */
export const SHARED_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v,.jpg,.jpeg,.png,.webp,.mp4,.mov,.m4v";

type Status = "queued" | "uploading" | "saving" | "done" | "error";

type UploadRow = {
  id: string;
  /** Destination folder; null = the shared folder itself. */
  folderId: string | null;
  /** Shown in the tray when it differs from the page being viewed. */
  folderName: string | null;
  file: File;
  mediaType: "photo" | "video";
  status: Status;
  progress: number;
  error?: string;
};

function mediaTypeOf(file: File): "photo" | "video" | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (PHOTO_EXT.has(ext) || /^image\/(jpe?g|png|webp)$/.test(file.type)) return "photo";
  if (VIDEO_EXT.has(ext) || /^video\/(mp4|quicktime|x-m4v|m4v)$/.test(file.type)) return "video";
  return null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error(json.error || "Upload failed. Please try again.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json;
}

function putFile(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.status === 413 ? "This file is too large." : "The upload was interrupted. Please retry."));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error. Check your connection and retry.")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

export function useSharedFolderUploader(token: string, folderId: string | null = null) {
  const router = useRouter();
  const endpoint = `/api/public/shared/${encodeURIComponent(token)}/upload`;
  const [rows, setRows] = useState<UploadRow[]>([]);
  const rowsRef = useRef<UploadRow[]>([]);
  const active = useRef(0);
  /** Finished uploads per destination folder in the current batch ("" = the shared folder). */
  const batchDone = useRef(new Map<string, number>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The pump re-runs itself when a slot frees up; a ref avoids a self-referencing callback. */
  const pumpRef = useRef<() => void>(() => {});

  const patch = useCallback((id: string, next: Partial<UploadRow>) => {
    rowsRef.current = rowsRef.current.map((r) => (r.id === id ? { ...r, ...next } : r));
    setRows(rowsRef.current);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 1200);
  }, [router]);

  const pump = useCallback(() => {
    while (active.current < MAX_PARALLEL) {
      const next = rowsRef.current.find((r) => r.status === "queued");
      if (!next) break;
      active.current += 1;
      patch(next.id, { status: "uploading", progress: 1, error: undefined });
      void (async () => {
        try {
          const sign = await postJson<{ signedUrl: string; ticket: string; mimeType: string }>(endpoint, {
            action: "sign",
            fileName: next.file.name,
            mimeType: next.file.type,
            fileSize: next.file.size,
            mediaType: next.mediaType,
            folderId: next.folderId,
          });
          await putFile(sign.signedUrl, next.file, sign.mimeType, (pct) => patch(next.id, { progress: pct }));
          patch(next.id, { status: "saving", progress: 99 });
          let saved = false;
          for (let attempt = 0; attempt < 3 && !saved; attempt++) {
            try {
              await postJson(endpoint, { action: "complete", ticket: sign.ticket });
              saved = true;
            } catch (err) {
              const status = (err as { status?: number }).status ?? 0;
              if (attempt === 2 || (status >= 400 && status < 500)) throw err;
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            }
          }
          patch(next.id, { status: "done", progress: 100 });
          const k = next.folderId ?? "";
          batchDone.current.set(k, (batchDone.current.get(k) ?? 0) + 1);
          scheduleRefresh();
        } catch (err) {
          patch(next.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
        } finally {
          active.current -= 1;
          const pending = rowsRef.current.some((r) => r.status === "queued" || r.status === "uploading" || r.status === "saving");
          if (!pending && batchDone.current.size) {
            const done = [...batchDone.current];
            batchDone.current = new Map();
            for (const [k, count] of done) {
              void postJson(endpoint, { action: "done", count, folderId: k || null }).catch(() => {});
            }
          }
          pumpRef.current();
        }
      })();
    }
  }, [endpoint, patch, scheduleRefresh]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  /**
   * Queue files. With no `target`, they go to the folder being viewed; a subfolder card passes
   * its own folder so files dropped on it land there.
   */
  const addFiles = useCallback(
    (files: FileList | File[], target?: { id: string; name: string }) => {
      const list = Array.from(files);
      if (!list.length) return;
      const added: UploadRow[] = list.map((file) => {
        const mediaType = mediaTypeOf(file);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          folderId: target ? target.id : folderId,
          folderName: target ? target.name : null,
          file,
          mediaType: mediaType ?? "photo",
          status: mediaType ? "queued" : "error",
          progress: 0,
          error: mediaType ? undefined : "Only photos (JPEG, PNG, WebP) and videos (MP4, MOV) can be uploaded.",
        };
      });
      rowsRef.current = [...rowsRef.current, ...added];
      setRows(rowsRef.current);
      pump();
    },
    [pump, folderId]
  );

  const retry = useCallback(
    (id: string) => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row || row.status !== "error" || !mediaTypeOf(row.file)) return;
      patch(id, { status: "queued", progress: 0, error: undefined });
      pump();
    },
    [patch, pump]
  );

  const clearFinished = useCallback(() => {
    rowsRef.current = rowsRef.current.filter((r) => r.status !== "done" && r.status !== "error");
    setRows(rowsRef.current);
  }, []);

  const busy = rows.some((r) => r.status === "queued" || r.status === "uploading" || r.status === "saving");

  // Leaving mid-upload loses the files in flight.
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    []
  );

  return { rows, addFiles, retry, clearFinished, busy };
}

/** Hidden file input + the "Upload" button for the header. */
export function SharedUploadButton({ onFiles, compact }: { onFiles: (files: FileList) => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SHARED_UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        variant="accent"
        size="sm"
        className={cn("min-h-10 shrink-0", compact && "w-10 px-0")}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload photos and videos"
      >
        <Plus className="h-4 w-4" />
        {compact ? null : <span>Upload</span>}
      </Button>
    </>
  );
}

/** "New folder" for a "Can upload" guest: creates a folder inside the one being viewed. */
export function SharedNewFolderButton({ token, folderId, folderName }: { token: string; folderId: string | null; folderName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    const parsed = normalizeLibraryFolderName(name);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/public/shared/${encodeURIComponent(token)}/upload`, {
        action: "create_folder",
        name: parsed.name,
        folderId,
      });
      setOpen(false);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the folder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-10 shrink-0"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="New folder"
      >
        <FolderPlus className="h-4 w-4" />
        <span className="hidden sm:inline">New folder</span>
      </Button>
      <Modal open={open} onClose={busy ? () => {} : () => setOpen(false)} title={`New folder in “${folderName}”`} className="sm:max-w-md">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label htmlFor="shared-new-folder" className="text-sm font-medium text-heading">
            Folder name
          </label>
          <Input
            id="shared-new-folder"
            autoFocus
            maxLength={LIBRARY_FOLDER_NAME_MAX}
            value={name}
            placeholder="e.g. Twilight shots"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" className="min-h-10" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create folder
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Full-window drop target: shows an overlay while files are dragged over the page. */
export function useWindowFileDrop(onFiles: (files: FileList) => void, enabled: boolean) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    // Capture phase: always clear the drag state, even when a folder card handles the drop.
    const onDropCapture = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = 0;
      setDragging(false);
    };
    // Bubble phase: a drop anywhere else uploads to the folder being viewed.
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer?.files.length) onFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDropCapture, true);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDropCapture, true);
      window.removeEventListener("drop", onDrop);
    };
  }, [enabled, onFiles]);
  return dragging;
}

/**
 * Hint shown while files are dragged over the page. Deliberately light (no blur, no full-screen
 * card) so the folder cards underneath stay visible as drop targets.
 */
export function DropOverlay({ folderName, hasSubfolders }: { folderName: string; hasSubfolders?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 ring-4 ring-inset ring-accent/40">
      <div className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex justify-center px-4">
        <div className="flex max-w-md items-center gap-3 rounded-full bg-heading px-5 py-3 text-sm text-white shadow-2xl">
          <UploadCloud className="h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0">
            Drop to add to <strong className="font-semibold">“{folderName}”</strong>
            {hasSubfolders ? <span className="opacity-75"> — or onto a folder</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Floating progress panel, bottom-right. */
export function UploadTray({
  rows,
  onRetry,
  onClear,
}: {
  rows: UploadRow[];
  onRetry: (id: string) => void;
  onClear: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!rows.length) return null;
  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "error").length;
  const inFlight = rows.length - done - failed;
  const totalBytes = rows.reduce((a, r) => a + r.file.size, 0);
  const sentBytes = rows.reduce((a, r) => a + (r.status === "done" ? r.file.size : (r.file.size * r.progress) / 100), 0);
  const overall = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0;
  const title = inFlight
    ? `Uploading… ${done} of ${rows.length - failed} done`
    : failed
      ? `${done} uploaded · ${failed} failed`
      : `${done} ${done === 1 ? "file" : "files"} uploaded`;

  return (
    <div
      role="region"
      aria-label="Uploads"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-5 sm:w-96"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {inFlight ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
        ) : failed ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
        ) : (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" aria-live="polite">
          {title}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show uploads" : "Hide uploads"}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-subtle"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!inFlight ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Close uploads"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-subtle"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {inFlight ? (
        <div className="h-1 w-full bg-subtle" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${overall}%` }} />
        </div>
      ) : null}
      {collapsed ? null : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-heading" title={r.file.name}>
                  {r.file.name}
                </p>
                {r.folderName ? <p className="truncate text-[11px] text-muted">to {r.folderName}</p> : null}
                {r.status === "error" ? (
                  <p className="text-xs text-red-600">{r.error}</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-300", r.status === "done" ? "bg-emerald-500" : "bg-accent")}
                        style={{ width: `${r.status === "queued" ? 0 : r.progress}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted">
                      {r.status === "queued" ? "Waiting" : r.status === "saving" ? "Saving" : r.status === "done" ? "Done" : `${r.progress}%`}
                    </span>
                  </div>
                )}
                <p className="sr-only">{formatFileSize(r.file.size)}</p>
              </div>
              {r.status === "error" && mediaTypeOf(r.file) ? (
                <button
                  type="button"
                  onClick={() => onRetry(r.id)}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent hover:bg-subtle"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
                </button>
              ) : r.status === "done" ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Uploaded" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
