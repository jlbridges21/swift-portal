import { buildPropertyLineFileName } from "./filename";
import { renderPropertyLineImage } from "./render";
import type { PropertyLineAnnotation } from "./annotation";
import { stripPropertyLineTitleSuffix } from "./annotation";
import type { ImagePoint } from "./types";

export interface SavePropertyLineOptions {
  imageUrl: string;
  baseMediaId: string;
  editMediaId?: string | null;
  points: ImagePoint[];
  projectId: string | null;
  sourceFileName: string;
  sourceTitle: string;
  lineColor?: string;
  overlayAlpha?: number;
  onProgress?: (message: string) => void;
}

export async function savePropertyLineMedia(
  options: SavePropertyLineOptions
): Promise<Record<string, unknown>> {
  const {
    imageUrl,
    baseMediaId,
    editMediaId,
    points,
    projectId,
    sourceFileName,
    sourceTitle,
    lineColor,
    overlayAlpha,
    onProgress,
  } = options;

  onProgress?.("Rendering edited image…");
  const blob = await renderPropertyLineImage(imageUrl, points, { lineColor, overlayAlpha });

  const annotation: PropertyLineAnnotation = {
    points,
    lineColor: lineColor ?? "#FF2222",
    overlayAlpha: overlayAlpha ?? 0.55,
  };

  const fileName = buildPropertyLineFileName(sourceFileName);
  const file = new File([blob], fileName, { type: "image/jpeg" });

  onProgress?.(editMediaId ? "Updating property line…" : "Saving property line…");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("annotation", JSON.stringify(annotation));
  formData.append("baseMediaId", baseMediaId);
  if (editMediaId) formData.append("editMediaId", editMediaId);
  if (projectId) formData.append("projectId", projectId);
  formData.append("sourceTitle", stripPropertyLineTitleSuffix(sourceTitle));
  formData.append("sourceFileName", sourceFileName);

  const res = await fetch(`/api/media/${editMediaId || baseMediaId}/property-line`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Could not save property line.");
  }

  return (data as { media: Record<string, unknown> }).media;
}
