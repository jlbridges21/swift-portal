export function getUploadErrorMessage(error: unknown, context?: { phase?: string; status?: number }): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = raw.toLowerCase();
  const status = context?.status;

  if (status === 413 || lower.includes("too large") || lower.includes("exceeds")) {
    return "File exceeds maximum size for this media type.";
  }
  if (lower.includes("unsupported") || lower.includes("mime") || lower.includes("file type")) {
    return "Unsupported video format. Use MP4, MOV, or M4V.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("connection")) {
    return "Network interrupted. Check your connection and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Upload timed out. Try again on a stable connection.";
  }
  if (lower.includes("storage") || lower.includes("bucket") || status === 400 && context?.phase === "finalizing") {
    return "Upload completed but could not be saved. Contact support if this persists.";
  }
  if (lower.includes("unauthorized") || status === 401 || status === 403) {
    return "Session expired. Refresh the page and sign in again.";
  }
  if (context?.phase === "finalizing" || (error instanceof Error && error.name === "UploadSaveError")) {
    return "Upload complete, save failed. Retry save.";
  }
  if (status === 400) {
    return raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "Upload was rejected. Check file type and size.";
  }

  return raw.length > 120 ? "Upload failed. Please try again." : raw;
}
