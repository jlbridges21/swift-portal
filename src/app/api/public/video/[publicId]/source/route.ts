import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { clientIp } from "@/lib/public-link-api";
import {
  allowPublicVideoRequest,
  isPublicVideoLookupBlocked,
  recordPublicVideoMiss,
} from "@/lib/public-link-rate-limit";
import { PUBLIC_VIDEO_API_HEADERS, publicVideoDeny } from "@/lib/public-video-http";
import { getPublicVideoSource, resolvePublicVideo } from "@/lib/video-public-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fresh playback URL for a public video. The player calls this when its signed URL is
 * about to expire or fails (long pause, slow connection). Re-validates the share every
 * time, so a video whose sharing was turned off stops here.
 */
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const ip = clientIp(request);

  const blocked = isPublicVideoLookupBlocked(ip);
  if (blocked.blocked) return publicVideoDeny(429, "Too many requests.", blocked.retryAfterSec);
  const rate = allowPublicVideoRequest(ip);
  if (!rate.allowed) return publicVideoDeny(429, "Too many requests.", rate.retryAfterSec);

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return publicVideoDeny(404, "This video isn't available.");

  const resolved = await resolvePublicVideo(publicId, host.businessId);
  if (!resolved) {
    recordPublicVideoMiss(ip);
    return publicVideoDeny(404, "This video isn't available.");
  }

  const source = await getPublicVideoSource(resolved);
  if (!source) return publicVideoDeny(502, "We couldn't load this video. Please try again.");
  return NextResponse.json(source, { headers: PUBLIC_VIDEO_API_HEADERS });
}
