import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  googleAuthUrl,
  googleCalendarConfigured,
  signOAuthState,
} from "@/lib/google-calendar";

export async function GET(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json(
      { error: "Only the business owner can connect or disconnect Google Calendar." },
      { status: 403 }
    );
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Calendar OAuth is not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const requestOrigin = host ? `${proto}://${host}` : "";
  const portalOrigin = await getBusinessPortalOriginById(tenant.businessId);
  let returnOrigin = portalOrigin;
  try {
    if (requestOrigin && new URL(requestOrigin).hostname === new URL(portalOrigin).hostname) {
      returnOrigin = new URL(requestOrigin).origin;
    }
  } catch {
    returnOrigin = portalOrigin;
  }

  const state = signOAuthState({
    businessId: tenant.businessId,
    userId: profile.id,
    returnOrigin,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
