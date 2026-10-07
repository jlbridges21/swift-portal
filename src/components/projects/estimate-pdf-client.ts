"use client";

import { BRAND } from "@/lib/brand";
import {
  buildEstimatePdf,
  type EstimatePdfAssets,
  type EstimatePdfInput,
  type EstimatePdfLogo,
} from "@/lib/estimate-pdf";

const fonts: { current: Promise<Pick<EstimatePdfAssets, "fontRegular" | "fontBold">> | null } = {
  current: null,
};

const logos = new Map<string, Promise<EstimatePdfLogo | null>>();

function loadFonts(): Promise<Pick<EstimatePdfAssets, "fontRegular" | "fontBold">> {
  if (!fonts.current) {
    fonts.current = Promise.all([
      fetch("/fonts/Inter-Regular.ttf").then(readFont),
      fetch("/fonts/Inter-Bold.ttf").then(readFont),
    ]).then(([fontRegular, fontBold]) => ({ fontRegular, fontBold }));
  }
  return fonts.current;
}

async function readFont(response: Response): Promise<Uint8Array> {
  if (!response.ok) throw new Error("Estimate font could not be loaded");
  return new Uint8Array(await response.arrayBuffer());
}

/** Platform fallback icon is not this business's logo. */
export function estimateLogoUrl(url: string | null | undefined): string {
  const trimmed = (url || "").trim();
  if (!trimmed || trimmed === BRAND.logoUrl) return "";
  return trimmed;
}

function sniffImage(bytes: Uint8Array): "png" | "jpg" | "other" {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return "other";
}

async function rasterize(bytes: Uint8Array, mime: string): Promise<EstimatePdfLogo | null> {
  const kind = sniffImage(bytes);
  if (kind === "png" || kind === "jpg") return { bytes, type: kind };
  if (typeof document === "undefined") return null;
  const blob = new Blob([bytesToArrayBuffer(bytes)], { type: mime || "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1;
    canvas.height = image.naturalHeight || 1;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return null;
    return { bytes: new Uint8Array(await png.arrayBuffer()), type: "png" };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fetchLogo(url: string): Promise<EstimatePdfLogo | null> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return rasterize(bytes, response.headers.get("content-type") || "");
  } catch {
    return null;
  }
}

function loadLogo(url: string): Promise<EstimatePdfLogo | null> {
  const cached = logos.get(url);
  if (cached) return cached;
  const pending = fetchLogo(url);
  logos.set(url, pending);
  return pending;
}

/** Same bytes for the preview and the download. A logo failure returns null. */
export async function renderEstimatePdf(input: EstimatePdfInput, logoUrl: string): Promise<Uint8Array> {
  const [fontAssets, logo] = await Promise.all([
    loadFonts(),
    estimateLogoUrl(logoUrl) ? loadLogo(estimateLogoUrl(logoUrl)) : Promise.resolve(null),
  ]);
  return buildEstimatePdf(input, { ...fontAssets, logo });
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function downloadEstimatePdf(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytesToArrayBuffer(bytes)], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
