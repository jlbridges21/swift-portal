import { NextResponse } from "next/server";

/** Headers for anonymous public-video API responses (never cached, never indexed). */
export const PUBLIC_VIDEO_API_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function publicVideoDeny(status: number, error: string, retryAfterSec?: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        ...PUBLIC_VIDEO_API_HEADERS,
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  );
}
