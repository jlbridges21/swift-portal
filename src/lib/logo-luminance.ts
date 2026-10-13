import sharp from "sharp";
import { logoLuminanceClass, type LogoLuminanceClass } from "@/lib/logo-luminance-class";

export { LIGHT_LOGO_LUMINANCE, logoLuminanceClass, type LogoLuminanceClass } from "@/lib/logo-luminance-class";

/** Pixels below this alpha are the transparent field, not the mark. */
const ALPHA_THRESHOLD = 24;

/**
 * A mark that covers almost none of the frame has no reliable color.
 * Below this share of pixels, the result is unknown and no suggestion is shown.
 */
const MIN_OPAQUE_FRACTION = 0.008;

export type LogoLuminanceResult = {
  logoLuminance: number | null;
  logoLuminanceClass: LogoLuminanceClass;
  opaqueFraction: number;
};

/**
 * Mean luminance of the opaque pixels only.
 * A white wordmark on a transparent PNG is mostly alpha 0; averaging every
 * pixel would report the empty field and miss the white strokes.
 */
export async function measureLogoLuminance(buffer: Buffer): Promise<LogoLuminanceResult> {
  try {
    const { data, info } = await sharp(buffer, { failOn: "none" })
      .ensureAlpha()
      .resize(64, 64, { fit: "inside", withoutEnlargement: false })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    if (channels < 4) {
      return { logoLuminance: null, logoLuminanceClass: "unknown", opaqueFraction: 0 };
    }

    const total = info.width * info.height;
    let sum = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += channels) {
      const alpha = data[i + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += y;
      opaque += 1;
    }

    const opaqueFraction = total > 0 ? opaque / total : 0;
    if (opaque === 0 || opaqueFraction < MIN_OPAQUE_FRACTION) {
      return { logoLuminance: null, logoLuminanceClass: "unknown", opaqueFraction };
    }

    const logoLuminance = Math.round((sum / opaque) * 10) / 10;
    return {
      logoLuminance,
      logoLuminanceClass: logoLuminanceClass(logoLuminance),
      opaqueFraction,
    };
  } catch (error) {
    console.error("[logo-luminance] could not read image", error);
    return { logoLuminance: null, logoLuminanceClass: "unknown", opaqueFraction: 0 };
  }
}
