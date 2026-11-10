/**
 * Business logo pixels for the website and the installed app (server only).
 * Real transparency is kept; a flat white background around an exported logo becomes transparent.
 */
import sharp from "sharp";

const MAX_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, { at: number; png: Buffer }>();
const TTL_MS = 10 * 60_000;

/**
 * Only this business's logo files: the saved logo URL, or a file in its own logo storage folder
 * (an unsaved upload previewed in the editor). Never an arbitrary URL.
 */
export function allowedLogoUrl(raw: string, businessId: string, savedLogoUrl: string): boolean {
  if (raw === savedLogoUrl.trim()) return true;
  try {
    const u = new URL(raw);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
    return Boolean(base && u.protocol === "https:" && u.host === base.host && u.pathname.startsWith(`/storage/v1/object/public/business-logos/${businessId}/`));
  } catch {
    return false;
  }
}

/**
 * Make a flat, edge-connected white background transparent. Logos that already have transparency
 * are returned untouched; logos whose border isn't (almost) all white are left alone too.
 */
export async function transparentLogo(buf: Buffer): Promise<Buffer> {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x: number, y: number) => (y * w + x) * 4;
  if (meta.hasAlpha) {
    for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return sharp(buf, { failOn: "none" }).rotate().png().toBuffer();
  }
  const white = (i: number) => data[i]! >= 236 && data[i + 1]! >= 236 && data[i + 2]! >= 236;
  let border = 0;
  let whiteBorder = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) (border++, white(at(x, y)) && whiteBorder++);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) (border++, white(at(x, y)) && whiteBorder++);
  if (whiteBorder / border < 0.85) return sharp(data, { raw: info }).png().toBuffer();

  // Flood fill from the edges through near-white pixels.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p] || !white(p * 4)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) (push(x, 0), push(x, h - 1));
  for (let y = 0; y < h; y++) (push(0, y), push(w - 1, y));
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    data[p * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Soften the anti-aliased rim: light pixels touching the removed background become partly clear.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (seen[p]) continue;
      if (!(seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w])) continue;
      const i = p * 4;
      const lightness = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
      if (lightness > 180) data[i + 3] = Math.round(255 * (1 - (lightness - 180) / 75));
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}


/** Fetch (cached) and return the logo as a transparent PNG, or null. */
export async function loadTransparentLogo(businessId: string, raw: string, baseUrl: string): Promise<Buffer | null> {
  const key = `${businessId}:${raw}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.png;
  try {
    const target = raw.startsWith("/") ? new URL(raw, baseUrl).toString() : raw;
    const res = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    const png = await transparentLogo(buf);
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), png });
    return png;
  } catch {
    return null;
  }
}
