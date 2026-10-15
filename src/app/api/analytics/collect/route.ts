import { NextResponse } from "next/server";
import { handleCollect } from "@/lib/analytics/collector";
import { createSupabaseAnalyticsStore } from "@/lib/analytics/supabase-store";
import { MAX_COLLECT_BODY_BYTES } from "@/lib/analytics/collect-schema";
import { getPlatformRootDomain } from "@/lib/site-metadata";

/**
 * Public, write-only marketing analytics collector. Accepts anonymous events from
 * the platform marketing site only. Never returns stored data. See docs/ANALYTICS.md.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_COLLECT_BODY_BYTES) return new NextResponse(null, { status: 413 });
  const body = await request.text();
  const outcome = await handleCollect(body, request.headers, {
    platformRootDomain: getPlatformRootDomain(),
    allowDev: process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ANALYTICS_DEV === "1",
    store: createSupabaseAnalyticsStore(),
  });
  return new NextResponse(null, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
}
