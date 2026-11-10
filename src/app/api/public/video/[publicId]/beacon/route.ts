import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { clientIp } from "@/lib/public-link-api";
import { allowPublicVideoBeacon } from "@/lib/public-link-rate-limit";
import { PUBLIC_VIDEO_API_HEADERS } from "@/lib/public-video-http";
import { estimateBufferedBytes, recordPublicVideoActivity, resolvePublicVideo } from "@/lib/video-public-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512;

/**
 * Player analytics: `{ kind: "play" }` once per page view when playback starts, and
 * `{ kind: "bytes", seconds, duration }` with newly buffered media seconds. Seconds are
 * converted to estimated bytes server-side from the stored file size and duration and
 * capped at one file per report. Always 204 so a beacon never surfaces errors.
 */
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const done = () => new NextResponse(null, { status: 204, headers: PUBLIC_VIDEO_API_HEADERS });
  const { publicId } = await params;
  if (!allowPublicVideoBeacon(clientIp(request)).allowed) return done();

  let body: { kind?: unknown; seconds?: unknown; duration?: unknown };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return done();
    body = JSON.parse(text) as typeof body;
  } catch {
    return done();
  }

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return done();
  const resolved = await resolvePublicVideo(publicId, host.businessId);
  if (!resolved) return done();

  if (body.kind === "play") {
    await recordPublicVideoActivity(resolved.businessId, resolved.shareId, "play");
  } else if (body.kind === "bytes") {
    const seconds = Number(body.seconds);
    const duration = Number(body.duration);
    const bytes = estimateBufferedBytes(resolved.video, seconds, Number.isFinite(duration) ? duration : undefined);
    if (bytes > 0) await recordPublicVideoActivity(resolved.businessId, resolved.shareId, "bytes", bytes);
  }
  return done();
}
