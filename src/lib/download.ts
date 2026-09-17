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
