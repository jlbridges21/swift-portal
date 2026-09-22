/**
 * Validate auth return_to origins used after canonical-host confirm / OAuth.
 * Prevents open redirects when minting session handoffs.
 */

import { createClient } from "@supabase/supabase-js";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { safeAuthReturnToParam } from "@/lib/auth-confirm";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0]?.trim() ?? "";
}

/**
 * Parse a return_to value into a bare https origin (no path/query/hash).
 * Rejects protocol-relative, non-http(s), and anything with a path.
 */
export function parseAuthReturnTo(raw: string | null | undefined): string | null {
  const parsed = safeAuthReturnToParam(raw);
  if (!parsed) return null;
  if (process.env.NODE_ENV === "production" && !parsed.startsWith("https://")) return null;
  return parsed;
}

/**
 * True when host is the platform marketing apex or a ShootPortal tenant subdomain.
 */
export function isPlatformOwnedAuthHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  const root = getPlatformRootDomain().toLowerCase();
  if (!host || !root) return false;
  if (host === root || host === `www.${root}`) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return host.endsWith(`.${root}`) && host !== root;
}

/**
 * Allow return_to only for platform hosts or a custom_domain registered on a business.
 * Returns the normalized origin or null.
 */
export async function assertAllowedAuthReturnOrigin(
  raw: string | null | undefined
): Promise<string | null> {
  const origin = parseAuthReturnTo(raw);
  if (!origin) return null;

  let host: string;
  try {
    host = normalizeHost(new URL(origin).hostname);
  } catch {
    return null;
  }

  if (isPlatformOwnedAuthHost(host)) {
    return origin;
  }

  const service = serviceClient();
  const { data } = await service
    .from("businesses")
    .select("id")
    .eq("custom_domain", host)
    .is("deleted_at", null)
    .maybeSingle();

  return data?.id ? origin : null;
}

/**
 * After OTP on the canonical host, prefer an explicit allowlisted return_to;
 * otherwise resolve the user's business portal origin.
 */
export async function resolvePostConfirmReturnOrigin(options: {
  requestOrigin: string;
  returnToRaw: string | null;
  businessId: string | null | undefined;
}): Promise<string> {
  const allowed = await assertAllowedAuthReturnOrigin(options.returnToRaw);
  if (allowed) return allowed;

  if (options.businessId) {
    const { getBusinessPortalOriginById } = await import("@/lib/portal-url");
    return getBusinessPortalOriginById(options.businessId);
  }

  return options.requestOrigin || getPlatformApexOrigin();
}

export function canonicalAuthHostsMatch(a: string, b: string): boolean {
  try {
    return normalizeHost(new URL(a).host) === normalizeHost(new URL(b).host);
  } catch {
    return false;
  }
}
