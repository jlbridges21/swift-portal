import { getPlatformRootDomain } from "@/lib/site-metadata";

/**
 * Hosts where Google OAuth may be shown.
 *
 * Apex + `*.{PLATFORM_ROOT_DOMAIN}` start OAuth on-host (Supabase wildcard).
 * Arbitrary custom domains bounce to www `/auth/oauth/start` so PKCE + callback
 * stay on the permanently allowlisted host, then hand off — no per-domain
 * Supabase redirect entry required.
 *
 * Client-safe module — no server-only imports.
 */
export function parseOAuthAllowedCustomHosts(): string[] {
  return (process.env.NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOAuthAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;

  const root = getPlatformRootDomain().toLowerCase();
  if (host === root || host === `www.${root}`) return true;
  if (host.endsWith(`.${root}`)) return true;

  // Custom domains: button shown; GoogleSignInButton routes via www oauth/start.
  // Optional env list is legacy and no longer required for the button to appear.
  if (host.includes(".") && !host.endsWith(".vercel.app")) return true;

  return parseOAuthAllowedCustomHosts().includes(host);
}

/** Client-safe: pass window.location.hostname. */
export function isOAuthAllowedOnCurrentHost(): boolean {
  if (typeof window === "undefined") return false;
  return isOAuthAllowedHostname(window.location.hostname);
}
