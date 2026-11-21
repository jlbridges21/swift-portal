"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Folder, FolderInput, FolderPlus, Folders, ImageIcon, Loader2, Play, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemoteImage } from "@/components/ui/remote-image";
import type { LibraryAsset } from "@/lib/media-library";
import {
  LIBRARY_FOLDER_NAME_MAX,
  folderContentsLabel,
  libraryFolderDescendants,
  libraryFolderTrail,
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
  parentName = null,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "rename";
  initialName?: string;
  /** Creating a subfolder (v136): the folder it goes in. */
  parentName?: string | null;
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
      title={mode === "rename" ? "Rename folder" : parentName ? `New folder in “${parentName}”` : "New folder"}
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
 * Drill-down folder picker shared by "Move items" and "Move folder": the list shows only the
 * folders at the current level (by their own names); clicking one opens it, the path at the top
 * jumps back up, and the primary button moves into the folder being viewed.
 */
function FolderPickerDialog({
  open,
  title,
  note,
  folders,
  startAt,
  hidden,
  alreadyHereId,
  rootTarget,
  canNest,
  onClose,
  onMove,
  onCreate,
}: {
  open: boolean;
  title: string;
  note: string;
  /** Every folder in the business, with parentId (names only, not paths). */
  folders: LibraryFolderSummary[];
  /** Where the picker opens (null = all folders). */
  startAt: string | null;
  /** Folders that can't be a destination and aren't listed (a folder being moved and its subfolders). */
  hidden?: Set<string>;
  /** Moving here changes nothing ("Already here"). null means the top level. */
  alreadyHereId?: string | null;
  /** The top level is a valid destination (folders can live there; media can't). */
  rootTarget: boolean;
  /** Subfolders are available (v136): new folders go inside the one being viewed. */
  canNest: boolean;
  onClose: () => void;
  /** Resolves to an error message, or null when done (the caller closes the dialog). */
  onMove: (folder: { id: string; name: string } | null) => Promise<string | null>;
  onCreate?: (name: string, parentId: string | null) => Promise<{ id: string; name: string } | string>;
}) {
  const [location, setLocation] = useState<string | null>(startAt);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"move" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  /** Folders made in this dialog, shown before the parent's folder list refreshes. */
  const [made, setMade] = useState<LibraryFolderSummary[]>([]);

  useEffect(() => {
    if (!open) return;
    setLocation(startAt);
    setQuery("");
    setBusy(null);
    setError(null);
    setCreating(false);
    setNewName("");
    setMade([]);
  }, [open, startAt]);

  const all = useMemo(() => {
    const known = new Set(folders.map((f) => f.id));
    const list = [...folders, ...made.filter((m) => !known.has(m.id))];
    return hidden?.size ? list.filter((f) => !hidden.has(f.id)) : list;
  }, [folders, made, hidden]);
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);
  // A location that disappeared (deleted, or hidden) falls back to the top level.
  const here = location ? byId.get(location) ?? null : null;
  const trail = useMemo(() => (here ? libraryFolderTrail(all, here.id) : []), [all, here]);
  const children = useMemo(
    () =>
      all
        .filter((f) => (f.parentId ?? null) === (here?.id ?? null))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })),
    [all, here]
  );
  const childCount = (id: string) => all.filter((f) => f.parentId === id).length;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return all
      .filter((f) => f.name.toLowerCase().includes(q))
      .map((f) => ({ folder: f, path: libraryFolderTrail(all, f.id).slice(0, -1).map((t) => t.name).join(" › ") }))
      .sort((a, b) => a.folder.name.localeCompare(b.folder.name, undefined, { sensitivity: "base", numeric: true }));
  }, [all, query]);

  function go(id: string | null) {
    setLocation(id);
    setQuery("");
    setError(null);
    setCreating(false);
  }

  const hereId = here?.id ?? null;
  const isAlreadyHere = alreadyHereId !== undefined && alreadyHereId === hereId;
  const canMoveHere = (here !== null || rootTarget) && !isAlreadyHere;
  const moveLabel = isAlreadyHere ? "Already here" : here ? `Move to “${here.name}”` : rootTarget ? "Move to top level" : "Open a folder to move here";

  async function moveHere() {
    if (!canMoveHere) return;
    setBusy("move");
    setError(null);
    const err = await onMove(here ? { id: here.id, name: here.name } : null);
    setBusy(null);
    if (err) setError(err);
  }

  async function create() {
    if (!onCreate) return;
    const parsed = normalizeLibraryFolderName(newName);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    const parentId = canNest ? hereId : null;
    setBusy("create");
    setError(null);
    const result = await onCreate(parsed.name, parentId);
    setBusy(null);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    const now = new Date().toISOString();
    setMade((prev) => [
      ...prev,
      {
        id: result.id,
        name: result.name,
        parentId,
        subfolderCount: 0,
        itemCount: 0,
        coverAssetId: null,
        autoCoverAssetId: null,
        coverMode: "auto",
        createdAt: now,
        updatedAt: now,
        share: { link: false, people: 0 },
      },
    ]);
    setCreating(false);
    setNewName("");
    // Open the new folder so "Move to …" points at it.
    setLocation(result.id);
  }

  const working = busy !== null;
  const parentOfHere = here ? (here.parentId ?? null) : null;

  return (
    <Modal
      open={open}
      onClose={working ? () => {} : onClose}
      title={title}
      className="sm:max-w-md"
      footer={
        <div className="space-y-2">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Button variant="accent" className="min-h-11 w-full" disabled={!canMoveHere || working} onClick={() => void moveHere()}>
            {busy === "move" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
            <span className="truncate">{moveLabel}</span>
          </Button>
          {onCreate ? (
            creating ? (
              <form
                className="flex gap-2"
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
                    setError(null);
                  }}
                  placeholder={canNest && here ? `New folder in “${here.name}”` : "New folder name"}
                  aria-label="New folder name"
                  className="min-h-11 min-w-0 flex-1"
                />
                <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={working || !newName.trim()}>
                  {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
                <Button type="button" variant="ghost" className="min-h-11 shrink-0 px-3" disabled={working} onClick={() => setCreating(false)} aria-label="Cancel new folder">
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <Button variant="outline" className="min-h-11 w-full" disabled={working} onClick={() => setCreating(true)}>
                <FolderPlus className="h-4 w-4" /> New folder{canNest && here ? ` in “${here.name}”` : ""}
              </Button>
            )
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        {/* Where you are: back arrow + clickable path. */}
        <nav aria-label="Folder location" className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-subtle/60 p-1.5">
          <button
            type="button"
            onClick={() => go(parentOfHere)}
            disabled={!here || working}
            aria-label="Back to the parent folder"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-card hover:text-heading disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <ol className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <li className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => go(null)}
                disabled={working}
                aria-current={here ? undefined : "location"}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-1.5",
                  here ? "text-muted hover:bg-card hover:text-heading" : "font-semibold text-heading"
                )}
              >
                <Folders className="h-4 w-4" aria-hidden />
                All folders
              </button>
            </li>
            {trail.map((f, i) => {
              const last = i === trail.length - 1;
              return (
                <li key={f.id} className="flex min-w-0 shrink-0 items-center">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <button
                    type="button"
                    onClick={() => go(f.id)}
                    disabled={working || last}
                    aria-current={last ? "location" : undefined}
                    title={f.name}
                    className={cn(
                      "h-8 max-w-[11rem] truncate rounded-md px-1.5",
                      last ? "font-semibold text-heading" : "text-muted hover:bg-card hover:text-heading"
                    )}
                  >
                    {f.name}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <p className="text-xs text-muted">{note}</p>

        {all.length > 6 ? (
          <label className="relative block">
            <span className="sr-only">Search all folders</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all folders…"
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        ) : null}

        <ul className="max-h-[42vh] min-h-[7rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {results ? (
            results.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">No folders match.</li>
            ) : (
              results.map(({ folder: f, path }) => (
                <FolderPickerRow key={f.id} name={f.name} sub={path ? `in ${path}` : "Top level"} hasChildren={false} disabled={working} onOpen={() => go(f.id)} />
              ))
            )
          ) : children.length === 0 ? (
            <li className="flex flex-col items-center gap-1 px-4 py-7 text-center">
              <Folder className="h-5 w-5 text-muted" aria-hidden />
              <span className="text-sm text-muted">
                {here ? `No folders inside “${here.name}”.` : "No folders yet. Create one below."}
              </span>
            </li>
          ) : (
            children.map((f) => (
              <FolderPickerRow
                key={f.id}
                name={f.name}
                sub={folderContentsLabel({ itemCount: f.itemCount, subfolderCount: childCount(f.id) })}
                hasChildren={childCount(f.id) > 0}
                current={alreadyHereId === f.id}
                disabled={working}
                onOpen={() => go(f.id)}
              />
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}

function FolderPickerRow({
  name,
  sub,
  hasChildren,
  current,
  disabled,
  onOpen,
}: {
  name: string;
  sub: string;
  hasChildren: boolean;
  current?: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="group flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-subtle disabled:opacity-60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <Folder className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-heading" title={name}>
            {name}
          </span>
          <span className="block truncate text-xs text-muted">{current ? "Current location" : sub}</span>
        </span>
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 transition-colors", hasChildren ? "text-heading" : "text-muted/40 group-hover:text-muted")}
          aria-hidden
        />
      </button>
    </li>
  );
}

/** Move N selected items into a folder (each item lives in one folder). */
export function AddToFolderDialog({
  open,
  count,
  folders,
  currentFolderId,
  canNest,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  count: number;
  /** Every folder, with parentId and its own name. */
  folders: LibraryFolderSummary[];
  /** The folder being viewed, if any: the picker opens beside it and marks it "Already here". */
  currentFolderId?: string | null;
  canNest: boolean;
  onClose: () => void;
  onPick: (folder: { id: string; name: string }) => Promise<boolean>;
  onCreate: (name: string, parentId: string | null) => Promise<{ id: string; name: string } | string>;
}) {
  const startAt = useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId)?.parentId ?? null : null),
    [folders, currentFolderId]
  );
  const label = count === 1 ? "1 item" : `${count.toLocaleString()} items`;
  return (
    <FolderPickerDialog
      open={open}
      title={`Move ${label}`}
      note="Open a folder, then move here. Items leave the folder they're in now; originals stay in their projects."
      folders={folders}
      startAt={startAt}
      alreadyHereId={currentFolderId ?? undefined}
      rootTarget={false}
      canNest={canNest}
      onClose={onClose}
      onCreate={onCreate}
      onMove={async (folder) => {
        if (!folder) return "Open a folder to move into.";
        const ok = await onPick(folder);
        if (ok) onClose();
        return ok ? null : "";
      }}
    />
  );
}

/** A photo, or an uploaded video whose stored poster exists (posters are reused, never generated here). */
function coverEligibility(a: LibraryAsset): "ok" | "processing" | "no" {
  if (a.media_source === "youtube") return "no";
  if (a.kind === "photo") return a.has_file ? "ok" : "no";
  if (a.kind === "video") return a.thumbnail_url ? "ok" : "processing";
  return "no";
}

const COVER_PAGE = 60;

/**
 * Choose the folder cover: any photo or video poster, from this folder or from the whole
 * library (it doesn't have to be in the folder), or go back to automatic.
 */
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
  const [scope, setScope] = useState<"folder" | "library">("folder");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<LibraryAsset[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thumbs = useThumbUrls(items?.filter((p) => coverEligibility(p) === "ok").map((p) => p.id) ?? []);

  useEffect(() => {
    if (!open || !folder) return;
    setScope(folder.itemCount > 0 ? "folder" : "library");
    setQuery("");
    setDebounced("");
    setSelected(folder.coverMode === "manual" ? folder.coverAssetId : null);
  }, [open, folder]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open || !folder) return;
    let cancelled = false;
    setItems(null);
    const qs = new URLSearchParams({ sort: scope === "folder" ? "added" : "newest", limit: String(COVER_PAGE) });
    qs.append("type", "photo");
    qs.append("type", "video");
    if (scope === "folder") qs.set("library_folder", folder.id);
    if (debounced) qs.set("q", debounced);
    void fetch(`/api/media/library?${qs}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { assets: LibraryAsset[] }) => {
        if (!cancelled) setItems(d.assets.filter((a) => coverEligibility(a) !== "no"));
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        toast.error("Couldn't load photos and videos.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, folder, scope, debounced]);

  async function save() {
    setBusy(true);
    const ok = await onSave(selected);
    setBusy(false);
    if (ok) onClose();
  }

  const tab = (value: "folder" | "library", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scope === value}
      onClick={() => setScope(value)}
      className={cn(
        "h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors sm:flex-none",
        scope === value ? "bg-card text-accent shadow-sm ring-1 ring-border" : "text-muted hover:text-heading"
      )}
    >
      {label}
    </button>
  );

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
          <Button variant="accent" onClick={() => void save()} disabled={busy} className="min-h-11 sm:min-h-10">
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
            <span className="block text-xs text-muted">Use the most recently added photo (or video, if there are no photos).</span>
          </span>
          {selected === null ? <Check className="h-5 w-5 text-accent" aria-hidden /> : null}
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div role="tablist" aria-label="Choose from" className="flex rounded-xl border border-border bg-subtle p-1">
            {tab("folder", "This folder")}
            {tab("library", "All media")}
          </div>
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search photos and videos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search photos and videos…"
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        {items === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <ImageIcon className="h-6 w-6 text-muted" aria-hidden />
            <p className="text-sm text-muted">
              {debounced
                ? "No photos or videos match your search."
                : scope === "folder"
                  ? "This folder has no photos or videos yet. Pick one from All media instead."
                  : "No photos or videos in your library yet."}
            </p>
          </div>
        ) : (
          <ul className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.map((p) => {
              const state = coverEligibility(p);
              const isSel = selected === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={state !== "ok"}
                    onClick={() => setSelected(p.id)}
                    aria-pressed={isSel}
                    aria-label={state === "ok" ? `Use ${p.title} as cover` : `${p.title}: thumbnail still processing`}
                    title={p.title}
                    className={cn(
                      "relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 bg-subtle disabled:cursor-not-allowed",
                      isSel ? "border-accent" : "border-transparent hover:border-border"
                    )}
                  >
                    {state === "ok" && thumbs[p.id] ? (
                      <RemoteImage src={thumbs[p.id]} alt="" fill sizes="160px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[11px] text-muted">
                        {state === "processing" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Thumbnail processing
                          </>
                        ) : (
                          <ImageIcon className="h-5 w-5" aria-hidden />
                        )}
                      </span>
                    )}
                    {p.kind === "video" ? (
                      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                        <Play className="h-2.5 w-2.5" aria-hidden /> Video
                      </span>
                    ) : null}
                    {isSel ? (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                        <Check className="h-4 w-4" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {items && items.length >= COVER_PAGE ? <p className="text-xs text-muted">Showing the first {COVER_PAGE}. Search to find a specific photo or video.</p> : null}
      </div>
    </Modal>
  );
}

/** Move a folder (with everything in it) inside another folder, or to the top level. */
export function MoveFolderDialog({
  open,
  folder,
  folders,
  onClose,
  onMove,
  onCreate,
}: {
  open: boolean;
  folder: LibraryFolderSummary | null;
  /** Every folder in the business (with parentId). */
  folders: LibraryFolderSummary[];
  onClose: () => void;
  onMove: (parentId: string | null) => Promise<string | null>;
  onCreate?: (name: string, parentId: string | null) => Promise<{ id: string; name: string } | string>;
}) {
  // The folder and its own subfolders can't hold it.
  const hidden = useMemo(
    () => (folder ? new Set([folder.id, ...libraryFolderDescendants(folders, folder.id).map((f) => f.id)]) : new Set<string>()),
    [folder, folders]
  );
  return (
    <FolderPickerDialog
      open={open}
      title={`Move “${folder?.name ?? ""}”`}
      note="Everything inside moves with it. Its shares keep working, and it also appears in shares of the folder you move it into."
      folders={folders}
      startAt={folder?.parentId ?? null}
      hidden={hidden}
      alreadyHereId={folder?.parentId ?? null}
      rootTarget
      canNest
      onClose={onClose}
      onCreate={onCreate}
      onMove={(target) => onMove(target?.id ?? null)}
    />
  );
}
