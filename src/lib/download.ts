import type { MediaAsset } from "@/lib/types";
import { downloadFileName } from "@/lib/media-display-name";
import {
  DOWNLOAD_QUALITY_PARAM,
  type DownloadQuality,
} from "@/lib/download-quality";

function mediaDownloadHref(
  assetId: string,
  opts?: {
    quality?: DownloadQuality;
    inline?: boolean;
    apiBase?: string;
  }
): string {
  const base = opts?.apiBase
    ? `${opts.apiBase.replace(/\/$/, "")}/${assetId}`
    : `/api/media/download/${assetId}`;
  const params = new URLSearchParams({ file: "1" });
  if (opts?.inline) params.set("inline", "1");
  if (opts?.quality) params.set(DOWNLOAD_QUALITY_PARAM, opts.quality);
  return `${base}?${params.toString()}`;
}

export async function downloadMediaAsset(
  asset: MediaAsset,
  opts?: { quality?: DownloadQuality; apiBase?: string }
) {
  const quality =
    asset.media_type === "photo" ? (opts?.quality ?? "print") : undefined;
  const a = window.document.createElement("a");
  a.href = mediaDownloadHref(asset.id, { quality, apiBase: opts?.apiBase });
  a.download = downloadFileName(asset);
  window.document.body.appendChild(a);
  a.click();
  a.remove();
}

export function viewMediaAsset(asset: MediaAsset) {
  window.open(
    mediaDownloadHref(asset.id, { inline: true }),
    "_blank",
    "noopener,noreferrer"
  );
}

export function isPdf(asset: MediaAsset): boolean {
  return (
    asset.mime_type === "application/pdf" ||
    asset.file_name.toLowerCase().endsWith(".pdf")
  );
}

/** Short, human file-type label for document rows ("PDF", "Word", "Excel", …). */
export function documentKindLabel(asset: Pick<MediaAsset, "mime_type" | "file_name">): string {
  const mime = (asset.mime_type || "").toLowerCase();
  const ext = asset.file_name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return "PDF";
  if (mime.includes("wordprocessingml") || mime === "application/msword" || ext === "doc" || ext === "docx") return "Word";
  if (mime.includes("spreadsheetml") || mime === "application/vnd.ms-excel" || ext === "xls" || ext === "xlsx") return "Excel";
  if (mime === "text/csv" || ext === "csv") return "CSV";
  if (mime.includes("zip") || ext === "zip") return "ZIP";
  return ext ? ext.toUpperCase() : "File";
}

/**
 * Download one file through the authenticated download route, but check the response first so
 * a refusal (download lock, hidden section, missing file) surfaces as a message instead of a
 * saved error file. Same route, same server-side checks as `downloadMediaAsset`.
 */
export async function downloadMediaFileChecked(
  asset: MediaAsset,
  opts?: { quality?: DownloadQuality; apiBase?: string }
): Promise<void> {
  const quality = asset.media_type === "photo" ? (opts?.quality ?? "print") : undefined;
  const res = await fetch(mediaDownloadHref(asset.id, { quality, apiBase: opts?.apiBase }), {
    credentials: opts?.apiBase ? "omit" : "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      data?.error ||
        (res.status === 403
          ? "Downloads aren't available for this project yet."
          : res.status === 404
            ? "This file isn't available."
            : "The download failed. Please try again.")
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = downloadFileName(asset);
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
