/** Build a non-colliding filename for a property-line export. */
export function buildPropertyLineFileName(originalFileName: string): string {
  const trimmed = originalFileName.trim() || "photo.jpg";
  const dot = trimmed.lastIndexOf(".");
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1).toLowerCase() : "jpg";
  const safeBase = base.endsWith("-property-line") ? base : `${base}-property-line`;
  const outExt = ext === "png" || ext === "webp" ? ext : "jpg";
  return `${safeBase}.${outExt}`;
}
