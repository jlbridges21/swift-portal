import { validateBusinessSlug, normalizeBusinessSlug, BUSINESS_SLUG_RE } from "@/lib/reserved-subdomains";

/** Derive a candidate slug from a business name (editable by the user). */
export function suggestSlugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/g, "");
  if (!base) return "";
  const check = validateBusinessSlug(base);
  return check.ok ? check.slug : base.replace(/^-+|-+$/g, "");
}

export function nextSlugSuggestion(base: string, takenIndex: number): string {
  const root = normalizeBusinessSlug(base).replace(/-\d+$/, "") || "studio";
  const candidate = takenIndex <= 1 ? root : `${root}-${takenIndex}`;
  return candidate.slice(0, 48);
}

/** Small disposable-email blocklist — expand later if needed. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.org",
  "10minutemail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isPlausibleEmail(email: string): boolean {
  const v = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
  if (isDisposableEmail(v)) return false;
  return true;
}

export function isValidSignupPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export { BUSINESS_SLUG_RE };
