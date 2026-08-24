import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  loadPartnerProgramSettings,
  updatePartnerProgramSettings,
} from "@/lib/partner-referral-discount";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const settings = await loadPartnerProgramSettings();
  return NextResponse.json({ settings });
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

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No changes." }, { status: 400 });
    }

    const settings = await updatePartnerProgramSettings(patch);
    return NextResponse.json({
      settings,
      note: "Run scripts/setup-stripe-partner-referral-discount.ts after changing amounts or duration so Stripe coupons match.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 400 }
    );
  }
}
