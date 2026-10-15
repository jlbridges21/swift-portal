import { CollectPayloadSchema, MAX_COLLECT_BODY_BYTES } from "@/lib/analytics/collect-schema";
import { ingestEvent, type AnalyticsStore } from "@/lib/analytics/ingest";
import { isBotUserAgent } from "@/lib/analytics/request-meta";
import { allowAnalyticsEvent } from "@/lib/analytics/rate-limit";
import { BLOG_SLUGS } from "@/lib/blog/slugs";

const KNOWN_SLUGS: ReadonlySet<string> = new Set(BLOG_SLUGS);

export type CollectOutcome =
  | { status: 204; reason: "stored" | "ignored_bot" | "ignored_host" | "rate_limited" | "store_error" }
  | { status: 400 | 413; reason: "invalid" | "too_large" };

export function isAllowedAnalyticsHost(host: string | null, platformRootDomain: string, allowDev: boolean): boolean {
  if (!host) return false;
  const h = host.split(":")[0]!.toLowerCase();
  const root = platformRootDomain.toLowerCase();
  if (h === root || h === `www.${root}`) return true;
  return allowDev && (h === "localhost" || h === "127.0.0.1");
}

export function clientIpFromHeaders(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || "unknown";
}

/**
 * Collector pipeline: size → host → bot → rate limit → schema → ingest.
 * Ignored traffic still gets 204 so probes learn nothing.
 */
export async function handleCollect(
  rawBody: string,
  headers: Headers,
  opts: { platformRootDomain: string; allowDev: boolean; store: AnalyticsStore; now?: Date }
): Promise<CollectOutcome> {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_COLLECT_BODY_BYTES) return { status: 413, reason: "too_large" };
  if (!isAllowedAnalyticsHost(headers.get("host"), opts.platformRootDomain, opts.allowDev)) {
    return { status: 204, reason: "ignored_host" };
  }
  const ua = headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return { status: 204, reason: "ignored_bot" };
  const ip = clientIpFromHeaders(headers);
  if (!allowAnalyticsEvent(ip)) return { status: 204, reason: "rate_limited" };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, reason: "invalid" };
  }
  const parsed = CollectPayloadSchema.safeParse(json);
  if (!parsed.success) return { status: 400, reason: "invalid" };

  try {
    await ingestEvent(
      parsed.data,
      {
        ip,
        userAgent: ua,
        gpc: headers.get("sec-gpc") === "1",
        now: opts.now ?? new Date(),
        platformRootDomain: opts.platformRootDomain,
        knownArticleSlugs: KNOWN_SLUGS,
      },
      opts.store
    );
  } catch (err) {
    console.warn("[analytics] collect failed", err instanceof Error ? err.message : err);
    return { status: 204, reason: "store_error" };
  }
  return { status: 204, reason: "stored" };
}
