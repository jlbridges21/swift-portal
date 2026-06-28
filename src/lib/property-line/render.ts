import type { ImagePoint } from "./types";

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for export."));
    img.src = url;
  });
}

function strokeWidthForImage(width: number): number {
  return Math.max(4, Math.round(width / 350));
}

function drawClosedPath(ctx: CanvasRenderingContext2D, points: ImagePoint[]) {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

/**
 * Render the property-line edit onto a new image at the source's natural resolution.
 */
export async function renderPropertyLineImage(
  imageUrl: string,
  points: ImagePoint[],
  options?: { overlayAlpha?: number }
): Promise<Blob> {
  if (points.length < 3) {
    throw new Error("Add at least three points before saving.");
  }

  const img = await loadImageElement(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) {
    throw new Error("Image dimensions are unavailable.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available in this browser.");
  }

  const overlayAlpha = options?.overlayAlpha ?? 0.55;
  const lineWidth = strokeWidthForImage(w);

  ctx.drawImage(img, 0, 0, w, h);

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  drawClosedPath(ctx, points);
  ctx.clip();
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#FF2222";
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  drawClosedPath(ctx, points);
  ctx.stroke();
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export edited image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}
