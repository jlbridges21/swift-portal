import sharp from "sharp";
import { ImageResponse } from "next/og";
import { getAppSettings } from "@/lib/app-settings";
import { sanitizeCssColor } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { SITE_ICONS } from "@/lib/site-metadata";
import { loadTransparentLogo } from "@/lib/website/logo-image";

export const dynamic = "force-dynamic";

const SIZES = new Set([180, 192, 512]);
const cache = new Map<string, { at: number; png: Buffer }>();
const TTL_MS = 30 * 60_000;

function png(buf: Buffer | Uint8Array, version: boolean) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      // Versioned URLs (?v=) change with the logo, so they can be cached hard.
      "Cache-Control": version ? "public, max-age=604800, s-maxage=604800, immutable" : "public, max-age=3600, s-maxage=86400",
    },
  });
}

function hexRgb(color: string): [number, number, number] {
  const m = color.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return [17, 24, 39];
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Logo → square app icon.
 *  - A logo that is already a filled square/rounded tile (e.g. a navy badge) becomes the whole
 *    icon, with its own edge color behind the rounded corners — no "icon inside an icon".
 *  - Any other logo is centred on white (or on the brand color when the logo is very light),
 *    with extra margin for Android's maskable safe zone.
 */
async function logoIcon(logo: Buffer, size: number, maskable: boolean, brand: string, logoLuminance: number | null): Promise<Buffer> {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const aspect = w / h;
  let ring = 0;
  let opaque = 0;
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.08));
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x >= band && x < w - band && y >= band && y < h - band) continue;
      ring++;
      if (data[(y * w + x) * 4 + 3]! > 200) opaque++;
    }
  }
  const tile = aspect > 0.88 && aspect < 1.14 && ring > 0 && opaque / ring > 0.75;
  if (tile) {
    const i = (Math.round(h * 0.1) * w + Math.round(w / 2)) * 4;
    const background = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, alpha: 1 };
    // Peel off the light anti-aliased outline the tile had against its old white background, or
    // it shows as a hairline on the new colored corners.
    for (let pass = 0; pass < 3; pass++) {
      const clear: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const a = data[p * 4 + 3]!;
          if (a === 0) continue;
          const light = Math.min(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!) >= 90;
          if (!light && a === 255) continue;
          const edge =
            (x > 0 && data[(p - 1) * 4 + 3] === 0) ||
            (x < w - 1 && data[(p + 1) * 4 + 3] === 0) ||
            (y > 0 && data[(p - w) * 4 + 3] === 0) ||
            (y < h - 1 && data[(p + w) * 4 + 3] === 0);
          if (edge) clear.push(p);
        }
      }
      for (const p of clear) data[p * 4 + 3] = 0;
    }
    const cleaned = await sharp(data, { raw: info }).png().toBuffer();
    const inner = maskable ? Math.round(size * 0.86) : size;
    const resized = await sharp(cleaned).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: resized, gravity: "center" }])
      .png()
      .toBuffer();
  }
  const light = (logoLuminance ?? 0) > 200;
  const [r, g, b] = hexRgb(brand);
  const background = light ? { r, g, b, alpha: 1 } : { r: 255, g: 255, b: 255, alpha: 1 };
  const box = Math.round(size * (maskable ? 0.56 : 0.72));
  const resized = await sharp(logo).resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  return (words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "S").slice(0, 2)).toUpperCase();
}

/** No logo: a clean monogram on the business's brand color. */
async function monogramIcon(name: string, color: string, size: number, maskable: boolean): Promise<Buffer> {
  const text = initials(name);
  const font = Math.round(size * (maskable ? 0.3 : 0.38) * (text.length > 1 ? 1 : 1.25));
  const res = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color, color: "#ffffff", fontSize: font, fontWeight: 700, letterSpacing: -font * 0.03 }}>
        {text}
      </div>
    ),
    { width: size, height: size }
  );
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Home Screen / install icon for the business whose portal this is (manifest icons and
 * apple-touch-icon). Platform hosts get the ShootPortal icon.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("size") ?? 192);
  const size = SIZES.has(requested) ? requested : 192;
  const maskable = url.searchParams.get("maskable") === "1";
  const versioned = url.searchParams.has("v");
  const host = await getPublicHostContext();

  if (!isActivePublicTenant(host)) {
    const fallback = size >= 512 ? (maskable ? SITE_ICONS.icon512Maskable : SITE_ICONS.icon512) : size === 180 ? SITE_ICONS.apple : SITE_ICONS.icon192;
    return Response.redirect(new URL(fallback, url.origin), 302);
  }

  const { business } = await getAppSettings(host.businessId);
  const brand = sanitizeCssColor(business.brandPrimaryColor, "#111827");
  const key = `${host.businessId}:${business.logoUrl}:${brand}:${size}:${maskable}:${url.searchParams.get("preview") ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return png(hit.png, versioned);

  let out: Buffer | null = null;
  const forceMonogram = process.env.NODE_ENV !== "production" && url.searchParams.get("preview") === "monogram";
  if (business.logoUrl.trim() && !forceMonogram) {
    const logo = await loadTransparentLogo(host.businessId, business.logoUrl.trim(), request.url);
    if (logo) {
      try {
        out = await logoIcon(logo, size, maskable, brand, business.logoLuminance);
      } catch {
        out = null;
      }
    }
  }
  if (!out) out = await monogramIcon(business.businessName || business.portalName || "Studio", /^#[0-9a-f]{3,6}$/i.test(brand) ? brand : "#111827", size, maskable);
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), png: out });
  return png(out, versioned);
}
