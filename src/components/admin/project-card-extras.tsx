"use client";

import { Suspense, use } from "react";
import { HardDrive } from "lucide-react";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { formatStorageSize } from "@/lib/format-bytes";
import type { ProjectStorageMap } from "@/lib/project-storage";
import { cn } from "@/lib/utils";

/**
 * Small "13.1 GB" label for a project card. Reads the board-wide storage map
 * the server streams in (one aggregated query for all cards); shows a quiet
 * placeholder while it loads and nothing if it could not be loaded.
 */
export function ProjectStorageLabel({
  projectId,
  storage,
  className,
}: {
  projectId: string;
  storage: Promise<ProjectStorageMap | null> | undefined;
  className?: string;
}) {
  if (!storage) return null;
  return (
    <Suspense
      fallback={
        <span
          aria-hidden
          className={cn("inline-block h-3 w-10 animate-pulse rounded bg-slate-200/80 surface-dark:bg-border/80", className)}
        />
      }
    >
      <ResolvedStorageLabel projectId={projectId} storage={storage} className={className} />
    </Suspense>
  );
}

function ResolvedStorageLabel({
  projectId,
  storage,
  className,
}: {
  projectId: string;
  storage: Promise<ProjectStorageMap | null>;
  className?: string;
}) {
  const map = use(storage);
  // null = could not be measured — hide rather than show a wrong number.
  if (!map) return null;
  const bytes = map[projectId] ?? 0;
  const label = bytes > 0 ? formatStorageSize(bytes) : "0 MB";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-medium tabular-nums text-muted",
        bytes === 0 && "opacity-70",
        className
      )}
      title={`Media storage: ${label}`}
    >
      <HardDrive className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">Media storage </span>
      {label}
    </span>
  );
}

/**
 * Hero image band for a narrow pipeline card — the same poster Client View
 * shows (the project's chosen cover, else its first photo), at a fixed short
 * aspect ratio so cards stay scannable. Images ignore pointer events so the
 * whole card still drags as one.
 */
export function ProjectHeroBand({
  projectId,
  heroUrls,
  className,
}: {
  projectId: string;
  heroUrls: Promise<Record<string, string | null>> | undefined;
  className?: string;
}) {
  if (!heroUrls) return null;
  const skeleton = (
    <div className={cn("animate-pulse bg-slate-200/80 surface-dark:bg-border/80", className)} />
  );
  return (
    <Suspense fallback={skeleton}>
      <ResolvedHeroBand projectId={projectId} heroUrls={heroUrls} className={className} />
    </Suspense>
  );
}

function ResolvedHeroBand({
  projectId,
  heroUrls,
  className,
}: {
  projectId: string;
  heroUrls: Promise<Record<string, string | null>>;
  className?: string;
}) {
  const map = use(heroUrls);
  return (
    <ProjectCoverImage
      src={map[projectId] ?? null}
      sizes="256px"
      className={cn("[&_img]:pointer-events-none", className)}
    />
  );
}
