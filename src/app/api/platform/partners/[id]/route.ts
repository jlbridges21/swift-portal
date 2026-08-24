import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { getPartnerById, updatePartner } from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ partner });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json();
    const partner = await updatePartner(
      id,
      {
        name: body.name,
        email: body.email,
        brandName: body.brandName ?? body.brand_name,
        website: body.website,
        referralCode: body.referralCode ?? body.referral_code,
        commissionRatePct:
          body.commissionRatePct != null
            ? Number(body.commissionRatePct)
            : body.commission_rate_pct != null
              ? Number(body.commission_rate_pct)
              : undefined,
        status: body.status,
        notes: body.notes,
        referralDiscountEnabled:
          body.referralDiscountEnabled !== undefined
            ? body.referralDiscountEnabled
            : body.referral_discount_enabled !== undefined
              ? body.referral_discount_enabled
              : undefined,
        referralDiscountAmountCents:
          body.referralDiscountAmountCents !== undefined
            ? body.referralDiscountAmountCents
            : body.referral_discount_amount_cents !== undefined
              ? body.referral_discount_amount_cents
              : undefined,
        referralDiscountDurationMonths:
          body.referralDiscountDurationMonths !== undefined
            ? body.referralDiscountDurationMonths
            : body.referral_discount_duration_months !== undefined
              ? body.referral_discount_duration_months
              : undefined,
        clearReferralDiscountOverride: Boolean(body.clearReferralDiscountOverride),
      },
      { id: auth.profile.id, email: auth.profile.email }
    );
    return NextResponse.json({ partner });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update partner" },
      { status: 400 }
    );
  }
}
