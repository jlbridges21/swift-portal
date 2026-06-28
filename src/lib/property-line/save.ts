import { uploadMediaFile } from "@/lib/upload";
import { buildPropertyLineFileName } from "./filename";
import { renderPropertyLineImage } from "./render";
import type { ImagePoint } from "./types";

export interface SavePropertyLineOptions {
  imageUrl: string;
  points: ImagePoint[];
  projectId: string | null;
  sourceFileName: string;
  sourceTitle: string;
  onProgress?: (message: string) => void;
}

export async function savePropertyLineAsNewMedia(
  options: SavePropertyLineOptions
): Promise<Record<string, unknown>> {
  const { imageUrl, points, projectId, sourceFileName, sourceTitle, onProgress } = options;

  onProgress?.("Rendering edited image…");
  const blob = await renderPropertyLineImage(imageUrl, points);

  const fileName = buildPropertyLineFileName(sourceFileName);
  const file = new File([blob], fileName, { type: "image/jpeg" });

  onProgress?.("Uploading new image…");
  const { asset } = await uploadMediaFile({
    projectId,
    file,
    mediaType: "photo",
    metadata: {
      title: `${sourceTitle.replace(/\s*\(Property Line\)\s*$/i, "")} (Property Line)`,
      tags: ["property-line"],
    },
    onProgress: () => {},
  });

  return asset;
}
