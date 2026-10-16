/**
 * The visitor's business details for the free tools' documents (quote, invoice, price sheet).
 * Entered once and shared by every tool. Lives only in this browser (localStorage); never sent
 * to a server and never put in a URL.
 */

export type Brand = {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  /** PNG or JPEG data URL, already resized on the device. */
  logo: string | null;
};

export const BRAND_STORAGE_KEY = "sp:tool:brand:v1";

export const EMPTY_BRAND: Brand = { name: "", email: "", phone: "", website: "", address: "", logo: null };

/** Data URLs up to this length (~600 KB of image) are kept; larger ones are dropped. */
export const MAX_LOGO_DATA_URL = 800_000;

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizeBrand(b: Brand): Brand {
  const logo =
    typeof b?.logo === "string" && /^data:image\/(png|jpeg);base64,/.test(b.logo) && b.logo.length <= MAX_LOGO_DATA_URL ? b.logo : null;
  return {
    name: s(b?.name, 80),
    email: s(b?.email, 120),
    phone: s(b?.phone, 40),
    website: s(b?.website, 120),
    address: s(b?.address, 200),
    logo,
  };
}

/** One line of contact details for a document header. */
export function brandContactLine(b: Brand): string {
  return [b.phone, b.email, b.website].filter(Boolean).join("  ·  ");
}
