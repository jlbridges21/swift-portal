import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  ADMIN_DEMO_COOKIE,
  ADMIN_DEMO_SOURCE,
  adminDemoCookieOptions,
  signAdminDemoCookie,
} from "@/lib/admin-demo-signup";
import { writePlatformAudit } from "@/lib/platform-audit";

/**
 * Super admin only: start a demo signup. Sets the signed, httpOnly sp_admin_demo cookie
 * (4 hours, bound to this super admin) and returns the /signup?source=admin-demo URL.
 */
export async function POST() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const value = signAdminDemoCookie(auth.profile.id);
  if (!value) {
    return NextResponse.json(
      { error: "Server signing secret is not configured (PLATFORM_SESSION_SECRET)." },
      { status: 500 }
    );
  }
  await writePlatformAudit({
    actorUserId: auth.profile.id,
    actorEmail: auth.profile.email ?? null,
    action: "signup.admin_demo_start",
    targetType: "signup",
  });
  const response = NextResponse.json({ url: `/signup?source=${ADMIN_DEMO_SOURCE}` });
  response.cookies.set(ADMIN_DEMO_COOKIE, value, adminDemoCookieOptions());
  return response;
}

/** End demo mode in this browser. */
export async function DELETE() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_DEMO_COOKIE, "", { ...adminDemoCookieOptions(0), maxAge: 0 });
  return response;
}
