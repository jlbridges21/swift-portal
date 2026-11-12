"use client";

import { useEffect, useRef, useState } from "react";
import { Box, FileText, Globe, ImageIcon, LayoutGrid, List, Video } from "lucide-react";
import type { LibraryAsset, LibraryAssetKind } from "@/lib/media-library";
import { fetchThumbUrls } from "@/lib/media-thumb-client";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

export const KIND_LABEL: Record<LibraryAssetKind, string> = {
  photo: "Photo",
  video: "Video",
  document: "File",
  tour: "360 Tour",
  model: "3D Model",
};

export function kindIcon(kind: LibraryAssetKind) {
  if (kind === "photo") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "tour") return Globe;
  if (kind === "model") return Box;
  return FileText;
}

export function assetKey(a: { kind: LibraryAssetKind; id: string }) {
  return `${a.kind}:${a.id}`;
}

export function parseAssetKey(key: string): { kind: LibraryAssetKind; id: string } {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) as LibraryAssetKind, id: key.slice(i + 1) };
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE_FMT.format(d);
}

export function formatDuration(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function fileExtension(asset: Pick<LibraryAsset, "file_name" | "mime_type">): string | null {
  const m = /\.([a-z0-9]{1,5})$/i.exec(asset.file_name ?? "");
  if (m) return m[1].toUpperCase();
  if (asset.mime_type === "application/pdf") return "PDF";
  return null;
}

/** "123 Main St, City" — or the project name / "Unassigned" when there's no address. */
export function assetLocation(asset: LibraryAsset): string {
  if (asset.property_address && asset.property_address !== "—") return asset.property_address;
  if (asset.project_id) return asset.project_name;
  return "Not in a project";
}

/** Grid / list segmented control remembered per surface in localStorage. */
export function useStoredViewMode(storageKey: string, fallback: ViewMode = "grid") {
  const [view, setView] = useState<ViewMode>(fallback);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === "grid" || v === "list") setView(v);
    } catch {
      /* storage blocked */
    }
  }, [storageKey]);
  const choose = (v: ViewMode) => {
    setView(v);
    try {
      window.localStorage.setItem(storageKey, v);
    } catch {
      /* storage blocked */
    }
  };
  return [view, choose] as const;
}

export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="inline-flex shrink-0 rounded-xl border border-border bg-card p-0.5 shadow-sm">
      {(
        [
          { v: "grid", label: "Grid view", Icon: LayoutGrid },
          { v: "list", label: "List view", Icon: List },
        ] as const
      ).map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors",
            value === v ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * Batched signed thumbnail URLs for photo/video ids (the authenticated endpoint enforces
 * access). Ids are fetched once; failures just leave the placeholder.
 */
export function useThumbUrls(ids: (string | null | undefined)[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const key = ids.filter(Boolean).join(",");
  useEffect(() => {
    const want = key ? key.split(",").filter((id) => !requested.current.has(id)) : [];
    if (!want.length) return;
    want.forEach((id) => requested.current.add(id));
    // Not cancelled on re-run: ids are marked requested, so their results must still land.
    void fetchThumbUrls(want)
      .then((next) => {
        const clean: Record<string, string> = {};
        for (const [id, url] of Object.entries(next)) if (url) clean[id] = url;
        setUrls((prev) => ({ ...prev, ...clean }));
      })
      .catch(() => {});
  }, [key]);
  return urls;
}

/** Drag payload for media cards dropped on folder cards (desktop). */
export const LIBRARY_DRAG_MIME = "application/x-shootportal-library-items";
