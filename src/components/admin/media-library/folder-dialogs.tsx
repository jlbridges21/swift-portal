"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Folder, FolderPlus, ImageIcon, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemoteImage } from "@/components/ui/remote-image";
import type { LibraryAsset } from "@/lib/media-library";
import {
  LIBRARY_FOLDER_NAME_MAX,
  folderItemCountLabel,
  normalizeLibraryFolderName,
  type LibraryFolderSummary,
} from "@/lib/library-folder-types";
import { useThumbUrls } from "@/components/admin/media-library/library-ui";
import { cn } from "@/lib/utils";

/** Create or rename a folder. `onSubmit` resolves to an error message, or null on success. */
export function FolderNameDialog({
  open,
  mode,
  initialName = "",
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "rename";
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [open, initialName]);

  async function submit() {
    const parsed = normalizeLibraryFolderName(name);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (mode === "rename" && parsed.name === initialName) {
      onClose();
      return;
    }
    setBusy(true);
    const err = await onSubmit(parsed.name);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={mode === "create" ? "New folder" : "Rename folder"}
      className="sm:max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11 sm:min-h-10">
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void submit()} disabled={busy || !name.trim()} className="min-h-11 sm:min-h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create folder" : "Save"}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="library-folder-name" className="text-sm font-medium text-heading">
          Folder name
        </label>
        <Input
          id="library-folder-name"
          autoFocus
          value={name}
          maxLength={LIBRARY_FOLDER_NAME_MAX}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Aerial Shots"
          aria-invalid={Boolean(error)}
          aria-describedby="library-folder-name-help"
          className="min-h-11"
        />
        <p id="library-folder-name-help" className={cn("text-xs", error ? "text-red-600" : "text-muted")} role={error ? "alert" : undefined}>
          {error ?? "Folders organize media from any project. Nothing is copied or moved."}
        </p>
      </form>
    </Modal>
  );
}

/**
 * Pick a folder for N selected items, or create one on the spot. `onPick` resolves when the
 * add finished (the dialog shows progress and closes itself on success).
 */
export function AddToFolderDialog({
  open,
  count,
  folders,
  excludeFolderId,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  count: number;
  folders: LibraryFolderSummary[];
  /** Hide the folder currently open (copying into itself is a no-op). */
  excludeFolderId?: string | null;
  onClose: () => void;
  onPick: (folder: { id: string; name: string }) => Promise<boolean>;
  onCreate: (name: string) => Promise<{ id: string; name: string } | string>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setBusyId(null);
      setCreating(false);
      setNewName("");
      setCreateError(null);
    }
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return folders
      .filter((f) => f.id !== excludeFolderId)
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  }, [folders, query, excludeFolderId]);

  async function pick(folder: { id: string; name: string }) {
    setBusyId(folder.id);
    const ok = await onPick(folder);
    setBusyId(null);
    if (ok) onClose();
  }

  async function create() {
    const parsed = normalizeLibraryFolderName(newName);
    if ("error" in parsed) {
      setCreateError(parsed.error);
      return;
    }
    setBusyId("__new__");
    const result = await onCreate(parsed.name);
    if (typeof result === "string") {
      setBusyId(null);
      setCreateError(result);
      return;
    }
    const ok = await onPick(result);
    setBusyId(null);
    if (ok) onClose();
  }

  const busy = busyId !== null;
  const label = count === 1 ? "1 item" : `${count.toLocaleString()} items`;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={`Add ${label} to a folder`} className="sm:max-w-md">
      <div className="space-y-3">
        <p className="text-sm text-muted">The originals stay where they are — folders just organize them.</p>
        {folders.length > 6 ? (
          <label className="relative block">
            <span className="sr-only">Search folders</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders…"
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        ) : null}
        <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {visible.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">{folders.length ? "No folders match." : "No folders yet — create one below."}</li>
          ) : (
            visible.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pick(f)}
                  className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-subtle disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                    <Folder className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-heading">{f.name}</span>
                    <span className="block text-xs text-muted">{folderItemCountLabel(f.itemCount)}</span>
                  </span>
                  {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
        {creating ? (
          <form
            className="space-y-2 rounded-xl border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input
              autoFocus
              value={newName}
              maxLength={LIBRARY_FOLDER_NAME_MAX}
              onChange={(e) => {
                setNewName(e.target.value);
                setCreateError(null);
              }}
              placeholder="New folder name"
              aria-label="New folder name"
              className="min-h-11"
            />
            {createError ? (
              <p className="text-xs text-red-600" role="alert">
                {createError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="min-h-10" disabled={busy} onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" size="sm" className="min-h-10" disabled={busy || !newName.trim()}>
                {busyId === "__new__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                Create &amp; add
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" className="min-h-11 w-full" disabled={busy} onClick={() => setCreating(true)}>
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Choose the folder cover from its photos, or go back to automatic. */
export function CoverPickerDialog({
  open,
  folder,
  onClose,
  onSave,
}: {
  open: boolean;
  folder: LibraryFolderSummary | null;
  onClose: () => void;
  onSave: (assetId: string | null) => Promise<boolean>;
}) {
  const [photos, setPhotos] = useState<LibraryAsset[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thumbs = useThumbUrls(photos?.map((p) => p.id) ?? []);

  useEffect(() => {
    if (!open || !folder) return;
    setPhotos(null);
    setSelected(folder.coverMode === "manual" ? folder.coverAssetId : null);
    const qs = new URLSearchParams({ library_folder: folder.id, type: "photo", sort: "added", limit: "60" });
    void fetch(`/api/media/library?${qs}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { assets: LibraryAsset[] }) => setPhotos(d.assets))
      .catch(() => {
        setPhotos([]);
        toast.error("Couldn't load this folder's photos.");
      });
  }, [open, folder]);

  async function save() {
    setBusy(true);
    const ok = await onSave(selected);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Change cover"
      className="sm:max-w-2xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11 sm:min-h-10">
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void save()} disabled={busy || photos === null} className="min-h-11 sm:min-h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save cover
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
            selected === null ? "border-accent bg-accent-subtle/60" : "border-border hover:bg-subtle"
          )}
          aria-pressed={selected === null}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-heading">Automatic</span>
            <span className="block text-xs text-muted">Use the most recently added photo.</span>
          </span>
          {selected === null ? <Check className="h-5 w-5 text-accent" aria-hidden /> : null}
        </button>

        {photos === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <ImageIcon className="h-6 w-6 text-muted" aria-hidden />
            <p className="text-sm text-muted">Add photos to this folder to choose a cover.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-pressed={selected === p.id}
                  aria-label={`Use ${p.title} as cover`}
                  className={cn(
                    "relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 bg-subtle",
                    selected === p.id ? "border-accent" : "border-transparent hover:border-border"
                  )}
                >
                  {thumbs[p.id] ? <RemoteImage src={thumbs[p.id]} alt="" fill sizes="160px" className="object-cover" /> : null}
                  {selected === p.id ? (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                      <Check className="h-4 w-4" aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos && photos.length >= 60 ? <p className="text-xs text-muted">Showing the 60 most recently added photos.</p> : null}
      </div>
    </Modal>
  );
}
