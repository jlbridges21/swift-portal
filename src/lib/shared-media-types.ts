/** Client-safe shapes for the public /shared/{token} viewer (library folders and single items). */

export type SharedMediaKind = "photo" | "video" | "document" | "tour" | "model";

export type SharedMediaItem = {
  /** "kind:id" — the only identifier the viewer sends back; re-authorized on every request. */
  key: string;
  kind: SharedMediaKind;
  title: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fileSize: number | null;
  /** True when a stored file backs this item (not YouTube / tour / 3D model links). */
  hasFile: boolean;
  /** Share allows downloads AND this item's project download rules allow it right now. */
  canDownload: boolean;
  /** Downloads are on for the share but this item's project hasn't unlocked them yet. */
  downloadLocked: boolean;
  /** iframe src for tours, 3D models, and YouTube videos. */
  embedUrl: string | null;
  /** Video poster / document type hints. */
  hasPoster: boolean;
  isPdf: boolean;
};

export function sharedItemUrl(token: string, key: string, variant: "thumb" | "preview" | "poster" | "stream" | "original" | "inline") {
  return `/api/public/shared/${encodeURIComponent(token)}?item=${encodeURIComponent(key)}&variant=${variant}`;
}
