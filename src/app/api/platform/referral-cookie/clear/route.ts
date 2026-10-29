import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  PARTNER_REF_COOKIE,
  partnerRefCookieOptions,
  verifyPartnerRefCookie,
} from "@/lib/partner-referral";
import { writePlatformAudit } from "@/lib/platform-audit";

/**
 * Super admin convenience: clear ShootPortal's partner referral cookie (sp_partner_ref) from
 * THIS browser only. Does not sign out, touch other cookies or settings, or change any referral
 * records in the database. The referral is stored only in this httpOnly cookie (no
 * localStorage / sessionStorage keys).
 */
export async function POST() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const jar = await cookies();
  const raw = jar.get(PARTNER_REF_COOKIE)?.value;
  const claims = verifyPartnerRefCookie(raw);
  await writePlatformAudit({
    actorUserId: auth.profile.id,
    actorEmail: auth.profile.email ?? null,
    action: "partner.referral_cookie_clear",
    targetType: "browser",
    metadata: { had_cookie: Boolean(raw), referral_code: claims?.code ?? null },
  });
  const response = NextResponse.json({
    cleared: Boolean(raw),
    referralCode: claims?.code ?? null,
  });
  response.cookies.set(PARTNER_REF_COOKIE, "", { ...partnerRefCookieOptions(0), maxAge: 0 });
  return response;
}

/** Which partner referral (if any) this browser is carrying right now. */
export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const jar = await cookies();
  const claims = verifyPartnerRefCookie(jar.get(PARTNER_REF_COOKIE)?.value);
  return NextResponse.json({
    referralCode: claims?.code ?? null,
    expiresAt: claims ? new Date(claims.exp * 1000).toISOString() : null,
  });
}
