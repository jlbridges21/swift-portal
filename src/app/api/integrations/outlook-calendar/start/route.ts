import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { outlookAuthUrl, outlookCalendarConfigured, safeOutlookReturnPath, signOutlookOAuthState } from "@/lib/outlook-calendar";

/** Starts Microsoft sign-in for the business's Outlook calendar (owner only). */
export async function GET(request: Request) {
  const profile = await requireAdmin({ adminOnly: true }).catch(() => null);
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Only the business owner can connect Outlook Calendar." }, { status: 403 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  if (!outlookCalendarConfigured()) {
    return NextResponse.json(
      { error: "Outlook Calendar is not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET." },
      { status: 503 }
    );
  }

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const portalOrigin = await getBusinessPortalOriginById(tenant.businessId);
  let returnOrigin = portalOrigin;
  try {
    if (host && new URL(`${proto}://${host}`).hostname === new URL(portalOrigin).hostname) {
      returnOrigin = `${proto}://${host}`;
    }
  } catch {
    returnOrigin = portalOrigin;
  }

  const returnPath = safeOutlookReturnPath(new URL(request.url).searchParams.get("return"));
  const state = signOutlookOAuthState({ businessId: tenant.businessId, userId: profile.id, returnOrigin, returnPath });
  return NextResponse.redirect(outlookAuthUrl(state));
}
