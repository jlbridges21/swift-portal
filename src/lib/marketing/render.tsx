/**
 * Social Media Kit exports (server only).
 *
 * Renders the same template tree as the live preview with next/og (Satori + resvg), using
 * the same font files the preview loads via @font-face. Nothing is stored: every download is
 * rendered on demand from the current project data and design choices, so there are no large
 * duplicate files to keep in sync and an earlier download is never silently changed.
 *
 * Flyers: rendered at US Letter 300 dpi (2550 × 3300) and wrapped in a one-page PDF.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { renderSocialAsset } from "@/components/marketing/social/templates";
import type { SocialItem } from "@/lib/marketing/social-inputs";

type FontDef = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };

/** Process-wide font bytes (static files, not tenant data). */
const fontStore: { fonts: FontDef[] | null } = { fonts: null };

/** Literal paths so the deployment tracer bundles these files with the function. */
function loadFonts(): FontDef[] {
  if (fontStore.fonts) return fontStore.fonts;
  const dir = join(process.cwd(), "public", "marketing-fonts");
  fontStore.fonts = [
    { name: "Inter", data: readFileSync(join(dir, "Inter-400.ttf")), weight: 400, style: "normal" },
    { name: "Inter", data: readFileSync(join(dir, "Inter-600.ttf")), weight: 600, style: "normal" },
    { name: "Inter", data: readFileSync(join(dir, "Inter-700.ttf")), weight: 700, style: "normal" },
    { name: "Cormorant", data: readFileSync(join(dir, "Cormorant-500.ttf")), weight: 500, style: "normal" },
    { name: "Cormorant", data: readFileSync(join(dir, "Cormorant-600.ttf")), weight: 600, style: "normal" },
    { name: "DM Serif", data: readFileSync(join(dir, "DMSerif-400.ttf")), weight: 400, style: "normal" },
    { name: "Nunito Sans", data: readFileSync(join(dir, "NunitoSans-400.ttf")), weight: 400, style: "normal" },
    { name: "Nunito Sans", data: readFileSync(join(dir, "NunitoSans-700.ttf")), weight: 700, style: "normal" },
  ];
  return fontStore.fonts;
}

export async function renderPng(item: SocialItem): Promise<Buffer> {
  const { width, height } = item.input;
  const res = new ImageResponse(renderSocialAsset({ ...item.input, watermark: false }), {
    width,
    height,
    fonts: loadFonts(),
  });
  if (!res.ok) throw new Error(`Render failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function renderFlyerPdf(item: SocialItem, title: string): Promise<Buffer> {
  const png = await renderPng(item);
  // 300 dpi JPEG (q92, 4:4:4) keeps text crisp for print at a third of the PNG size.
  const jpg = await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("ShootPortal Marketing Kit");
  const page = pdf.addPage([612, 792]); // 8.5 × 11 in at 72 pt/in
  const image = await pdf.embedJpg(jpg);
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  return Buffer.from(await pdf.save());
}

export async function renderItem(item: SocialItem, title: string): Promise<{ body: Buffer; contentType: string }> {
  if (item.group === "flyer") return { body: await renderFlyerPdf(item, title), contentType: "application/pdf" };
  return { body: await renderPng(item), contentType: "image/png" };
}

/** ZIP of the selected assets in folders, carousel slides numbered in order. */
export async function renderZip(items: SocialItem[], title: string): Promise<Buffer> {
  const zip = new JSZip();
  const folder = (g: SocialItem["group"]) =>
    g === "square" ? "Square Posts" : g === "story" ? "Stories" : g === "carousel" ? "Instagram Carousel" : "Flyer";
  // Sequential: each render holds a full-size bitmap; this keeps memory flat.
  for (const item of items) {
    const { body } = await renderItem(item, title);
    zip.file(`${folder(item.group)}/${item.fileName}`, body);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 3 } });
}
