import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { getPublicHostContext } from "@/lib/host-resolution";

/**
 * On tenant hosts: disallow indexing (client portals should not rank as ShootPortal).
 * On platform apex: allow marketing routes; block app surfaces.
 *
 * Previously: no robots.ts / sitemap.ts existed — tenants and platform shared default
 * crawlability with no explicit disallow for /admin or /dashboard.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await getPublicHostContext();
  const canonical = getCanonicalSiteUrl();

  if (host.kind === "tenant") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/platform",
        "/api",
        "/billing",
        "/onboarding",
        "/b/",
      ],
    },
    sitemap: `${canonical}/sitemap.xml`,
    host: canonical.replace(/^https?:\/\//, ""),
  };
}
