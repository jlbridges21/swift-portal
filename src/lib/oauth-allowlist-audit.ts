import { createServiceClient } from "@/lib/supabase/server";
import { parseOAuthAllowedCustomHosts } from "@/lib/oauth-origins";

/**
 * Loud boot/login warning when a business custom_domain is not in the OAuth allowlist.
 * Missing NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS at build time silently hides the Google
 * button in production — this makes the misconfiguration visible in logs.
 *
 * Server-only (uses service role). Call from login/signup pages.
 */
export async function warnOAuthCustomDomainAllowlistGaps(): Promise<void> {
  const allowlist = new Set(parseOAuthAllowedCustomHosts());
  if (allowlist.size === 0) {
    console.warn(
      "[oauth] NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS is empty — Google sign-in will be hidden on all custom domains. Set it in the Vercel build environment and redeploy."
    );
  }

  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from("businesses")
      .select("slug, custom_domain")
      .not("custom_domain", "is", null)
      .is("deleted_at", null)
      .eq("status", "active");

    if (error) {
      console.warn("[oauth] could not audit custom_domain allowlist", error.message);
      return;
    }

    for (const row of data ?? []) {
      const host = String(row.custom_domain || "")
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
        .toLowerCase();
      if (!host) continue;
      if (!allowlist.has(host)) {
        console.warn(
          "[oauth] custom_domain missing from NEXT_PUBLIC_OAUTH_ALLOWED_CUSTOM_HOSTS — Google button hidden on that host",
          { slug: row.slug, custom_domain: host, allowlist: [...allowlist] }
        );
      }
    }
  } catch (err) {
    console.warn(
      "[oauth] allowlist audit failed",
      err instanceof Error ? err.message : String(err)
    );
  }
}
