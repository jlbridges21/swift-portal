import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildEstimatePdf,
  type EstimatePdfAssets,
  type EstimatePdfInput,
  type EstimatePdfLogo,
} from "@/lib/estimate-pdf";
import { BRAND } from "@/lib/brand";

/**
 * Server render of the estimate PDF. Same builder and the same Inter files the
 * browser preview loads from /fonts, so the attachment matches the preview.
 */

let fontCache: Promise<Pick<EstimatePdfAssets, "fontRegular" | "fontBold">> | null = null;

async function readFontFile(name: string, origin: string | null): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(join(process.cwd(), "public", "fonts", name)));
  } catch (error) {
    // Serverless bundles without public/ traced: fall back to the deployed static file.
    if (!origin) throw error;
    const response = await fetch(`${origin.replace(/\/$/, "")}/fonts/${name}`);
    if (!response.ok) throw new Error(`Estimate font ${name} could not be loaded`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

function loadFonts(origin: string | null) {
  if (!fontCache) {
    fontCache = Promise.all([
      readFontFile("Inter-Regular.ttf", origin),
      readFontFile("Inter-Bold.ttf", origin),
    ])
      .then(([fontRegular, fontBold]) => ({ fontRegular, fontBold }))
      .catch((error) => {
        fontCache = null;
        throw error;
      });
  }
  return fontCache;
}

function sniffImage(bytes: Uint8Array): "png" | "jpg" | "other" {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return "other";
}

/** Same rule as the browser: the platform fallback icon is not this business's logo. */
function businessLogoUrl(url: string | null | undefined): string {
  const trimmed = (url || "").trim();
  if (!trimmed || trimmed === BRAND.logoUrl) return "";
  return trimmed;
}

async function loadLogo(url: string, origin: string | null): Promise<EstimatePdfLogo | null> {
  const absolute = url.startsWith("/") && origin ? `${origin.replace(/\/$/, "")}${url}` : url;
  if (!/^https?:\/\//i.test(absolute)) return null;
  try {
    const response = await fetch(absolute, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const kind = sniffImage(bytes);
    if (kind === "png" || kind === "jpg") return { bytes, type: kind };
    // SVG / WebP / GIF: the browser rasterizes through a canvas at natural size; sharp does the same here.
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(bytes)).png().toBuffer();
    return { bytes: new Uint8Array(png), type: "png" };
  } catch {
    return null;
  }
}

export async function renderEstimatePdfOnServer(
  input: EstimatePdfInput,
  options: { logoUrl: string | null | undefined; origin: string | null }
): Promise<Uint8Array> {
  const logoUrl = businessLogoUrl(options.logoUrl);
  const [fonts, logo] = await Promise.all([
    loadFonts(options.origin),
    logoUrl ? loadLogo(logoUrl, options.origin) : Promise.resolve(null),
  ]);
  return buildEstimatePdf(input, { ...fonts, logo });
}
