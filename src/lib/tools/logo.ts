import { MAX_LOGO_DATA_URL } from "@/lib/tools/brand";

/**
 * Reads a logo the visitor picked and returns a PNG (or JPEG) data URL sized for documents.
 * Runs entirely in the browser: the file is drawn to a canvas and never uploaded. Accepts any
 * image the browser can display (PNG, JPG, SVG, WebP, GIF), so nobody has to convert first.
 */

const MAX_W = 900;
const MAX_H = 360;
const MAX_INPUT_BYTES = 15_000_000;

export class LogoError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new LogoError("That file couldn't be opened as an image. Try a PNG or JPG."));
    img.src = src;
  });
}

export async function readLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new LogoError("Choose an image file, like a PNG or JPG.");
  if (file.size > MAX_INPUT_BYTES) throw new LogoError("That image is over 15 MB. Choose a smaller file.");

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || 600;
    const h0 = img.naturalHeight || 240;
    const scale = Math.min(1, MAX_W / w0, MAX_H / h0);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new LogoError("Your browser couldn't read that image. Try a PNG or JPG.");
    ctx.drawImage(img, 0, 0, w, h);

    // PNG keeps transparent backgrounds. Very detailed (photo-like) logos fall back to JPEG.
    let data = canvas.toDataURL("image/png");
    if (data.length > MAX_LOGO_DATA_URL) {
      const flat = document.createElement("canvas");
      flat.width = w;
      flat.height = h;
      const fctx = flat.getContext("2d");
      if (fctx) {
        fctx.fillStyle = "#ffffff";
        fctx.fillRect(0, 0, w, h);
        fctx.drawImage(canvas, 0, 0);
        data = flat.toDataURL("image/jpeg", 0.88);
      }
    }
    if (data.length > MAX_LOGO_DATA_URL) throw new LogoError("That logo is too detailed to use. Try a simpler PNG or JPG.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Save generated PDF bytes as a file download. */
export function saveFile(bytes: Uint8Array, filename: string, type = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe slug from user text. */
export function fileSlug(...parts: string[]): string {
  return (
    parts
      .filter(Boolean)
      .join("-")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}
