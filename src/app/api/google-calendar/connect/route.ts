import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getGoogleOAuthUrl, isGoogleCalendarConfigured, signGoogleOAuthState } from "@/lib/google-calendar";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET() {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        { error: "Google Calendar is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
        { status: 503 }
      );
    }

    const state = signGoogleOAuthState(tenant.businessId);
    const url = getGoogleOAuthUrl(state);
    if (!url) return NextResponse.json({ error: "Failed to build OAuth URL" }, { status: 500 });

    const response = NextResponse.redirect(url);
    response.cookies.set("gcal_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
