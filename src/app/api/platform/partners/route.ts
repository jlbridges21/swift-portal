import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  createPartner,
  listPartnerApplications,
  listPartners,
  type PartnerApplicationStatus,
  type PartnerStatus,
} from "@/lib/partners";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "applications";
  const status = url.searchParams.get("status") || "all";

  try {
    if (tab === "partners") {
      const partners = await listPartners(status as PartnerStatus | "all");
      return NextResponse.json({ partners });
    }
    const applications = await listPartnerApplications(status as PartnerApplicationStatus | "all");
    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load partners" },
      { status: 500 }
    );
  }
}

/** Create a partner directly (no application). */
export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const result = await createPartner(
      {
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        brandName: String(body.brandName ?? body.brand_name ?? ""),
        website: body.website ?? null,
        socialLinks: body.socialLinks ?? body.social_links ?? {},
        referralCode: String(body.referralCode ?? body.referral_code ?? ""),
        commissionRatePct:
          body.commissionRatePct != null
            ? Number(body.commissionRatePct)
            : body.commission_rate_pct != null
              ? Number(body.commission_rate_pct)
              : undefined,
        notes: body.notes ?? null,
        sendInvite: body.sendInvite !== false,
      },
      { id: auth.profile.id, email: auth.profile.email }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create partner" },
      { status: 400 }
    );
  }
}
