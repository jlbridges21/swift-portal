import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadPartnerReferrals, resolvePartnerAccess } from "@/lib/partner-dashboard";

/**
 * Referred businesses for the signed-in partner only.
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

  // Explicitly ignore client-supplied partner_id (privacy / IDOR guard).
  const url = new URL(request.url);
  void url.searchParams.get("partner_id");

  const sort = url.searchParams.get("sort") || "joinedAt";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 10));

  const result = await loadPartnerReferrals(access.partner.id, { sort, dir, page, pageSize });
  return NextResponse.json(result);
}
