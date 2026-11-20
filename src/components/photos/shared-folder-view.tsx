"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Folder,
  Home,
  ImageIcon,
  Images,
  Link2,
  Lock,
  MoreHorizontal,
  ShieldCheck,
  Upload,
  UploadCloud,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
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
import {
  SHARED_ZIP_FILES_PER_PART,
  sharedItemUrl,
  sharedZipUrl,
  type SharedMediaItem,
  type SharedMediaKind,
} from "@/lib/shared-media-types";
import type { DownloadQuality } from "@/lib/download-quality";
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
/** URL for a folder in this share (null = the shared folder itself). */
type HrefFor = (folderId: string | null) => string;

function makeHrefFor(base: string): HrefFor {
  return (folderId) => (folderId ? `${base}?folder=${encodeURIComponent(folderId)}` : base);
}

// ── Breadcrumbs ──────────────────────────────────────────────────────────────

/**
 * Home (the shared folder) › parents › current. Long paths collapse to Home › … › parent ›
 * current on phones; the … opens the hidden folders so every level stays reachable.
 */
function Breadcrumbs({ trail, hrefFor }: { trail: Crumb[]; hrefFor: HrefFor }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [moreOpen]);

  const crumbHref = (i: number) => hrefFor(i === 0 ? null : trail[i].id);
  // Phones show Home › … › parent › current. The Home icon already is the shared folder, so
  // its name is hidden there too; the … menu lists the folders in between.
  const phoneHidden = trail.length > 2 ? trail.slice(0, -2).map((_, k) => k) : [];
  const menuItems = phoneHidden.filter((k) => k > 0);
  const sep = <ChevronRight className="h-4 w-4 shrink-0 text-muted/60" aria-hidden />;
  const crumbClass =
    "min-w-0 truncate rounded-md px-1 py-0.5 font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 rounded-2xl border border-border bg-card/80 px-2.5 py-2 text-sm shadow-sm sm:px-3">
        <li className="flex shrink-0 items-center">
          <Link
            href={hrefFor(null)}
            aria-label={`Home: ${trail[0]?.name ?? "shared folder"}`}
            title={trail[0]?.name}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Home className="h-4 w-4" aria-hidden />
          </Link>
        </li>
        {/* Phones: one … in place of the folders between Home and the parent. */}
        {menuItems.length ? (
          <li ref={moreRef} className="relative flex shrink-0 items-center gap-1 sm:hidden">
            {sep}
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-label={`Show ${menuItems.length} more ${menuItems.length === 1 ? "folder" : "folders"}`}
              aria-expanded={moreOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
            {moreOpen ? (
              <ul className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] max-w-[70vw] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl">
                {menuItems.map((k) => (
                  <li key={trail[k].id}>
                    <Link
                      href={crumbHref(k)}
                      onClick={() => setMoreOpen(false)}
                      className="flex min-h-11 items-center gap-2 truncate px-3 text-sm font-medium text-heading hover:bg-subtle"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <span className="truncate">{trail[k].name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ) : null}
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          const isHidden = phoneHidden.includes(i);
          return (
            <li
              key={c.id}
              className={cn("min-w-0 items-center gap-1", isHidden ? "hidden sm:flex" : "flex", last ? "flex-1 sm:flex-none" : "max-w-[45%] sm:max-w-[14rem]")}
            >
              {sep}
              {last ? (
                <span aria-current="page" className="min-w-0 truncate px-1 font-semibold text-heading" title={c.name}>
                  {c.name}
                </span>
              ) : (
                <Link href={crumbHref(i)} className={crumbClass} title={c.name}>
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Download all ─────────────────────────────────────────────────────────────

/**
 * Header button: pick quality (print / MLS for photos), then download one ZIP — or, for big
 * folders, a list of parts so each download finishes reliably.
 */
function DownloadAllButton({ token, folderId, folderName, count }: { token: string; folderId: string | null; folderName: string; count: number }) {
  const [qualityOpen, setQualityOpen] = useState(false);
  const [partsFor, setPartsFor] = useState<DownloadQuality | null>(null);
  const parts = Math.ceil(count / SHARED_ZIP_FILES_PER_PART);

  function start(quality: DownloadQuality) {
    if (parts <= 1) {
      const a = document.createElement("a");
      a.href = sharedZipUrl(token, folderId, quality);
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    setPartsFor(quality);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setQualityOpen(true)}
        aria-label={`Download all ${count.toLocaleString()} files`}
        title={`Download all (${count.toLocaleString()} ${count === 1 ? "file" : "files"})`}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-heading shadow-sm transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Download all</span>
      </button>
      <DownloadQualityDialog
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
        title={`Download “${folderName}”`}
        zipMode
        confirmLabel={parts > 1 ? "Continue" : "Download ZIP"}
        onConfirm={start}
      />
      <Modal open={partsFor !== null} onClose={() => setPartsFor(null)} title={`Download “${folderName}”`} className="sm:max-w-md">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {count.toLocaleString()} files are split into {parts} ZIP files so each one downloads reliably. Download each part:
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {Array.from({ length: parts }, (_, i) => i + 1).map((part) => (
              <li key={part}>
                <a
                  href={partsFor ? sharedZipUrl(token, folderId, partsFor, part, parts) : "#"}
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm font-medium text-heading hover:bg-subtle"
                >
                  <span>
                    Part {part} of {parts}
                    <span className="ml-2 text-xs text-muted">
                      {Math.min(SHARED_ZIP_FILES_PER_PART, count - (part - 1) * SHARED_ZIP_FILES_PER_PART).toLocaleString()} files
                    </span>
                  </span>
                  <Download className="h-4 w-4 text-accent" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
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
  parentHref,
  parentName,
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
  /** Subfolders only: the immediate parent, for the back button. */
  parentHref: string | null;
  parentName: string | null;
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
        <div className="flex min-w-0 items-end gap-3 sm:gap-4">
          {parentHref ? (
            <Link
              href={parentHref}
              aria-label={`Back to ${parentName ?? "parent folder"}`}
              title={`Back to ${parentName ?? "parent folder"}`}
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/30 text-white ring-1 ring-white/30 backdrop-blur-md transition-colors hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          ) : null}
          <div className="min-w-0 space-y-1">
          <h1 id="shared-folder-title" className="break-words text-3xl font-semibold tracking-tight [text-shadow:0_1px_12px_rgba(0,0,0,0.25)] sm:text-4xl">
            {name}
          </h1>
          <p className="text-sm text-white/85 sm:text-base">{countsLine(folderCount, itemCount)}</p>
          </div>
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
  href,
  onUpload,
}: {
  token: string;
  folder: SharedSubfolder;
  href: string;
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
        href={href}
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
  downloadableCount = 0,
  basePath,
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
  /** Files "Download all" would include (0 hides the button). */
  downloadableCount?: number;
  /** Where folder links point; defaults to /shared/{token}. */
  basePath?: string;
  truncated: boolean;
}) {
  const hrefFor = makeHrefFor(basePath ?? `/shared/${encodeURIComponent(token)}`);
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;
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
        {allowUpload || (allowDownload && downloadableCount > 0) ? (
          <div className="flex shrink-0 items-center gap-2">
            {allowDownload && downloadableCount > 0 ? (
              <DownloadAllButton token={token} folderId={folderId} folderName={folderName} count={downloadableCount} />
            ) : null}
            {allowUpload && allowCreateFolders ? <SharedNewFolderButton token={token} folderId={folderId} folderName={folderName} /> : null}
            {allowUpload ? <SharedUploadButton onFiles={uploader.addFiles} /> : null}
          </div>
        ) : null}
      </PhotoShareHeader>

      <main
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-4 sm:gap-8 sm:px-6 sm:py-6",
          uploader.rows.length > 0 && "pb-44 sm:pb-10"
        )}
      >
        <Breadcrumbs trail={trail.length ? trail : [{ id: folderId ?? "root", name: folderName }]} hrefFor={hrefFor} />
        <div className="-mt-2 flex flex-col sm:-mt-4">
          <Hero
            token={token}
            name={folderName}
            parentHref={parent ? hrefFor(trail.length === 2 ? null : parent.id) : null}
            parentName={parent?.name ?? null}
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
                    href={hrefFor(f.id)}
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
