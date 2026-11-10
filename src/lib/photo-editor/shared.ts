/**
 * Photo Editor — shared (client + server) constants and types.
 *
 * Model: a photo is ONE media_assets row. Editing never overwrites the original:
 *   - original + each saved edit live in media_asset_versions (business-private)
 *   - in-progress adjustments live in media_edit_drafts (small JSON, auto-saved)
 *   - "Save to Project" points the media_assets row at the new edited file, so every
 *     delivery surface (portal, downloads, ZIPs, shares, covers) uses it automatically.
 */

/** Photo formats the editor opens. Matches what ShootPortal accepts for photo uploads. */
export const PHOTO_EDITOR_SOURCE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Most photos one editing session can hold (folders larger than this are trimmed with a notice). */
export const PHOTO_EDITOR_MAX_PHOTOS = 200;

/** Saved edits kept per photo (plus the original). Older edited files are cleaned up. */
export const PHOTO_EDITOR_KEEP_EDIT_VERSIONS = 5;

/** Largest draft recipe accepted (bytes of JSON). Real recipes are a few KB. */
export const PHOTO_EDITOR_MAX_SETTINGS_BYTES = 200_000;

export type PhotoEditStatus = "unedited" | "edited";

export type PhotoEditorScope = "single" | "selection" | "folder" | "unfiled";

/** Opaque editor recipe (LightCraft adjustment state). Stored as JSON, never interpreted server-side. */
export type PhotoEditSettings = Record<string, unknown>;

export interface PhotoEditorPhoto {
  id: string;
  name: string;
  projectId: string | null;
  folderId: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  editStatus: PhotoEditStatus;
  editedAt: string | null;
  /** Grid thumbnail of the CURRENT (delivered) version. */
  thumbUrl: string | null;
  /** Auto-saved, unpublished adjustments. */
  draft: { settings: PhotoEditSettings; revision: number; updatedAt: string } | null;
  /** Recipe of the version currently delivered (null when the original is delivered). */
  publishedSettings: PhotoEditSettings | null;
  currentVersionNumber: number | null;
}

export interface PhotoEditorSessionPayload {
  id: string;
  projectId: string | null;
  projectName: string | null;
  folderId: string | null;
  folderName: string | null;
  scope: PhotoEditorScope;
  activeMediaId: string | null;
  returnTo: string;
  photos: PhotoEditorPhoto[];
  /** Photos in the original request that are no longer available (deleted / moved / not photos). */
  missingCount: number;
}

export interface PhotoVersionSummary {
  id: string;
  versionNumber: number;
  kind: "original" | "edit";
  createdAt: string;
  createdByName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  isCurrent: boolean;
  /** Recipe that produced this version (null for the original) — lets the editor resume from it. */
  settings: PhotoEditSettings | null;
}

/** True when `mime` is a photo format the editor can open. */
export function isEditablePhotoMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  return (PHOTO_EDITOR_SOURCE_MIME as readonly string[]).includes(m);
}

/** Only uploaded photos (not YouTube/external links) can be edited. */
export function isEditablePhotoAsset(asset: {
  media_type?: string | null;
  media_source?: string | null;
  mime_type?: string | null;
}): boolean {
  return asset.media_type === "photo" && (asset.media_source ?? "upload") === "upload" && isEditablePhotoMime(asset.mime_type);
}

/** Same-origin relative path only — prevents open redirects through `returnTo`. */
export function safeReturnTo(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.length > 300) return fallback;
  if (!v.startsWith("/admin")) return fallback;
  return v;
}

/** Stable deep-ish equality for recipes (key order independent). */
export function settingsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function photoEditorLabel(count: number): string {
  return count === 1 ? "Edit Photo" : "Edit Photos";
}
