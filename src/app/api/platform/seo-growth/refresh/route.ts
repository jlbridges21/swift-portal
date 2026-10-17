import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { SEO_GROWTH_TAG } from "@/lib/seo-growth/data";

/**
 * Expire the SEO Growth caches (site crawl, URL Inspection, Search Console). The next page
 * load recomputes them. Super-admin only. A short cooldown protects the URL Inspection
 * quota (2,000/day per property; one refresh uses about 60).
 */

const COOLDOWN_MS = 5 * 60 * 1000;
let lastRefreshAt = 0;

export async function POST() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const wait = lastRefreshAt + COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return NextResponse.json({ error: `Refreshed recently. Try again in ${Math.ceil(wait / 60000)} minute(s).` }, { status: 429 });
  }
  lastRefreshAt = Date.now();
  revalidateTag(SEO_GROWTH_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
