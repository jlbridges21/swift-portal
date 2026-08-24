import type { UploadManagerItem } from "./types";
import { formatFileSize } from "@/lib/upload/validation";

export function computeBatchProgress(items: UploadManagerItem[]) {
  const totalBytes = items.reduce((sum, i) => sum + (i.bytesTotal ?? i.fileSize ?? 0), 0);
  const loadedBytes = items.reduce((sum, i) => {
    if (i.status === "complete") return sum + (i.bytesTotal ?? i.fileSize ?? 0);
    return sum + (i.bytesLoaded ?? 0);
  }, 0);

  const complete = items.filter((i) => i.status === "complete").length;
  const failed = items.filter((i) => i.status === "failed" || i.status === "save_failed").length;
  const uploading = items.filter((i) => i.status === "uploading" || i.status === "processing").length;
  const queued = items.filter((i) => i.status === "queued").length;
  const active = uploading + queued > 0;

  const pct =
    totalBytes > 0
      ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
      : items.length
        ? Math.round((complete / items.length) * 100)
        : 0;

  return {
    totalBytes,
    loadedBytes,
    complete,
    failed,
    uploading,
    queued,
    active,
    pct,
    total: items.length,
    loadedLabel: formatFileSize(loadedBytes),
    totalLabel: formatFileSize(totalBytes),
  };
}
