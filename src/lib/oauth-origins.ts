import { getPlatformRootDomain } from "@/lib/site-metadata";

/**
 * Hosts where Google OAuth may be initiated.
 *
 * Apex + `*.{PLATFORM_ROOT_DOMAIN}` are always allowed (Supabase can wildcard these).
 * Arbitrary custom domains cannot be wildcarded in Supabase redirect URLs — they must
 * be listed both in the Auth allowlist AND in NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS.
 * If a custom domain is missing from either, we hide the Google button so password
 * sign-in remains available instead of a silent wrong-host redirect.
 */
export function isOAuthAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;

  const root = getPlatformRootDomain().toLowerCase();
  if (host === root || host === `www.${root}`) return true;
  if (host.endsWith(`.${root}`)) return true;

  const extras = (process.env.NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extras.includes(host);
}

/** Client-safe: pass window.location.hostname. */
export function isOAuthAllowedOnCurrentHost(): boolean {
  if (typeof window === "undefined") return false;
  return isOAuthAllowedHostname(window.location.hostname);
}
