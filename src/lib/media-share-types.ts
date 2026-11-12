/** Client-safe types for photo and folder sharing (no server imports). */
import type { ShareExpiryPreset } from "@/lib/project-share-expiry";

/**
 * What a share opens: one photo, one project folder and the photos in it at access time,
 * one Media Library folder (v126, live membership across projects), or one non-photo item
 * (video, file, 360° tour, 3D model — v126).
 */
export type MediaShareSubjectKind = "photo" | "folder" | "library_folder" | "item";

export type MediaShareExpiryPreset = Exclude<ShareExpiryPreset, "one_time" | "custom">;

export const MEDIA_SHARE_EXPIRY_OPTIONS: { value: MediaShareExpiryPreset; label: string }[] = [
  { value: "indefinite", label: "No expiry" },
  { value: "24h", label: "24 hours" },
  { value: "1week", label: "1 week" },
  { value: "30days", label: "30 days" },
  { value: "60days", label: "60 days" },
];

export function isMediaShareExpiryPreset(value: unknown): value is MediaShareExpiryPreset {
  return MEDIA_SHARE_EXPIRY_OPTIONS.some((o) => o.value === value);
}

type MediaShareViewBase = {
  id: string;
  allow_download: boolean;
  expiry_preset: MediaShareExpiryPreset;
  access_expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
  view_count: number;
};

export type MediaLinkShareView = MediaShareViewBase & {
  /** Null only if the stored link could not be decrypted (rotate to recover). */
  url: string | null;
};

export type MediaPersonShareView = MediaShareViewBase & {
  email: string;
  notified_at: string | null;
};

export type MediaShareState = {
  link: MediaLinkShareView | null;
  people: MediaPersonShareView[];
};

/** Per-photo (or per-folder) counts for grid badges. */
export type PhotoShareSummary = { link: boolean; people: number };

export type MediaInviteResult = {
  email: string;
  status: "invited" | "already_shared" | "invalid" | "notify_failed";
  error?: string;
};
