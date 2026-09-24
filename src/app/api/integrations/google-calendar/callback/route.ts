import { NextResponse } from "next/server";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  completeGoogleCalendarConnect,
  isGoogleCalendarCallbackHost,
  resolveGoogleCalendarReturnUrl,
  verifyOAuthState,
} from "@/lib/google-calendar";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host)
    .split(",")[0]
    .trim();
  if (!isGoogleCalendarCallbackHost(host)) {
    return NextResponse.json(
      { error: "Google Calendar OAuth callback is only accepted on shootportal.app." },
      { status: 400 }
    );
  }

  const state = verifyOAuthState(url.searchParams.get("state") || "");
  const portalOrigin = state ? await getBusinessPortalOriginById(state.businessId) : "https://www.shootportal.app";
  const fail = (reason: string) => {
    const dest = resolveGoogleCalendarReturnUrl({
      returnOrigin: state?.returnOrigin || portalOrigin,
      businessPortalOrigin: portalOrigin,
      path: `/admin/settings?gcal=error&reason=${encodeURIComponent(reason)}#settings-integrations`,
    });
    return NextResponse.redirect(dest);
  };

  if (!state) return fail("invalid_state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return fail(oauthError);
  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");

  try {
    await completeGoogleCalendarConnect({
      businessId: state.businessId,
      userId: state.userId,
      code,
    });
  } catch {
    return fail("exchange_failed");
  }

  const dest = resolveGoogleCalendarReturnUrl({
    returnOrigin: state.returnOrigin,
    businessPortalOrigin: portalOrigin,
    path: "/admin/settings?gcal=connected#settings-integrations",
  });
  return NextResponse.redirect(dest);
}
