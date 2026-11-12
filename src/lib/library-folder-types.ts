/**
 * Client-safe types and helpers for Media Library folders (migration v126).
 *
 * A library folder is an organizational collection: it references assets, it never copies
 * them. Assets keep their project, may sit in many folders, and removing one from a folder
 * (or deleting the folder) never touches the asset itself.
 */
import type { LibraryAssetKind } from "@/lib/media-library";
import type { PhotoShareSummary } from "@/lib/media-share-types";

export const LIBRARY_FOLDER_NAME_MAX = 80;
/** Upper bound per add/remove request; the UI chunks larger selections. */
export const LIBRARY_FOLDER_ITEMS_PER_REQUEST = 500;

export type LibraryItemRef = { kind: LibraryAssetKind; id: string };

export type LibraryFolderSummary = {
  id: string;
  name: string;
  itemCount: number;
  /**
   * Image shown on the card: the manual cover (a photo, or a video's stored poster), else the
   * automatic one. Rendered through the normal thumbnail endpoint, so no new files are made.
   */
  coverAssetId: string | null;
  /** Automatic cover (newest photo added, else newest video with a poster): the fallback when the manual cover can't load. */
  autoCoverAssetId: string | null;
  coverMode: "auto" | "manual";
  createdAt: string;
  updatedAt: string;
  share: PhotoShareSummary;
};

export type LibraryFolderSort = "name_asc" | "name_desc" | "updated" | "items";

export const LIBRARY_FOLDER_SORT_OPTIONS: { value: LibraryFolderSort; label: string }[] = [
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "updated", label: "Recently updated" },
  { value: "items", label: "Most items" },
];

export function sortLibraryFolders(folders: LibraryFolderSummary[], sort: LibraryFolderSort): LibraryFolderSummary[] {
  const byName = (a: LibraryFolderSummary, b: LibraryFolderSummary) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  const copy = [...folders];
  switch (sort) {
    case "name_desc":
      return copy.sort((a, b) => byName(b, a));
    case "updated":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
    case "items":
      return copy.sort((a, b) => b.itemCount - a.itemCount || byName(a, b));
    default:
      return copy.sort(byName);
  }
}

/** Trim + collapse inner whitespace. Returns an error message instead of a name when invalid. */
export function normalizeLibraryFolderName(raw: unknown): { name: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Enter a folder name." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return { error: "Enter a folder name." };
  if (name.length > LIBRARY_FOLDER_NAME_MAX) {
    return { error: `Folder names can be up to ${LIBRARY_FOLDER_NAME_MAX} characters.` };
  }
  return { name };
}

export function libraryItemKey(ref: LibraryItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_KINDS = new Set<string>(["photo", "video", "document", "tour", "model"]);

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Parse "kind:id" (or {kind,id}) into a validated ref; null when malformed. */
export function parseLibraryItemRef(value: unknown): LibraryItemRef | null {
  let kind: unknown;
  let id: unknown;
  if (typeof value === "string") {
    const i = value.indexOf(":");
    if (i < 0) return null;
    kind = value.slice(0, i);
    id = value.slice(i + 1);
  } else if (value && typeof value === "object") {
    kind = (value as { kind?: unknown }).kind;
    id = (value as { id?: unknown }).id;
  }
  if (typeof kind !== "string" || !ITEM_KINDS.has(kind) || !isUuid(id)) return null;
  return { kind: kind as LibraryAssetKind, id };
}

/** Which table column holds an item of this kind. */
export function libraryItemColumn(kind: LibraryAssetKind): "media_asset_id" | "tour_id" | "model_id" {
  if (kind === "tour") return "tour_id";
  if (kind === "model") return "model_id";
  return "media_asset_id";
}

export function folderItemCountLabel(n: number): string {
  return `${n.toLocaleString()} item${n === 1 ? "" : "s"}`;
}
