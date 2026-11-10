/**
 * Export-only logo preparation (server). Adds a transparent margin of LOGO_PAD × height on
 * every side so the template's shape-following drop shadow isn't clipped by the export
 * renderer. Real transparency is kept; a flat white surround baked into an exported logo file is
 * made transparent (the same treatment as the live websites and editor previews, so exports
 * match what the editor shows). The uploaded file itself is never modified.
 */
import sharp from "sharp";
import { LOGO_PAD } from "@/components/marketing/social/templates";
import { transparentLogo } from "@/lib/website/logo-image";

const MAX_BYTES = 10 * 1024 * 1024;

export async function padLogo(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    // Vector logos: rasterize sharply enough for a 300 dpi flyer.
    const source = meta.format === "svg" ? buf : await transparentLogo(buf).catch(() => buf);
    const img = meta.format === "svg" ? sharp(buf, { density: 300 }) : sharp(source, { failOn: "none" });
    const { data, info } = await img.rotate().ensureAlpha().png().toBuffer({ resolveWithObject: true });
    const m = Math.max(1, Math.round(info.height * LOGO_PAD));
    const out = await sharp(data)
      .extend({ top: m, bottom: m, left: m, right: m, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}
