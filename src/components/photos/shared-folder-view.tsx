"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Folder, ImageIcon, Images, Link2, Lock, ShieldCheck, Upload, UploadCloud } from "lucide-react";
import { PhotoShareHeader } from "@/components/photos/photo-share-viewer";
import { FILTERS, Lightbox, Tile } from "@/components/photos/shared-media-viewer";
import {
  DropOverlay,
  SHARED_UPLOAD_ACCEPT,
  SharedNewFolderButton,
  SharedUploadButton,
  UploadTray,
  useSharedFolderUploader,
  useWindowFileDrop,
} from "@/components/photos/shared-folder-uploader";
import type { SharedFolderCover, SharedSubfolder } from "@/lib/library-folder-shares";
import { sharedItemUrl, type SharedMediaItem, type SharedMediaKind } from "@/lib/shared-media-types";
import { MAX_PHOTO_FILE_SIZE_BYTES, MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/upload/constants";
import { cn } from "@/lib/utils";

/**
 * Public page for a shared Media Library folder (/shared/{token}, ?folder= for subfolders).
 *
 *   hero          the folder's cover photo, breadcrumb, name and counts
 *   permissions   "Uploads allowed" bar — only for "Can upload" links
 *   drop zone     compact; files go to the folder being viewed
 *   folders       large photo cards; files dropped on a card (or its Upload button) go there
 *   gallery       the folder's own photos and videos, opened in the lightbox
 *
 * Every image and byte is fetched through the share token and re-authorized on the server.
 */

type Crumb = { id: string; name: string };

function folderUrl(token: string, folderId: string | null): string {
  const base = `/shared/${encodeURIComponent(token)}`;
  return folderId ? `${base}?folder=${encodeURIComponent(folderId)}` : base;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function countsLine(folders: number, items: number, itemsFirst = false): string {
  const parts: string[] = [];
  if (folders) parts.push(plural(folders, "folder"));
  if (items || !folders) parts[itemsFirst ? "unshift" : "push"](plural(items, "item"));
  return parts.join(" · ");
}

function coverUrl(token: string, cover: SharedFolderCover, size: "card" | "hero"): string {
  if (cover.kind === "video") return sharedItemUrl(token, cover.key, "poster");
  return sharedItemUrl(token, cover.key, size === "hero" ? "preview" : "thumb");
}

/** Image that fades in once loaded and reports failures (cached images included). */
function FadeImage({ src, className, onFail }: { src: string; className?: string; onFail: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
      onLoad={() => setLoaded(true)}
      onError={onFail}
    />
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  token,
  name,
  trail,
  cover,
  folderCount,
  itemCount,
  access,
  overlapped = false,
}: {
  token: string;
  name: string;
  /** The permissions bar overlaps the bottom edge: keep the text clear of it. */
  overlapped?: boolean;
  trail: Crumb[];
  cover: SharedFolderCover | null;
  folderCount: number;
  itemCount: number;
  access: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = cover && !failed ? coverUrl(token, cover, "hero") : null;
  return (
    <section
      aria-labelledby="shared-folder-title"
      className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-accent/70 text-white shadow-sm"
    >
      {src ? (
        <span className="absolute inset-0 -z-10 bg-slate-800">
          <span className="absolute inset-0 animate-pulse bg-slate-700" aria-hidden />
          <FadeImage src={src} onFail={() => setFailed(true)} className="relative h-full w-full object-cover" />
        </span>
      ) : (
        <Folder className="absolute -right-6 -top-8 -z-10 h-56 w-56 text-white/10 sm:h-72 sm:w-72" aria-hidden strokeWidth={1.25} />
      )}
      {/* Readable text over any photo: dark at the bottom-left, clear at the top-right. */}
      <span
        className={cn(
          "absolute inset-0 -z-10",
          src ? "bg-gradient-to-t from-black/75 via-black/35 to-black/10 sm:bg-gradient-to-tr sm:from-black/75 sm:via-black/30 sm:to-transparent" : ""
        )}
        aria-hidden
      />
      <div className={cn("flex min-h-[11rem] flex-col justify-between gap-6 p-5 sm:min-h-[14rem] sm:p-8", overlapped && "pb-12 sm:pb-14")}>
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Shared folder
          </span>
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">{access}</span>
        </div>
        <div className="min-w-0 space-y-1.5">
          {trail.length > 1 ? (
            <nav aria-label="Folders" className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-white/80">
              {trail.slice(0, -1).map((f, i) => (
                <span key={f.id} className="flex min-w-0 items-center gap-1">
                  <Link
                    href={folderUrl(token, i === 0 ? null : f.id)}
                    className="max-w-[11rem] truncate rounded underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {f.name}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </span>
              ))}
              <span className="sr-only" aria-current="page">
                {name}
              </span>
            </nav>
          ) : null}
          <h1 id="shared-folder-title" className="break-words text-3xl font-semibold tracking-tight [text-shadow:0_1px_12px_rgba(0,0,0,0.25)] sm:text-4xl">
            {name}
          </h1>
          <p className="text-sm text-white/85 sm:text-base">{countsLine(folderCount, itemCount)}</p>
        </div>
      </div>
    </section>
  );
}

// ── Upload permissions + drop zone ───────────────────────────────────────────

/** Whole units for the limits line ("100 MB", "5 GB"), from the same constants the server enforces. */
function sizeLabel(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const SHORT_LIMITS_LABEL = `JPEG, PNG, WebP up to ${sizeLabel(MAX_PHOTO_FILE_SIZE_BYTES)} · MP4, MOV up to ${sizeLabel(MAX_VIDEO_FILE_SIZE_BYTES)}`;
const LIMITS_LABEL = `Photos up to ${sizeLabel(MAX_PHOTO_FILE_SIZE_BYTES)} · videos up to ${sizeLabel(MAX_VIDEO_FILE_SIZE_BYTES)}`;

function PermissionsBar({ canCreateFolders }: { canCreateFolders: boolean }) {
  return (
    <section
      aria-label="Upload access"
      className="relative z-10 mx-3 -mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)] sm:mx-6 sm:px-5 xl:flex-row xl:items-center xl:gap-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <UploadCloud className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-heading">Uploads allowed</p>
          <p className="text-sm text-muted">
            You can add photos{canCreateFolders ? ", videos and folders" : " and videos"} here — no account needed.
          </p>
        </div>
      </div>
      <ul className="hidden flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-muted sm:flex xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <li className="inline-flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" aria-hidden /> JPEG, PNG, WebP, MP4, MOV
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" aria-hidden /> {LIMITS_LABEL}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Private link
        </li>
      </ul>
    </section>
  );
}

function DropZone({ folderName, active, onFiles }: { folderName: string; active: boolean; onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-3 transition-colors sm:gap-4 sm:px-6 sm:py-5",
        active ? "border-accent bg-accent-subtle/60" : "border-border bg-card/60 hover:border-accent/50 hover:bg-accent-subtle/25"
      )}
    >
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
      <span
        className={cn(
          "hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors min-[400px]:flex",
          active ? "bg-accent text-accent-foreground" : "bg-accent-subtle text-accent"
        )}
      >
        <UploadCloud className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-heading">
          {active ? (
            "Drop to upload"
          ) : (
            <>
              <span className="sm:hidden">Add photos &amp; videos</span>
              <span className="hidden sm:inline">Drag &amp; drop photos or videos here</span>
            </>
          )}
        </p>
        <p className="truncate text-sm text-muted">
          <span className="hidden sm:inline">They&apos;ll be added to </span>
          <span className="sm:hidden">To </span>
          <span className="font-medium text-heading">“{folderName}”</span>
          <span className="hidden sm:inline">.</span>
        </p>
        <p className="mt-0.5 text-xs text-muted sm:hidden">{SHORT_LIMITS_LABEL}</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-heading shadow-sm transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4"
      >
        <Upload className="h-4 w-4" aria-hidden /> <span className="sm:hidden">Choose</span>
        <span className="hidden sm:inline">Choose files</span>
      </button>
    </div>
  );
}

// ── Folder cards ─────────────────────────────────────────────────────────────

function FolderCard({
  token,
  folder,
  onUpload,
}: {
  token: string;
  folder: SharedSubfolder;
  /** Upload-enabled links: files picked on the card or dropped on it go into this folder. */
  onUpload?: (files: FileList) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [over, setOver] = useState(false);
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  // A cover that can't load gives way to the first preview photo.
  const usable = folder.previews.filter((k) => !failedPreviews.has(k));
  const cover: SharedFolderCover | null = folder.cover && !failed ? folder.cover : usable[0] ? { key: usable[0], kind: "photo" } : null;
  const src = cover ? coverUrl(token, cover, "card") : null;
  const previews = usable.filter((k) => k !== cover?.key);
  const shown = (cover ? 1 : 0) + previews.length;
  const more = Math.max(0, folder.itemCount - shown);
  const contents =
    folder.itemCount || folder.subfolderCount ? countsLine(folder.subfolderCount, folder.itemCount, true) : "Empty folder";

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropProps = onUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!over) setOver(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <article
      {...dropProps}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        over ? "border-accent ring-4 ring-accent/25" : "border-border hover:border-accent/30"
      )}
    >
      <Link
        href={folderUrl(token, folder.id)}
        aria-label={`Open folder ${folder.name}`}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-subtle">
        {src ? (
          <>
            <span className="absolute inset-0 animate-pulse bg-subtle" aria-hidden />
            <FadeImage
              key={src}
              src={src}
              onFail={() => (cover && cover.key !== folder.cover?.key ? setFailedPreviews((prev) => new Set(prev).add(cover.key)) : setFailed(true))}
              className="relative h-full w-full object-cover duration-700 group-hover:scale-[1.04] [transition-property:opacity,transform]"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-subtle to-subtle">
            <Folder className="h-14 w-14 text-accent/40" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {previews.length || more ? (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5">
            {previews.map((k) => (
              <span key={k} className="hidden h-11 w-14 overflow-hidden rounded-lg bg-slate-200 ring-2 ring-white/90 shadow-md min-[400px]:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sharedItemUrl(token, k, "thumb")}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setFailedPreviews((prev) => new Set(prev).add(k))}
                />
              </span>
            ))}
            {more ? (
              <span className="flex h-11 min-w-[3.5rem] items-center justify-center rounded-lg bg-black/60 px-2 text-sm font-semibold text-white ring-2 ring-white/90 backdrop-blur-sm">
                +{more.toLocaleString()}
              </span>
            ) : null}
          </div>
        ) : null}
        {over ? (
          <div className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-5 w-5" aria-hidden /> Drop to upload here
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Folder className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-heading" title={folder.name}>
            {folder.name}
          </h3>
          <p className="truncate text-sm text-muted">{contents}</p>
        </div>
        {onUpload ? (
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
                if (e.target.files?.length) onUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={`Upload to ${folder.name}`}
              className="relative z-[2] inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-heading transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Upload className="h-4 w-4" aria-hidden />
              <span className="hidden min-[400px]:inline">Upload</span>
            </button>
          </>
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        )}
      </div>
    </article>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function SectionHeading({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-heading">
        {title}
      </h2>
      {count !== undefined ? <span className="text-sm text-muted">{count.toLocaleString()}</span> : null}
    </div>
  );
}

export function LibraryFolderShareViewer({
  token,
  folderName,
  folderId = null,
  trail = [],
  subfolders = [],
  items,
  cover = null,
  totalItems,
  allowDownload,
  allowUpload = false,
  allowCreateFolders = false,
  truncated,
}: {
  token: string;
  folderName: string;
  /** The subfolder being shown; null = the shared folder itself. */
  folderId?: string | null;
  /** From the shared folder down to this one. */
  trail?: Crumb[];
  subfolders?: SharedSubfolder[];
  items: SharedMediaItem[];
  /** Header image (the folder's cover, else something inside it). */
  cover?: SharedFolderCover | null;
  /** Items in this folder and everything beneath it. */
  totalItems?: number;
  allowDownload: boolean;
  /** "Can upload" link (v135). */
  allowUpload?: boolean;
  /** "Can upload" guests may also add folders here (v136). */
  allowCreateFolders?: boolean;
  truncated: boolean;
}) {
  const uploader = useSharedFolderUploader(token, folderId);
  const dragging = useWindowFileDrop(uploader.addFiles, allowUpload);
  const [filter, setFilter] = useState<"all" | SharedMediaKind>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const kinds = useMemo(() => new Set(items.map((i) => i.kind)), [items]);
  const visible = useMemo(() => (filter === "all" ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const openIndex = openKey ? visible.findIndex((i) => i.key === openKey) : -1;
  const lockedCount = allowDownload ? items.filter((i) => i.downloadLocked).length : 0;
  const access = allowUpload ? "Can upload" : allowDownload ? "Can download" : "View only";
  const empty = items.length === 0 && subfolders.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PhotoShareHeader>
        {allowUpload ? (
          <div className="flex shrink-0 items-center gap-2">
            {allowCreateFolders ? <SharedNewFolderButton token={token} folderId={folderId} folderName={folderName} /> : null}
            <SharedUploadButton onFiles={uploader.addFiles} />
          </div>
        ) : null}
      </PhotoShareHeader>

      <main
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-4 sm:gap-8 sm:px-6 sm:py-6",
          uploader.rows.length > 0 && "pb-44 sm:pb-10"
        )}
      >
        <div className="flex flex-col">
          <Hero
            token={token}
            name={folderName}
            trail={trail}
            cover={cover}
            folderCount={subfolders.length}
            itemCount={totalItems ?? items.length}
            access={access}
            overlapped={allowUpload}
          />
          {allowUpload ? <PermissionsBar canCreateFolders={allowCreateFolders} /> : null}
        </div>

        {allowUpload ? <DropZone folderName={folderName} active={dragging} onFiles={uploader.addFiles} /> : null}

        {subfolders.length ? (
          <section aria-labelledby="shared-folders-heading" className="space-y-3 sm:space-y-4">
            <SectionHeading id="shared-folders-heading" title="Folders" count={subfolders.length} />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {subfolders.map((f) => (
                <li key={f.id} className="min-w-0">
                  <FolderCard
                    token={token}
                    folder={f}
                    onUpload={allowUpload ? (files) => uploader.addFiles(files, { id: f.id, name: f.name }) : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {items.length ? (
          <section aria-labelledby="shared-media-heading" className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading id="shared-media-heading" title={subfolders.length ? "In this folder" : "Photos & videos"} count={items.length} />
              {kinds.size > 1 ? (
                <div className="-mx-3 w-[calc(100%+1.5rem)] overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0 [&::-webkit-scrollbar]:hidden">
                  <div role="tablist" aria-label="Filter by type" className="inline-flex gap-1.5">
                    {FILTERS.filter((f) => f.value === "all" || kinds.has(f.value)).map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                          "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                          filter === f.value ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-heading hover:bg-subtle"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {lockedCount > 0 ? (
              <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {plural(lockedCount, "item")} can be viewed now and downloaded once the shoot is finalized.
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {visible.map((item) => (
                <li key={item.key} className="min-w-0">
                  <Tile token={token} item={item} onOpen={() => setOpenKey(item.key)} />
                </li>
              ))}
            </ul>
            {truncated ? (
              <p className="text-center text-xs text-muted">Showing the {items.length.toLocaleString()} most recently added items.</p>
            ) : null}
          </section>
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
              <Images className="h-6 w-6" aria-hidden />
            </span>
            <p className="font-semibold text-heading">{allowUpload ? "No photos or videos yet" : "Nothing here yet"}</p>
            <p className="max-w-sm text-sm text-muted">
              {allowUpload ? "Add the first ones with the upload box above." : "Photos and videos added to this folder will appear here."}
            </p>
          </div>
        ) : null}
      </main>

      {openIndex >= 0 ? (
        <Lightbox
          token={token}
          items={visible}
          index={openIndex}
          onIndexChange={(i) => setOpenKey(visible[i]?.key ?? null)}
          onClose={() => setOpenKey(null)}
        />
      ) : null}

      {allowUpload ? (
        <>
          <UploadTray rows={uploader.rows} onRetry={uploader.retry} onClear={uploader.clearFinished} />
          {dragging ? <DropOverlay folderName={folderName} hasSubfolders={subfolders.length > 0} /> : null}
        </>
      ) : null}
    </div>
  );
}
