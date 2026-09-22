/**
 * Client-only: average relative luminance of opaque pixels in an image.
 * Used for landing header logo-vs-background warnings.
 */

import { relativeLuminance } from "@/lib/brand-color";

export async function sampleImageAverageLuminance(src: string): Promise<number | null> {
  if (!src || typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(64, img.naturalWidth || 64);
        const h = Math.min(64, img.naturalHeight || 64);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] ?? 0;
          if (a < 32) continue;
          sum += relativeLuminance([data[i]!, data[i + 1]!, data[i + 2]!]);
          count += 1;
        }
        resolve(count === 0 ? null : sum / count);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
