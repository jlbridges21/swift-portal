/** Shared helpers for media display titles and download filenames. */

const TITLE_MAX_LENGTH = 120;

/** Validate and normalize a user-facing media title. */
export function normalizeMediaTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Title is required" };
  }
  const title = raw.trim();
  if (!title) {
    return { ok: false, error: "Title cannot be empty" };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return { ok: false, error: `Title must be ${TITLE_MAX_LENGTH} characters or fewer` };
  }
  return { ok: true, title };
}

/** File extension from original upload basename (including the dot), or "". */
export function fileExtensionFromName(fileName: string | null | undefined): string {
  if (!fileName) return "";
  const base = fileName.split("/").pop() || fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot).toLowerCase();
}

/**
 * Sanitize a title for Content-Disposition / zip entry names.
 * Preserves the real extension from `file_name` when the title lacks it.
 */
export function downloadFileName(asset: {
  title?: string | null;
  file_name?: string | null;
}): string {
  const ext = fileExtensionFromName(asset.file_name);
  let base = (asset.title?.trim() || asset.file_name?.trim() || "download")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) base = "download";

  if (ext) {
    const lower = base.toLowerCase();
    if (!lower.endsWith(ext.toLowerCase())) {
      base = `${base}${ext}`;
    }
  }

  return base.slice(0, 180);
}

/** User-facing media label — `title` is the single source of truth after v27 backfill. */
export function mediaDisplayName(asset: {
  title?: string | null;
  file_name?: string | null;
}): string {
  const title = asset.title?.trim();
  if (title) return title;
  // Defensive fallback for rows not yet migrated
  const fileName = asset.file_name?.trim();
  if (fileName) return fileName;
  return "Untitled";
}
