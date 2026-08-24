import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { listPartnerPayouts } from "@/lib/partner-payouts";

/** Partner-facing payout history. Session partner only — never trusts client partner_id. */
export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  const payouts = await listPartnerPayouts(access.partner.id);
  return NextResponse.json({ payouts });
}
