import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  loadPartnerCommissionHistory,
  resolvePartnerAccess,
} from "@/lib/partner-dashboard";

/**
 * Commission ledger rows for the signed-in partner only.
 * Ignores any partner_id query param — session identity only.
 */
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  void url.searchParams.get("partner_id");

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));

  const result = await loadPartnerCommissionHistory(access.partner.id, { page, pageSize });
  return NextResponse.json(result);
}
