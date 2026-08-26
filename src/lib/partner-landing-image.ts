/**
 * Server-side prepare/downscale for partner landing uploads.
 * "Any size" = any dimensions within a sane byte cap; oversized edges are shrunk.
 */

import sharp from "sharp";

/** Accept large phone photos; we downscale before storage. */
export const PARTNER_LANDING_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/** Longest edge after processing (preserves aspect ratio). */
export const PARTNER_LANDING_PHOTO_MAX_EDGE = 1600;

/** Logos stay smaller — enough for ~40px display at 2–3×. */
export const PARTNER_LANDING_LOGO_MAX_EDGE = 800;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

export type PreparedPartnerLandingImage = {
  buffer: Buffer;
  contentType: string;
  ext: string;
  width: number;
  height: number;
};

export function isAllowedPartnerLandingImageType(contentType: string, ext: string): boolean {
  const e = ext.toLowerCase().replace(/^\./, "");
  return ALLOWED_TYPES.has(contentType) || ALLOWED_EXTS.has(e);
}

export function partnerLandingImageTypeError(): string {
  return "File must be a PNG, JPEG, or WebP image.";
}

/**
 * Validate + optionally downscale. Rejects non-images clearly.
 * Photos: longest edge ≤ PARTNER_LANDING_PHOTO_MAX_EDGE, JPEG/WebP/PNG kept.
 * Target stored size is typically well under ~500KB after resize + quality.
 */
export async function preparePartnerLandingImage(args: {
  kind: "logo" | "photo";
  buffer: Buffer;
  contentType: string;
  ext: string;
}): Promise<PreparedPartnerLandingImage> {
  const ext = args.ext.toLowerCase().replace(/^\./, "") || "jpg";
  if (!isAllowedPartnerLandingImageType(args.contentType, ext)) {
    throw new Error(partnerLandingImageTypeError());
  }

  let image: sharp.Sharp;
  try {
    image = sharp(args.buffer, { failOn: "error" }).rotate();
    await image.metadata();
  } catch {
    throw new Error(partnerLandingImageTypeError());
  }

  const maxEdge =
    args.kind === "photo" ? PARTNER_LANDING_PHOTO_MAX_EDGE : PARTNER_LANDING_LOGO_MAX_EDGE;

  const resized = image.resize({
    width: maxEdge,
    height: maxEdge,
    fit: "inside",
    withoutEnlargement: true,
  });

  let outExt = ext === "jpeg" ? "jpg" : ext;
  let contentType = args.contentType;
  let out: Buffer;

  if (outExt === "png") {
    out = await resized.png({ compressionLevel: 8 }).toBuffer();
    contentType = "image/png";
  } else if (outExt === "webp") {
    out = await resized.webp({ quality: 82 }).toBuffer();
    contentType = "image/webp";
  } else {
    out = await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    outExt = "jpg";
    contentType = "image/jpeg";
  }

  const meta = await sharp(out).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    throw new Error(partnerLandingImageTypeError());
  }

  return { buffer: out, contentType, ext: outExt, width, height };
}
