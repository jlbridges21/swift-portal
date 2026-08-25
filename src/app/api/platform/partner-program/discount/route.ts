import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  loadPartnerProgramSettings,
  loadReferralDiscountStripeCoupons,
  updatePartnerProgramSettingsWithStripeSync,
} from "@/lib/partner-referral-discount";
import { getStripeMode } from "@/lib/stripe";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const [settings, coupons] = await Promise.all([
    loadPartnerProgramSettings(),
    loadReferralDiscountStripeCoupons(),
  ]);
  return NextResponse.json({
    settings,
    coupons,
    deployMode: getStripeMode(),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.referral_discount_enabled != null) {
      patch.referral_discount_enabled = Boolean(body.referral_discount_enabled);
    }
    if (body.referral_discount_amount_cents != null) {
      const n = Number(body.referral_discount_amount_cents);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Invalid monthly discount amount." }, { status: 400 });
      }
      patch.referral_discount_amount_cents = Math.round(n);
    }
    if (body.referral_discount_duration_months != null) {
      const n = Number(body.referral_discount_duration_months);
      if (!Number.isFinite(n) || n < 0 || n > 36) {
        return NextResponse.json({ error: "Duration must be 0–36 months." }, { status: 400 });
      }
      patch.referral_discount_duration_months = Math.round(n);
    }
    if (body.referral_discount_annual_enabled != null) {
      patch.referral_discount_annual_enabled = Boolean(body.referral_discount_annual_enabled);
    }
    if (body.referral_discount_annual_amount_cents != null) {
      const n = Number(body.referral_discount_annual_amount_cents);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Invalid annual discount amount." }, { status: 400 });
      }
      patch.referral_discount_annual_amount_cents = Math.round(n);
    }
    if (body.default_commission_rate_pct != null) {
      const n = Number(body.default_commission_rate_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: "Commission rate must be 0–100." }, { status: 400 });
      }
      patch.default_commission_rate_pct = Math.round(n * 100) / 100;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No changes." }, { status: 400 });
    }

    const result = await updatePartnerProgramSettingsWithStripeSync(patch);
    const coupons = await loadReferralDiscountStripeCoupons();

    return NextResponse.json({
      settings: result,
      coupons,
      deployMode: getStripeMode(),
      stripeCouponSyncMessage: result.stripeCouponSyncMessage ?? null,
      stripeCouponSyncOk: result.stripeCouponSyncOk ?? null,
      stripeCouponSyncMonthlyCouponId: result.stripeCouponSyncMonthlyCouponId ?? null,
      stripeCouponSyncAnnualCouponId: result.stripeCouponSyncAnnualCouponId ?? null,
      stripeCouponSyncMode: result.stripeCouponSyncMode ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 400 }
    );
  }
}
