import { NextResponse } from "next/server";
import {
  allowPublicLinkApi,
  PUBLIC_LINK_RATE_LIMITS,
} from "@/lib/public-link-rate-limit";
import { resolvePublicLinkProject } from "@/lib/project-link-access";

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function requirePublicLinkContext(
  request: Request,
  token: string,
  hostBusinessId?: string | null
) {
  const ip = clientIp(request);
  const rate = allowPublicLinkApi(ip, token);
  if (!rate.allowed) {
    return {
      error: NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      ),
    };
  }

  const ctx = await resolvePublicLinkProject(token, hostBusinessId);
  if (!ctx) {
    return {
      error: NextResponse.json({ error: "Not found." }, { status: 404 }),
    };
  }

  return { ctx, ip };
}

export const PUBLIC_LINK_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

export { PUBLIC_LINK_RATE_LIMITS };
