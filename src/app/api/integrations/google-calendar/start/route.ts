import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isBusinessOperator, isOwnerAdmin } from "@/lib/staff-access";
import { getProfile } from "@/lib/auth";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  googleAuthUrl,
  googleCalendarConfigured,
  signOAuthState,
} from "@/lib/google-calendar";

/**
 * Starts Google OAuth.
 * - Default: the business connection (owner only).
 * - ?for=me: the signed-in team member connects their own calendar for Instant Booking
 *   (busy times + their confirmed shoots). Optional &return=/admin/... to come back to.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("for") === "me") return startMemberConnect(request, params.get("return"));

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

  // Setup wizard: come back to /onboarding instead of Settings.
  const back = params.get("return");
  const state = signOAuthState({
    businessId: tenant.businessId,
    userId: profile.id,
    returnOrigin,
    // Setup wizard, or the Shoot Calendar's "Connect calendar" modal.
    ...(back && (/^\/onboarding(\?|$)/.test(back) || back === "/admin/calendar") ? { returnPath: back } : {}),
  });
  return NextResponse.redirect(googleAuthUrl(state));
}

function requestReturnOrigin(request: Request, portalOrigin: string): string {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  try {
    if (host && new URL(`${proto}://${host}`).hostname === new URL(portalOrigin).hostname) return `${proto}://${host}`;
  } catch {
    // fall through
  }
  return portalOrigin;
}

async function startMemberConnect(request: Request, returnPath: string | null) {
  const profile = await getProfile();
  if (!profile || !isBusinessOperator(profile)) {
    return NextResponse.json({ error: "Sign in as a team member to connect your calendar." }, { status: 403 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (profile.business_id && profile.business_id !== tenant.businessId) {
    return NextResponse.json({ error: "Wrong business." }, { status: 403 });
  }
  if (!googleCalendarConfigured()) {
    return NextResponse.json({ error: "Google Calendar OAuth is not configured." }, { status: 503 });
  }
  const portalOrigin = await getBusinessPortalOriginById(tenant.businessId);
  const state = signOAuthState({
    businessId: tenant.businessId,
    userId: profile.id,
    returnOrigin: requestReturnOrigin(request, portalOrigin),
    kind: "member",
    returnPath: returnPath && /^\/admin(\/|\?|$)/.test(returnPath) ? returnPath : "/admin/calendar",
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
