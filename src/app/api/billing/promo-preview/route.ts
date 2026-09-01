import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  formatReferralPlanPriceDisplay,
  resolveReferralDiscountForBusiness,
} from "@/lib/partner-referral-discount";
import { previewPromoCodeDiscount } from "@/lib/partner-promo";
import { listPublicPlansWithModePrices } from "@/lib/stripe-billing";
import { getStripeMode } from "@/lib/stripe";
import { formatPlanPrice } from "@/lib/plan-catalog";

export const runtime = "nodejs";

/**
 * Live promo-code price preview for /billing.
 * Uses the SAME resolver as checkout so displayed and charged prices cannot diverge.
 */
export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const body = (await request.json().catch(() => ({}))) as {
      promoCode?: string;
      planKey?: string;
      interval?: "monthly" | "annual";
    };

    const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim() : "";
    const planKey = typeof body.planKey === "string" ? body.planKey.trim() : "";
    const interval = body.interval === "annual" ? "annual" : "monthly";

    if (!promoCode) {
      return NextResponse.json({ error: "promoCode is required." }, { status: 400 });
    }

    const preview = await previewPromoCodeDiscount({
      promoCode,
      actorEmail: profile.email ?? "",
      actorUserId: profile.id,
    });

    if (!preview.ok || !preview.partnerId) {
      return NextResponse.json({
        ok: false,
        message: preview.message ?? "That promo code is not recognized.",
        promoCode: preview.promoCode,
      });
    }

    const discount = await resolveReferralDiscountForBusiness({
      businessId: tenant.businessId,
      interval,
      partnerIdOverride: preview.partnerId,
    });

    const mode = getStripeMode();
    const plans = await listPublicPlansWithModePrices(mode);
    const plan = planKey
      ? plans.find((p) => p.key === planKey) ?? null
      : plans[0] ?? null;

    const listCents =
      interval === "annual"
        ? plan?.price_annual_cents ?? null
        : plan?.price_monthly_cents ?? null;

    let priceDisplay: {
      listPriceCents: number;
      discountedPriceCents: number;
      headline: string;
      listLabel: string;
      discountedLabel: string;
    } | null = null;

    if (discount.eligible && listCents != null) {
      const formatted = formatReferralPlanPriceDisplay({
        listPriceCents: listCents,
        discount,
        interval,
      });
      if (formatted) {
        priceDisplay = {
          listPriceCents: formatted.listPriceCents,
          discountedPriceCents: formatted.discountedPriceCents,
          headline: formatted.headline,
          listLabel: `${formatPlanPrice(formatted.listPriceCents)}${interval === "monthly" ? "/mo" : "/mo billed annually"}`,
          discountedLabel: `${formatPlanPrice(formatted.discountedPriceCents)}${interval === "monthly" ? "/mo" : ""}`,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      message: null,
      promoCode: preview.promoCode,
      brandName: preview.brandName,
      partnerId: preview.partnerId,
      discountEligible: discount.eligible,
      discountReason: discount.reason ?? null,
      amountOffCents: discount.config?.amountOffCents ?? null,
      durationMonths: discount.config?.durationMonths ?? null,
      priceDisplay,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    console.error("[billing/promo-preview]", err);
    return NextResponse.json({ error: "Could not validate promo code." }, { status: 500 });
  }
}
