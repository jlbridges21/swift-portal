import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAuth } from "@/lib/auth";
import { canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getStripeForBusiness, portalCheckoutBaseUrl, StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { buildStripePaymentMetadata } from "@/lib/stripe-metadata";
import { isPaymentComplete } from "@/lib/payment-status";
import { ensureCheckoutNotAlreadyPaid } from "@/lib/stripe-payment-reconcile";
import { depositPaymentDescription, fullPaymentDescription, resolveDepositCharge } from "@/lib/payment-quote";
import { getAppSettings } from "@/lib/app-settings";
import type { Payment } from "@/lib/types";
import type { StripeConnectRequestOptions } from "@/lib/stripe";
import type Stripe from "stripe";

const ALREADY_PAID_MESSAGE = "This payment has already been completed.";

class CheckoutChoiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutChoiceError";
    this.status = status;
  }
}

async function loadPayment(id: string, businessId?: string) {
  const supabase = await createClient();
  let query = supabase.from("payments").select("*").eq("id", id);
  if (businessId) {
    query = query.eq("business_id", businessId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as Payment;
}

async function authorizePaymentAccess(payment: Payment) {
  const profile = await requireAuth();
  const allowed = await canAccessProjectAsAssignedClientOrAdmin(profile, payment.project_id);
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, profile };
}

async function createCheckoutSession(payment: Payment, businessId: string, business: { slug: string; custom_domain?: string | null }) {
  const appUrl = portalCheckoutBaseUrl(business);
  if (!appUrl) {
    return { ok: false as const, response: NextResponse.json({ error: "App URL not configured" }, { status: 500 }) };
  }

  const metadata = buildStripePaymentMetadata({
    paymentId: payment.id,
    businessId: payment.business_id || businessId,
    projectId: payment.project_id,
    clientId: payment.client_id,
  });

  let stripeContext;
  try {
    stripeContext = await getStripeForBusiness(businessId);
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) {
      return { ok: false as const, response: NextResponse.json({ error: err.message }, { status: 400 }) };
    }
    throw err;
  }

  const { stripe, requestOptions, stripeAccountId } = stripeContext;

  const sessionParams = {
    mode: "payment" as const,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: payment.description.slice(0, 250),
          },
          unit_amount: payment.amount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    client_reference_id: payment.id,
    success_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=success#payments`,
    cancel_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=cancelled#payments`,
  };

  const session = requestOptions
    ? await stripe.checkout.sessions.create(sessionParams, requestOptions)
    : await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 }),
    };
  }

  const db = await createTenantServiceClient(businessId);
  await db
    .from("payments")
    .update({
      stripe_checkout_session_id: session.id,
      ...(payment.stripe_account_id ? {} : { stripe_account_id: stripeAccountId }),
    })
    .eq("id", payment.id);

  return { ok: true as const, session };
}

async function expireCheckoutSession(
  payment: Payment,
  stripe: Stripe,
  requestOptions?: StripeConnectRequestOptions
): Promise<boolean> {
  if (!payment.stripe_checkout_session_id) return true;
  try {
    if (requestOptions) {
      await stripe.checkout.sessions.expire(payment.stripe_checkout_session_id, {}, requestOptions);
    } else {
      await stripe.checkout.sessions.expire(payment.stripe_checkout_session_id);
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/status of `expired`/i.test(message)) return true;
    console.warn("[payments/checkout] previous checkout session was not expired", err);
    return false;
  }
}

async function closeDepositCheckout(
  payment: Payment,
  stripe: Stripe,
  requestOptions?: StripeConnectRequestOptions
): Promise<boolean> {
  if (payment.stripe_payment_link_id) {
    const update = { active: false };
    if (requestOptions) {
      await stripe.paymentLinks.update(payment.stripe_payment_link_id, update, requestOptions);
    } else {
      await stripe.paymentLinks.update(payment.stripe_payment_link_id, update);
    }
  }
  return expireCheckoutSession(payment, stripe, requestOptions);
}

async function paymentLinkChargeCents(
  stripe: Stripe,
  paymentLinkId: string,
  requestOptions?: StripeConnectRequestOptions
): Promise<number | null> {
  const items = requestOptions
    ? await stripe.paymentLinks.listLineItems(paymentLinkId, { limit: 10, expand: ["data.price"] }, requestOptions)
    : await stripe.paymentLinks.listLineItems(paymentLinkId, { limit: 10, expand: ["data.price"] });
  if (items.data.length === 0) return null;
  let total = 0;
  for (const item of items.data) {
    const unit = item.price?.unit_amount;
    if (unit == null) return null;
    total += unit * (item.quantity ?? 1);
  }
  return total;
}

/** Reactivate the emailed deposit link only when it still charges the recomputed deposit. */
async function reactivateMatchingDepositLink(
  payment: Payment,
  depositCents: number,
  stripe: Stripe,
  requestOptions?: StripeConnectRequestOptions
) {
  if (!payment.stripe_payment_link_id) return;
  let linkCents: number | null = null;
  try {
    linkCents = await paymentLinkChargeCents(stripe, payment.stripe_payment_link_id, requestOptions);
  } catch (err) {
    console.warn("[payments/checkout] could not read deposit link amount; leaving it inactive", err);
    return;
  }
  if (linkCents !== depositCents) {
    console.warn("[payments/checkout] deposit link amount does not match the recomputed deposit; leaving it inactive", {
      linkCents,
      depositCents,
    });
    return;
  }
  const update = { active: true };
  if (requestOptions) {
    await stripe.paymentLinks.update(payment.stripe_payment_link_id, update, requestOptions);
  } else {
    await stripe.paymentLinks.update(payment.stripe_payment_link_id, update);
  }
}

/**
 * Pay-in-full updates the single payment row before any Checkout Session is created.
 * The emailed deposit link is deactivated first so it cannot be paid in parallel.
 */
async function settlePayInFull(payment: Payment, businessId: string): Promise<Payment> {
  if (!payment.quote_id) {
    throw new CheckoutChoiceError("This payment is not tied to a quote.", 400);
  }
  const settings = await getAppSettings(businessId);
  const paySettings = settings.workflow.payments;
  if (paySettings.depositMode === "none" || !paySettings.allowClientPayInFull) {
    throw new CheckoutChoiceError("Paying the full total is not available.", 400);
  }

  const db = await createTenantServiceClient(businessId);
  const { data: quote } = await db
    .from("project_quotes")
    .select("id, project_id, total_cents")
    .eq("id", payment.quote_id)
    .maybeSingle();
  if (!quote || quote.project_id !== payment.project_id || quote.total_cents <= 0) {
    throw new CheckoutChoiceError("Quote not found.", 404);
  }

  const { data: rows } = await db
    .from("payments")
    .select("amount, status")
    .eq("quote_id", payment.quote_id);
  const paidCents = (rows ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + row.amount, 0);
  if (paidCents > 0) {
    throw new CheckoutChoiceError("A payment was already recorded for this quote.", 409);
  }
  if (payment.amount >= quote.total_cents) return payment;

  const before = await ensureCheckoutNotAlreadyPaid(payment, "checkout_full_before_update");
  if (before.blocked) {
    throw new CheckoutChoiceError(before.message ?? ALREADY_PAID_MESSAGE, 409);
  }

  const { stripe, requestOptions } = await getStripeForBusiness(businessId);
  const expired = await closeDepositCheckout(payment, stripe, requestOptions);
  if (!expired) {
    throw new CheckoutChoiceError("The open checkout session could not be closed.", 409);
  }

  const afterClose = await ensureCheckoutNotAlreadyPaid(payment, "checkout_full_after_close");
  if (afterClose.blocked) {
    throw new CheckoutChoiceError(afterClose.message ?? ALREADY_PAID_MESSAGE, 409);
  }

  const { data: updated, error } = await db
    .from("payments")
    .update({
      amount: quote.total_cents,
      description: fullPaymentDescription(quote.total_cents),
    })
    .eq("id", payment.id)
    .in("status", ["pending", "sent", "draft"])
    .select("*")
    .maybeSingle();
  if (error) throw new CheckoutChoiceError(error.message, 500);

  const settled = (updated as Payment | null) ?? (await loadPayment(payment.id, businessId));
  if (!settled) throw new CheckoutChoiceError("Payment could not be updated.", 409);
  if (isPaymentComplete(settled.status)) {
    throw new CheckoutChoiceError(ALREADY_PAID_MESSAGE, 409);
  }
  if (settled.amount !== quote.total_cents) {
    throw new CheckoutChoiceError("Payment amount was not updated.", 409);
  }

  const afterUpdate = await ensureCheckoutNotAlreadyPaid(settled, "checkout_full_after_update");
  if (afterUpdate.blocked) {
    throw new CheckoutChoiceError(afterUpdate.message ?? ALREADY_PAID_MESSAGE, 409);
  }
  return settled;
}

/**
 * Revert the single payment row to the configured deposit.
 * The deposit is recomputed from current settings. An open full-amount
 * Checkout Session is expired before the row changes.
 */
async function settleDeposit(payment: Payment, businessId: string): Promise<Payment> {
  if (!payment.quote_id) {
    throw new CheckoutChoiceError("This payment is not tied to a quote.", 400);
  }
  const settings = await getAppSettings(businessId);
  const paySettings = settings.workflow.payments;
  if (paySettings.depositMode === "none") {
    throw new CheckoutChoiceError("Switching to the deposit is not available.", 400);
  }

  const db = await createTenantServiceClient(businessId);
  const { data: quote } = await db
    .from("project_quotes")
    .select("id, project_id, total_cents")
    .eq("id", payment.quote_id)
    .maybeSingle();
  if (!quote || quote.project_id !== payment.project_id || quote.total_cents <= 0) {
    throw new CheckoutChoiceError("Quote not found.", 404);
  }

  const { data: rows } = await db
    .from("payments")
    .select("amount, status")
    .eq("quote_id", payment.quote_id);
  const paidCents = (rows ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + row.amount, 0);
  if (paidCents > 0) {
    throw new CheckoutChoiceError("A payment was already recorded for this quote.", 409);
  }

  const charge = resolveDepositCharge(quote.total_cents, paySettings);
  const targetCents = charge.isDeposit ? charge.amountCents : quote.total_cents;
  const targetDescription = charge.isDeposit
    ? depositPaymentDescription(charge.amountCents, quote.total_cents)
    : fullPaymentDescription(quote.total_cents);

  const before = await ensureCheckoutNotAlreadyPaid(payment, "checkout_deposit_before_update");
  if (before.blocked) {
    throw new CheckoutChoiceError(before.message ?? ALREADY_PAID_MESSAGE, 409);
  }

  const { stripe, requestOptions } = await getStripeForBusiness(businessId);
  const expired = await expireCheckoutSession(payment, stripe, requestOptions);
  if (!expired) {
    throw new CheckoutChoiceError("The open checkout session could not be closed.", 409);
  }

  const afterExpire = await ensureCheckoutNotAlreadyPaid(payment, "checkout_deposit_after_expire");
  if (afterExpire.blocked) {
    throw new CheckoutChoiceError(afterExpire.message ?? ALREADY_PAID_MESSAGE, 409);
  }

  const { data: updated, error } = await db
    .from("payments")
    .update({
      amount: targetCents,
      description: targetDescription,
    })
    .eq("id", payment.id)
    .in("status", ["pending", "sent", "draft"])
    .select("*")
    .maybeSingle();
  if (error) throw new CheckoutChoiceError(error.message, 500);

  const settled = (updated as Payment | null) ?? (await loadPayment(payment.id, businessId));
  if (!settled) throw new CheckoutChoiceError("Payment could not be updated.", 409);
  if (isPaymentComplete(settled.status)) {
    throw new CheckoutChoiceError(ALREADY_PAID_MESSAGE, 409);
  }
  if (settled.amount !== targetCents) {
    throw new CheckoutChoiceError("Payment amount was not updated.", 409);
  }

  if (charge.isDeposit) {
    await reactivateMatchingDepositLink(settled, charge.amountCents, stripe, requestOptions);
  }

  const afterUpdate = await ensureCheckoutNotAlreadyPaid(settled, "checkout_deposit_after_update");
  if (afterUpdate.blocked) {
    throw new CheckoutChoiceError(afterUpdate.message ?? ALREADY_PAID_MESSAGE, 409);
  }
  return settled;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await getTenantContext();
    const payment = await loadPayment(id, tenant?.businessId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;
    if (!tenant) return missingTenantResponse(auth.profile.role);

    if (isPaymentComplete(payment.status)) {
      const redirectUrl = `${portalCheckoutBaseUrl(tenant.business)}/dashboard/projects/${payment.project_id}?payment=already_completed#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const block = await ensureCheckoutNotAlreadyPaid(payment, "checkout_get");
    if (block.blocked) {
      const redirectUrl = `${portalCheckoutBaseUrl(tenant.business)}/dashboard/projects/${payment.project_id}?payment=already_completed#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const result = await createCheckoutSession(payment, tenant.businessId, tenant.business);
    if (!result.ok) return result.response;

    return NextResponse.redirect(result.session.url!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[payments/checkout] GET error:", err);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await getTenantContext();
    const payment = await loadPayment(id, tenant?.businessId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;
    if (!tenant) return missingTenantResponse(auth.profile.role);

    if (isPaymentComplete(payment.status)) {
      return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
    }

    let choice: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.choice === "string") choice = body.choice;
    } catch {
      choice = undefined;
    }
    if (choice && choice !== "full" && choice !== "deposit") {
      return NextResponse.json({ error: "Unknown checkout choice." }, { status: 400 });
    }

    const paymentToCharge =
      choice === "full"
        ? await settlePayInFull(payment, tenant.businessId)
        : choice === "deposit"
          ? await settleDeposit(payment, tenant.businessId)
          : payment;

    const block = await ensureCheckoutNotAlreadyPaid(
      paymentToCharge,
      choice === "full" ? "checkout_post_full" : choice === "deposit" ? "checkout_post_deposit" : "checkout_post"
    );
    if (block.blocked) {
      return NextResponse.json({ error: block.message ?? ALREADY_PAID_MESSAGE }, { status: 409 });
    }

    const result = await createCheckoutSession(paymentToCharge, tenant.businessId, tenant.business);
    if (!result.ok) return result.response;

    return NextResponse.json({ url: result.session.url, sessionId: result.session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof CheckoutChoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[payments/checkout] POST error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
