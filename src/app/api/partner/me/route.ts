import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  loadPartnerDashboardSummary,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";

/**
 * Partner summary for the signed-in user only.
 * Never accepts partner_id from the client.
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json(
      {
        suspended: true,
        partner: {
          id: access.partner.id,
          brand_name: access.partner.brand_name,
          status: access.partner.status,
        },
      },
      { status: 403 }
    );
  }

  const summary = await loadPartnerDashboardSummary(access.partner);
  return NextResponse.json({ summary });
}
