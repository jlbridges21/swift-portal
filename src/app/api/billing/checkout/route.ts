import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { getStripe, getStripeMode } from "@/lib/stripe";
import { getSubscriptionState } from "@/lib/subscription";
import {
  BillingConfigError,
  billingMetadata,
  ensureStripeCustomer,
  loadBillingBusiness,
  resolvePriceIdForCheckout,
  type BillingInterval,
} from "@/lib/stripe-billing";
import {
  clientMessageForStripeError,
  isStripeDiscountApplyError,
  logStripeError,
} from "@/lib/stripe-errors";
import type Stripe from "stripe";

export const runtime = "nodejs";

type CheckoutSessionParams = Stripe.Checkout.SessionCreateParams;

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const body = (await request.json().catch(() => ({}))) as {
      planKey?: string;
      interval?: BillingInterval;
      promoCode?: string;
    };

    const planKey = typeof body.planKey === "string" ? body.planKey.trim() : "";
    const interval: BillingInterval = body.interval === "annual" ? "annual" : "monthly";
    const promoCode =
      typeof body.promoCode === "string" && body.promoCode.trim()
        ? body.promoCode.trim()
        : null;

    if (!planKey) {
      return NextResponse.json({ error: "planKey is required." }, { status: 400 });
    }

    const business = await loadBillingBusiness(tenant.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const sub = getSubscriptionState(business);
    if (sub.isComped) {
      return NextResponse.json(
        { error: "Complimentary accounts do not need a subscription." },
        { status: 400 }
      );
    }

    if (planKey === "founding") {
      return NextResponse.json(
        { error: "The founding plan is not available via self-serve checkout." },
        { status: 400 }
      );
    }

    let priceId: string;
    let mode: ReturnType<typeof getStripeMode>;
    try {
      const resolved = await resolvePriceIdForCheckout({ planKey, interval });
      priceId = resolved.priceId;
      mode = resolved.mode;
    } catch (err) {
      if (err instanceof BillingConfigError) {
        console.error("[billing/checkout] missing price for mode", err.details);
        return NextResponse.json({ error: err.message, code: "plan_misconfigured" }, { status: 400 });
      }
      throw err;
    }

    const origin = getBusinessPortalOrigin(tenant.business);
    if (!origin) {
      return NextResponse.json({ error: "Portal URL not configured." }, { status: 500 });
    }

    const customerId = await ensureStripeCustomer(business, profile.email);

    const meta = billingMetadata(business.id);
    const subscriptionData: {
      metadata: Record<string, string>;
      trial_end?: number;
    } = { metadata: meta };

    const hasTrialHandoff =
      business.subscription_status === "trialing" &&
      business.trial_ends_at &&
      Number.isFinite(new Date(business.trial_ends_at).getTime());

    let trialEndApplied = false;
    if (hasTrialHandoff && business.trial_ends_at) {
      const trialEndSec = Math.floor(new Date(business.trial_ends_at).getTime() / 1000);
      const nowSec = Math.floor(Date.now() / 1000);
      const minTrialLeadSec = 2 * 24 * 60 * 60 + 60;
      if (trialEndSec > nowSec + minTrialLeadSec) {
        subscriptionData.trial_end = trialEndSec;
        trialEndApplied = true;
      } else {
        console.info("[billing/checkout] omitting trial_end — less than 2 days remaining", {
          businessId: business.id,
          trialEndsAt: business.trial_ends_at,
          mode,
        });
      }
    }

    const { stripe } = getStripe();

    // Partner referral / promo discount — apply at Checkout via `discounts` only.
    // Never set allow_promotion_codes (conflicts with discounts → Stripe 400).
    let checkoutDiscounts: { coupon: string }[] | undefined;
    let partnerIdOverride: string | null = null;
    let promoAttributionMessage: string | null = null;

    if (promoCode) {
      try {
        const { applyPromoCodeAtCheckout } = await import("@/lib/partner-promo");
        const attribution = await applyPromoCodeAtCheckout({
          businessId: business.id,
          promoCode,
          actorUserId: profile.id,
          actorEmail: profile.email ?? "",
        });
        promoAttributionMessage = attribution.message;
        if (attribution.discountPartnerId) {
          partnerIdOverride = attribution.discountPartnerId;
        } else if (!attribution.ok) {
          // Invalid / suspended / self-referral — continue at cookie/list price.
          console.info("[billing/checkout] promo code rejected", {
            businessId: business.id,
            outcome: attribution.outcome,
            message: attribution.message,
          });
        }
      } catch (err) {
        console.error("[billing/checkout] promo attribution FAILED (checkout continues)", {
          businessId: business.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      const { resolveReferralDiscountForBusiness } = await import(
        "@/lib/partner-referral-discount"
      );
      const discount = await resolveReferralDiscountForBusiness({
        businessId: business.id,
        interval,
        partnerIdOverride,
      });
      if (discount.eligible && discount.couponId) {
        try {
          const coupon = await stripe.coupons.retrieve(discount.couponId);
          if (coupon.valid) {
            checkoutDiscounts = [{ coupon: discount.couponId }];
            console.info("[billing/checkout] referral discount attached", {
              businessId: business.id,
              interval,
              mode,
              couponId: discount.couponId,
              amountOffCents: discount.config?.amountOffCents,
              durationMonths: discount.config?.durationMonths,
              trialEndApplied,
              viaPromo: Boolean(promoCode),
            });
          } else {
            console.error(
              "[billing/checkout] referral coupon INVALID — proceeding at FULL PRICE",
              {
                businessId: business.id,
                interval,
                mode,
                couponId: discount.couponId,
              }
            );
          }
        } catch (couponErr) {
          console.error(
            "[billing/checkout] referral coupon retrieve FAILED — proceeding at FULL PRICE",
            {
              businessId: business.id,
              interval,
              mode,
              couponId: discount.couponId,
              error: couponErr instanceof Error ? couponErr.message : String(couponErr),
            }
          );
        }
      } else if (discount.config?.enabled) {
        console.error("[billing/checkout] referral discount NOT applied — proceeding at FULL PRICE", {
          businessId: business.id,
          interval,
          mode,
          reason: discount.reason ?? "unknown",
          amountOffCents: discount.config.amountOffCents,
          durationMonths: discount.config.durationMonths,
          source: discount.config.source,
        });
      }
    } catch (err) {
      console.error("[billing/checkout] referral discount resolution FAILED (checkout continues)", {
        businessId: business.id,
        interval,
        mode,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const buildParams = (discounts: { coupon: string }[] | undefined): CheckoutSessionParams => {
      // Only attach `discounts` when we have a coupon. Never set allow_promotion_codes —
      // ShootPortal collects partner promo codes in-app and maps them to this same path.
      const params: CheckoutSessionParams = {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: meta,
        subscription_data: subscriptionData,
        success_url: `${origin}/billing?checkout=success`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
        client_reference_id: business.id,
      };
      if (discounts?.length) {
        params.discounts = discounts;
      }
      return params;
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(buildParams(checkoutDiscounts));
    } catch (createErr) {
      if (checkoutDiscounts && isStripeDiscountApplyError(createErr)) {
        logStripeError("billing/checkout", createErr, {
          businessId: business.id,
          interval,
          mode,
          couponId: checkoutDiscounts[0]?.coupon,
          recovery: "retry_at_list_price",
        });
        console.error(
          "[billing/checkout] ALERT referral coupon rejected by Stripe — retrying checkout at FULL PRICE",
          {
            businessId: business.id,
            interval,
            mode,
            couponId: checkoutDiscounts[0]?.coupon,
          }
        );
        session = await stripe.checkout.sessions.create(buildParams(undefined));
      } else {
        throw createErr;
      }
    }

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL." }, { status: 500 });
    }

    return NextResponse.json({
      url: session.url,
      mode,
      ...(promoAttributionMessage ? { attributionMessage: promoAttributionMessage } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    const mode = (() => {
      try {
        return getStripeMode();
      } catch {
        return "unknown";
      }
    })();
    logStripeError("billing/checkout", err, { mode });
    const client = clientMessageForStripeError(err);
    return NextResponse.json(
      { error: client.error, ...(client.code ? { code: client.code } : {}) },
      { status: client.status }
    );
  }
}
