import { headers } from "next/headers";
import { getAppSettings } from "@/lib/app-settings";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getPortalBrandFromSettings, type PortalBrand } from "@/lib/portal-brand";
import {
  allowPublicVideoRequest,
  isPublicVideoLookupBlocked,
  recordPublicVideoMiss,
} from "@/lib/public-link-rate-limit";
import {
  getPublicVideoSource,
  recordPublicVideoActivity,
  resolvePublicVideo,
  type PublicVideoSource,
  type ResolvedPublicVideo,
} from "@/lib/video-public-shares";

export type PublicVideoPageData =
  | { status: "rate_limited"; retryAfterSec: number; businessId: string | null }
  | { status: "unavailable"; businessId: string | null; apiBase: string }
  | {
      status: "ok";
      resolved: ResolvedPublicVideo;
      source: PublicVideoSource | null;
      brand: PortalBrand;
      /** The business's own logo, or null (never the platform fallback logo). */
      customLogoUrl: string | null;
      surfaceMode: unknown;
      apiBase: string;
    };

/**
 * Shared loader for /v/{id} and /embed/{id}. Resolves against the request host's
 * business only, rate limits by IP, and records one view (unless previewing).
 * Never exposes anything but the one video and the business's public brand.
 */
export async function loadPublicVideoPage(
  publicId: string,
  kind: "view" | "embed_view",
  opts?: { preview?: boolean }
): Promise<PublicVideoPageData> {
  const host = await getPublicHostContext();
  const apiBase = host.source === "path" && host.slug ? `/b/${host.slug}` : "";
  if (!isActivePublicTenant(host)) return { status: "unavailable", businessId: null, apiBase };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const blocked = isPublicVideoLookupBlocked(ip);
  const rate = blocked.blocked ? { allowed: false, retryAfterSec: blocked.retryAfterSec } : allowPublicVideoRequest(ip);
  if (!rate.allowed) return { status: "rate_limited", retryAfterSec: rate.retryAfterSec, businessId: host.businessId };

  const resolved = await resolvePublicVideo(publicId, host.businessId);
  if (!resolved) {
    recordPublicVideoMiss(ip);
    return { status: "unavailable", businessId: host.businessId, apiBase };
  }

  const [source, settings] = await Promise.all([getPublicVideoSource(resolved), getAppSettings(resolved.businessId)]);
  if (!opts?.preview) void recordPublicVideoActivity(resolved.businessId, resolved.shareId, kind);

  return {
    status: "ok",
    resolved,
    source,
    brand: getPortalBrandFromSettings(settings),
    customLogoUrl: settings.business.logoUrl?.trim() || null,
    surfaceMode: settings.business.surfaceMode,
    apiBase,
  };
}
