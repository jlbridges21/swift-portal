import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getActivePartnerByUserId } from "@/lib/partners";

/**
 * Partner-only endpoint (placeholder for phase 4 dashboard data).
 * Requires an active partners row for the signed-in user.
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const partner = await getActivePartnerByUserId(profile.id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    partner: {
      id: partner.id,
      name: partner.name,
      brand_name: partner.brand_name,
      referral_code: partner.referral_code,
      commission_rate_pct: partner.commission_rate_pct,
      status: partner.status,
    },
  });
}
