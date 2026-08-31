/** Format seconds as m:ss or h:mm:ss (YouTube-style). Returns null when unknown. */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Uploaded files only — YouTube-linked assets omit duration badges. */
export function videoDurationBadge(asset: {
  media_source?: string | null;
  duration_seconds?: number | null;
}): string | null {
  if (asset.media_source === "youtube") return null;
  return formatVideoDuration(asset.duration_seconds);
}
