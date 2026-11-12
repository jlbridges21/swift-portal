/**
 * 360 tour links from any host (Kuula, Matterport, CloudPano, …).
 * The link is stored in `tours.kuula_url` — a legacy column name; it holds any provider's URL.
 */

export const TOUR_URL_ERROR = "Enter a valid https:// link to your 360 tour.";

/** Trimmed https URL, or null. A bare host ("kuula.co/share/…") gets https:// added; http:// is rejected. */
export function normalizeTourUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value.replace(/^\/+/, "")}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostIs(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Iframe URL for hosts known to allow embedding; null otherwise.
 * Unknown hosts often block framing (X-Frame-Options / CSP), so callers show an
 * "Open 360 Tour" link instead of a broken iframe.
 */
export function getTourEmbedUrl(tourUrl: string | null | undefined): string | null {
  if (!tourUrl) return null;
  const url = tourUrl.trim();
  const host = hostOf(url);
  if (!host || !url.startsWith("https://")) return null;
  if (hostIs(host, "kuula.co")) {
    // Unchanged from the original Kuula-only behavior.
    const params = "logo=0&info=0&fs=1&vr=0&sd=1&thumbs=1";
    return url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
  }
  if (host === "my.matterport.com" && new URL(url).pathname.startsWith("/show")) return url;
  if (hostIs(host, "cloudpano.com")) return url;
  return null;
}
