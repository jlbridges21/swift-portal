"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  ImageIcon,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { MediaUploadModal } from "@/components/admin/media-upload-modal";
import { usePhotoShareDialog } from "@/components/photos/photo-share-dialog";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/media-library";
import {
  LIBRARY_FOLDER_SORT_OPTIONS,
  folderItemCountLabel,
  sortLibraryFolders,
  type LibraryFolderSort,
  type LibraryFolderSummary,
} from "@/lib/library-folder-types";
import { cn } from "@/lib/utils";
import { AssetBrowser, type LibraryFilterOptions } from "@/components/admin/media-library/asset-browser";
import { FolderGalleryCard, FolderListRow, FolderStripCard, folderHref } from "@/components/admin/media-library/folder-cards";
import { CoverPickerDialog, FolderNameDialog } from "@/components/admin/media-library/folder-dialogs";
import { LibrarySearch } from "@/components/admin/media-library/library-filters";
import { ViewModeToggle, shortDate, useStoredViewMode, useThumbUrls } from "@/components/admin/media-library/library-ui";
import {
  addedToFolderMessage,
  changeFolderItems,
  createLibraryFolderRequest,
  deleteLibraryFolderRequest,
  fetchLibraryFolders,
  updateLibraryFolderRequest,
  type FolderPermissions,
} from "@/components/admin/media-library/folder-client";

export type MediaLibraryView = "all" | "folders" | "folder";

/** Folders shown in the All Media row before "+N more". */
const STRIP_MAX = 16;

export type MediaLibraryWorkspaceProps = {
  view: MediaLibraryView;
  initialFolders: LibraryFolderSummary[];
  foldersSetupRequired: boolean;
  /** Unfiltered library size for the All Media tab (null = load lazily). */
  libraryTotal: number | null;
  folder?: { id: string; name: string } | null;
  browser?: {
    initialAssets: LibraryAsset[];
    initialTotal: number;
    initialKindCounts: Partial<Record<LibraryAssetKind, number>>;
    initialQuery?: string;
  };
  filterOptions: LibraryFilterOptions;
  permissions: FolderPermissions;
  openUploadOnMount?: boolean;
  pickForFolder?: { id: string; name: string } | null;
};

function TabLink({ href, active, icon: Icon, label, short, count }: { href: string; active: boolean; icon: typeof Folder; label: string; short: string; count: number | null }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors sm:flex-none sm:gap-2 sm:px-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active ? "bg-card text-accent shadow-sm ring-1 ring-border" : "text-muted hover:text-heading"
      )}
    >
      <Icon className={cn("hidden h-4 w-4 shrink-0 min-[400px]:block", active ? "text-accent" : "text-muted")} aria-hidden />
      <span className="truncate sm:hidden">{short}</span>
      <span className="hidden truncate sm:inline">{label}</span>
      {count !== null ? (
        <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-accent-subtle text-accent" : "bg-card text-muted")}>
          {count.toLocaleString()}
        </span>
      ) : null}
    </Link>
  );
}

export function MediaLibraryWorkspace({
  view,
  initialFolders,
  foldersSetupRequired,
  libraryTotal: initialLibraryTotal,
  folder: initialFolder = null,
  browser,
  filterOptions,
  permissions,
  openUploadOnMount = false,
  pickForFolder = null,
}: MediaLibraryWorkspaceProps) {
  const router = useRouter();
  const [folders, setFolders] = useState(initialFolders);
  const [setupRequired, setSetupRequired] = useState(foldersSetupRequired);
  const [libraryTotal, setLibraryTotal] = useState<number | null>(initialLibraryTotal);
  const [currentFolder, setCurrentFolder] = useState(initialFolder);
  const [uploadOpen, setUploadOpen] = useState(openUploadOnMount);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [nameDialog, setNameDialog] = useState<{ mode: "create" } | { mode: "rename"; folder: LibraryFolderSummary } | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolderSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [coverFor, setCoverFor] = useState<LibraryFolderSummary | null>(null);
  const [menu, setMenu] = useState<{ folder: LibraryFolderSummary; anchor: ActionMenuAnchor } | null>(null);
  const [folderSort, setFolderSort] = useState<LibraryFolderSort>("name_asc");
  const [folderQuery, setFolderQuery] = useState("");
  const [folderView, setFolderView] = useStoredViewMode("sp:media:folders-view");
  const share = usePhotoShareDialog((id, summary, kind) => {
    if (kind === "library_folder") setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, share: summary } : f)));
  });
  const foldersReady = !setupRequired;

  useEffect(() => setCurrentFolder(initialFolder), [initialFolder]);

  const refreshFolders = useCallback(() => {
    void fetchLibraryFolders()
      .then((r) => {
        setFolders(r.folders);
        setSetupRequired(r.setupRequired);
      })
      .catch(() => {});
  }, []);

  // Tab count for All Media when the server didn't compute it (Folders views).
  useEffect(() => {
    if (libraryTotal !== null) return;
    void fetch("/api/media/library?limit=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { total?: number } | null) => {
        if (typeof d?.total === "number") setLibraryTotal(d.total);
      })
      .catch(() => {});
  }, [libraryTotal]);

  const folderSummary = currentFolder ? folders.find((f) => f.id === currentFolder.id) ?? null : null;
  // Covers (photo, or a video's existing poster) for both the strip and the Folders tab. A
  // manual cover whose thumbnail can't load (deleted, processing, no access) falls back to the
  // automatic cover, then to the folder icon.
  const coverIds = useMemo(
    () => (view === "folder" ? [] : folders.flatMap((f) => [f.coverAssetId, f.autoCoverAssetId])),
    [folders, view]
  );
  const covers = useThumbUrls(coverIds);
  const coverUrlFor = (f: LibraryFolderSummary): string | null =>
    (f.coverAssetId ? covers[f.coverAssetId] : undefined) ?? (f.autoCoverAssetId ? covers[f.autoCoverAssetId] : undefined) ?? null;

  function openFolderShare(f: { id: string; name: string }) {
    share.openShare({ id: f.id, name: f.name, kind: "library_folder", thumbUrl: null });
  }

  async function dropOnFolder(target: LibraryFolderSummary, keys: string[]) {
    if (!permissions.organize || !keys.length) return;
    try {
      const r = await changeFolderItems(target.id, keys, "add");
      toast.success(addedToFolderMessage(target.name, r));
      refreshFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add to the folder.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const err = await deleteLibraryFolderRequest(deleting.id);
    setDeleteBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`Deleted folder “${deleting.name}”. Its media is still in your library.`);
    setFolders((prev) => prev.filter((f) => f.id !== deleting.id));
    const wasCurrent = currentFolder?.id === deleting.id;
    setDeleting(null);
    if (wasCurrent) router.push("/admin/media/folders");
  }

  const folderMenuItems: ActionMenuItem[] = menu
    ? [
        { id: "open", label: "Open", icon: FolderOpen, onSelect: () => router.push(folderHref(menu.folder.id)) },
        ...(permissions.shareFolders
          ? ([{ id: "share", label: "Share", icon: Share2, onSelect: () => openFolderShare(menu.folder) }] satisfies ActionMenuItem[])
          : []),
        ...(permissions.organize
          ? ([
              { id: "rename", label: "Rename", icon: Pencil, onSelect: () => setNameDialog({ mode: "rename", folder: menu.folder }) },
              { id: "cover", label: "Change cover", icon: ImagePlus, onSelect: () => setCoverFor(menu.folder) },
              { id: "add", label: "Add from library", icon: FolderPlus, onSelect: () => router.push(`/admin/media?addTo=${menu.folder.id}`) },
            ] satisfies ActionMenuItem[])
          : []),
        ...(permissions.deleteFolders
          ? ([
              { type: "separator", id: "sep" },
              {
                id: "delete",
                label: "Delete folder",
                description: "The media inside is kept",
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(menu.folder),
              },
            ] satisfies ActionMenuItem[])
          : []),
      ]
    : [];

  const visibleFolders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase();
    return sortLibraryFolders(q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders, folderSort);
  }, [folders, folderQuery, folderSort]);
  const stripFolders = useMemo(() => sortLibraryFolders(folders, "updated").slice(0, STRIP_MAX), [folders]);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollStrip = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  // All Media: folders as one compact, horizontally scrolling row under the filters.
  const scrollable = folders.length > 3;

  // All Media: "Folders" heading + compact cover-preview cards in one horizontal row, ending with
  // a dashed "Create Folder" card. With no folders, only that card shows (no empty row).
  const folderStrip =
    view === "all" && foldersReady && (folders.length || permissions.organize) ? (
      <section aria-labelledby="folders-strip-heading" className="min-w-0 space-y-2.5">
        <div className="flex items-center gap-2">
          <h2 id="folders-strip-heading" className="text-lg font-semibold text-heading">
            Folders
          </h2>
          {scrollable ? (
            <div className="ml-auto hidden items-center gap-1 lg:flex">
              <button type="button" onClick={() => scrollStrip(-1)} aria-label="Scroll folders left" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:bg-subtle hover:text-heading">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => scrollStrip(1)} aria-label="Scroll folders right" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:bg-subtle hover:text-heading">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
          {folders.length ? (
            <Link
              href="/admin/media/folders"
              className={cn("inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-accent hover:underline", scrollable ? "ml-auto lg:ml-3" : "ml-auto")}
            >
              View All Folders <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
        <div
          ref={stripRef}
          className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 py-1 sm:mx-0 sm:scroll-px-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="grid auto-cols-[minmax(16.5rem,22rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(18rem,23rem)] [&>li]:snap-start">
            {stripFolders.map((f) => (
              <li key={f.id} className="min-w-0">
                <FolderStripCard
                  folder={f}
                  coverUrl={coverUrlFor(f)}
                  onMenu={(folder, el) => setMenu({ folder, anchor: { kind: "element", element: el } })}
                  onDropItems={permissions.organize ? (t, keys) => void dropOnFolder(t, keys) : undefined}
                />
              </li>
            ))}
            {folders.length > STRIP_MAX ? (
              <li className="min-w-0">
                <Link
                  href="/admin/media/folders"
                  className="flex h-[5.25rem] items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-sm font-semibold text-accent shadow-sm hover:bg-accent-subtle/40"
                >
                  +{(folders.length - STRIP_MAX).toLocaleString()} more folders <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ) : null}
            {permissions.organize ? (
              <li className="min-w-0">
                <button
                  type="button"
                  onClick={() => setNameDialog({ mode: "create" })}
                  className="flex h-[5.25rem] w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-accent/30 bg-accent-subtle/20 text-sm font-semibold text-accent transition-colors hover:border-accent/60 hover:bg-accent-subtle/50"
                >
                  <Plus className="h-5 w-5" aria-hidden />
                  {folders.length ? "Create Folder" : "Create your first folder"}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    ) : null;

  // Upload split button: the menu uploads straight into a folder (by reference).
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [uploadMenu, setUploadMenu] = useState<ActionMenuAnchor | null>(null);
  const openUpload = (folderId: string | null) => {
    setUploadFolderId(folderId);
    setUploadOpen(true);
  };
  const uploadMenuItems: ActionMenuItem[] = [
    { id: "lib", label: "Upload to library", description: "Unassigned, or pick a project", icon: Upload, onSelect: () => openUpload(null) },
    ...(foldersReady && folders.length
      ? ([
          { type: "label", id: "folders-label", label: "Upload into a folder" },
          ...sortLibraryFolders(folders, "updated")
            .slice(0, 8)
            .map((f) => ({ id: `f-${f.id}`, label: f.name, icon: Folder, onSelect: () => openUpload(f.id) }) satisfies ActionMenuItem),
        ] satisfies ActionMenuItem[])
      : []),
  ];

  const tabs = (
    <div className="flex min-w-0 items-center gap-2">
      <nav aria-label="Media Library" className="min-w-0 flex-1 sm:flex-none">
        <div className="flex rounded-xl border border-border bg-subtle p-1">
          <TabLink href="/admin/media" active={view === "all"} icon={ImageIcon} label="All Media" short="All" count={libraryTotal} />
          <TabLink href="/admin/media/folders" active={view !== "all"} icon={Folder} label="Folders" short="Folders" count={foldersReady ? folders.length : null} />
        </div>
      </nav>
      <div className="ml-auto flex shrink-0 gap-2">
        {permissions.organize && foldersReady ? (
          <Button variant="outline" onClick={() => setNameDialog({ mode: "create" })} className="h-11 rounded-xl px-3 sm:px-4" aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Folder</span>
          </Button>
        ) : null}
        {permissions.upload ? (
          <div className="flex h-11 overflow-hidden rounded-xl bg-accent text-accent-foreground shadow-sm">
            <button
              type="button"
              onClick={() => openUpload(currentFolder?.id ?? null)}
              className="inline-flex items-center gap-2 px-3 text-sm font-semibold hover:bg-black/10 sm:px-4"
              aria-label={currentFolder ? "Upload to this folder" : "Upload media"}
            >
              <Upload className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{currentFolder ? "Upload" : "Upload Media"}</span>
            </button>
            {!currentFolder ? (
              <button
                type="button"
                onClick={(e) => setUploadMenu({ kind: "element", element: e.currentTarget })}
                aria-label="Upload options"
                aria-haspopup="menu"
                className="flex w-10 items-center justify-center border-l border-white/25 hover:bg-black/10"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const setupNotice = setupRequired ? (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 surface-dark:border-amber-500/30 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
      Folders aren&apos;t enabled for this account yet. Your media library works as usual.
    </p>
  ) : null;

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      {tabs}
      {setupNotice}

      {view === "folders" ? (
        <section className="min-w-0 space-y-4" aria-labelledby="folders-heading">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h2 id="folders-heading" className="text-xl font-semibold text-heading">
                Folders
              </h2>
              <p className="text-sm text-muted">Organize your media into custom collections.</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <LibrarySearch value={folderQuery} onChange={setFolderQuery} placeholder="Search folders…" className="min-w-0 flex-1 basis-full sm:basis-56 md:w-56 md:flex-none" />
              <ViewModeToggle value={folderView} onChange={setFolderView} />
              <label className="relative inline-flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-heading shadow-sm sm:w-48 sm:flex-none">
                <span className="truncate">{LIBRARY_FOLDER_SORT_OPTIONS.find((o) => o.value === folderSort)?.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 rotate-90 text-muted" aria-hidden />
                <select
                  aria-label="Sort folders"
                  value={folderSort}
                  onChange={(e) => setFolderSort(e.target.value as LibraryFolderSort)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {LIBRARY_FOLDER_SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!foldersReady ? null : folders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
                <Folder className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-base font-semibold text-heading">No folders yet</h3>
              <p className="max-w-md text-sm text-muted">
                Create folders like “Aerial Shots” or “Website Assets” and add media from any project. Folders hold references, so
                your storage doesn&apos;t grow and originals stay in their projects.
              </p>
              {permissions.organize ? (
                <Button variant="accent" className="min-h-11" onClick={() => setNameDialog({ mode: "create" })}>
                  <FolderPlus className="h-4 w-4" /> New Folder
                </Button>
              ) : null}
            </div>
          ) : visibleFolders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm text-muted">No folders match “{folderQuery}”.</p>
              <button type="button" onClick={() => setFolderQuery("")} className="mt-2 min-h-10 text-sm font-medium text-accent hover:underline">
                Clear search
              </button>
            </div>
          ) : folderView === "grid" ? (
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFolders.map((f) => (
                <li key={f.id} className="min-w-0">
                  <FolderGalleryCard
                    folder={f}
                    coverUrl={coverUrlFor(f)}
                    onMenu={(folder, el) => setMenu({ folder, anchor: { kind: "element", element: el } })}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {visibleFolders.map((f) => (
                <FolderListRow
                  key={f.id}
                  folder={f}
                  coverUrl={coverUrlFor(f)}
                  updatedLabel={shortDate(f.updatedAt)}
                  onMenu={(folder, el) => setMenu({ folder, anchor: { kind: "element", element: el } })}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view === "folder" && currentFolder ? (
        <section className="min-w-0 space-y-1" aria-labelledby="folder-title">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted">
            <Link href="/admin/media" className="shrink-0 rounded hover:text-accent">
              Media Library
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <Link href="/admin/media/folders" className="shrink-0 rounded hover:text-accent">
              Folders
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate text-heading" aria-current="page">
              {currentFolder.name}
            </span>
          </nav>
          <div className="flex min-w-0 flex-wrap items-center gap-3 pt-1">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <FolderOpen className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="folder-title" className="break-words text-xl font-semibold text-heading sm:text-2xl">
                {currentFolder.name}
              </h2>
              <p className="text-sm text-muted">
                {folderSummary ? folderItemCountLabel(folderSummary.itemCount) : " "}
                {folderSummary && (folderSummary.share.link || folderSummary.share.people) ? (
                  <span className="text-accent"> · Shared{folderSummary.share.link ? " with a link" : ""}</span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {permissions.organize ? (
                <Link
                  href={`/admin/media?addTo=${currentFolder.id}`}
                  className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-heading shadow-sm hover:bg-subtle sm:inline-flex"
                >
                  <FolderPlus className="h-4 w-4" aria-hidden /> Add from library
                </Link>
              ) : null}
              {permissions.shareFolders ? (
                <Button variant="accent" className="h-11 rounded-xl px-4" onClick={() => openFolderShare(currentFolder)}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              ) : null}
              {folderSummary ? (
                <button
                  type="button"
                  onClick={(e) => setMenu({ folder: folderSummary, anchor: { kind: "element", element: e.currentTarget } })}
                  aria-label="Folder options"
                  aria-haspopup="menu"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted shadow-sm hover:bg-subtle hover:text-heading"
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {browser && (view === "all" || (view === "folder" && currentFolder)) ? (
        <AssetBrowser
          key={view === "folder" ? currentFolder?.id : "all"}
          scope={view === "folder" && currentFolder ? { kind: "folder", folder: currentFolder } : { kind: "all" }}
          initialAssets={browser.initialAssets}
          initialTotal={browser.initialTotal}
          initialKindCounts={browser.initialKindCounts}
          initialQuery={browser.initialQuery}
          filterOptions={filterOptions}
          folders={folders}
          foldersReady={foldersReady}
          permissions={permissions}
          reloadSignal={reloadSignal}
          onFoldersChanged={refreshFolders}
          onShareFolder={openFolderShare}
          onUpload={() => setUploadOpen(true)}
          pickForFolder={pickForFolder}
          belowFilters={folderStrip}
        />
      ) : null}

      <ActionMenu anchor={menu?.anchor ?? null} onClose={() => setMenu(null)} items={folderMenuItems} title={menu?.folder.name ?? "Folder"} />

      <FolderNameDialog
        open={nameDialog !== null}
        mode={nameDialog?.mode ?? "create"}
        initialName={nameDialog?.mode === "rename" ? nameDialog.folder.name : ""}
        onClose={() => setNameDialog(null)}
        onSubmit={async (name) => {
          if (nameDialog?.mode === "rename") {
            const err = await updateLibraryFolderRequest(nameDialog.folder.id, { name });
            if (err) return err;
            setFolders((prev) => prev.map((f) => (f.id === nameDialog.folder.id ? { ...f, name } : f)));
            if (currentFolder?.id === nameDialog.folder.id) setCurrentFolder({ ...currentFolder, name });
            toast.success("Folder renamed");
            setNameDialog(null);
            router.refresh();
            return null;
          }
          const created = await createLibraryFolderRequest(name);
          if (typeof created === "string") return created;
          setNameDialog(null);
          refreshFolders();
          toast.success(`Created “${created.name}”`, {
            action: { label: "Open", onClick: () => router.push(folderHref(created.id)) },
          });
          return null;
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={`Delete “${deleting?.name ?? ""}”?`}
        confirmLabel="Delete folder"
        destructive
        busy={deleteBusy}
      >
        <p>
          Only the folder is deleted. The {deleting ? folderItemCountLabel(deleting.itemCount) : "items"} in it stay in their projects and
          in your library.
        </p>
        {deleting && (deleting.share.link || deleting.share.people) ? (
          <p className="rounded-md bg-amber-50 p-2 text-amber-900 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
            This folder is shared. Its share links stop working immediately.
          </p>
        ) : null}
      </ConfirmDialog>

      <CoverPickerDialog
        open={coverFor !== null}
        folder={coverFor}
        onClose={() => setCoverFor(null)}
        onSave={async (assetId) => {
          if (!coverFor) return false;
          const err = await updateLibraryFolderRequest(coverFor.id, { coverAssetId: assetId });
          if (err) {
            toast.error(err);
            return false;
          }
          toast.success("Cover updated");
          refreshFolders();
          return true;
        }}
      />

      <MediaUploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          if (openUploadOnMount) router.replace(view === "all" ? "/admin/media" : window.location.pathname);
        }}
        projects={filterOptions.projects}
        libraryFolders={foldersReady ? folders.map((f) => ({ id: f.id, name: f.name })) : undefined}
        defaultLibraryFolderId={uploadFolderId ?? currentFolder?.id ?? null}
        onAddedToFolder={() => refreshFolders()}
        onUploaded={() => {
          setReloadSignal((n) => n + 1);
          setLibraryTotal(null);
        }}
      />

      <ActionMenu anchor={uploadMenu} onClose={() => setUploadMenu(null)} items={uploadMenuItems} title="Upload media" />
      {share.dialog}
    </div>
  );
}
