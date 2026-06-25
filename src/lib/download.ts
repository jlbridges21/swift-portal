import type { MediaAsset } from "@/lib/types";

export async function downloadMediaAsset(asset: MediaAsset) {
  const a = window.document.createElement("a");
  a.href = `/api/media/download/${asset.id}?file=1`;
  a.download = asset.file_name;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
}

export function viewMediaAsset(asset: MediaAsset) {
  window.open(`/api/media/download/${asset.id}?file=1&inline=1`, "_blank", "noopener,noreferrer");
}

export function isPdf(asset: MediaAsset): boolean {
  return (
    asset.mime_type === "application/pdf" ||
    asset.file_name.toLowerCase().endsWith(".pdf")
  );
}
