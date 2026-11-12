import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAuth } from "@/lib/auth";
import { canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getStripeForBusiness, isBankPaymentAvailable, portalCheckoutBaseUrl, StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { isPaymentCovered } from "@/lib/payment-status";
import { CARD_FEE_LINE_NAME } from "@/lib/card-fee";
import {
  BANK_UNAVAILABLE_MESSAGE,
  CheckoutStartError,
  createClientCheckoutSession,
  expireCheckoutSession,
  type CheckoutMethod,
} from "@/lib/client-checkout";
import { ensureCheckoutNotAlreadyPaid } from "@/lib/stripe-payment-reconcile";
import { depositPaymentDescription, fullPaymentDescription, resolveDepositCharge, resolveQuoteDepositTerms } from "@/lib/payment-quote";
import { getAppSettings } from "@/lib/app-settings";
import type { Payment } from "@/lib/types";
import type { StripeConnectRequestOptions } from "@/lib/stripe";
import type Stripe from "stripe";

const ALREADY_PAID_MESSAGE = "This payment has already been completed.";
const PROCESSING_MESSAGE = "This payment is already processing. Bank payments usually clear in a few business days.";

function coveredMessage(status: string): string {
  return status === "processing" ? PROCESSING_MESSAGE : ALREADY_PAID_MESSAGE;
}

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

async function createCheckoutSession(
  payment: Payment,
  businessId: string,
  business: { slug: string; custom_domain?: string | null },
  method: CheckoutMethod = "card",
  returnTo: "payments" | "marketing" = "payments",
  options: { uiMode?: "hosted" | "elements"; requestHost?: string | null } = {}
) {
  try {
    const result = await createClientCheckoutSession({
      payment,
      businessId,
      business,
      method,
      returnTo,
      uiMode: options.uiMode,
      requestHost: options.requestHost,
    });
    return { ok: true as const, ...result };
  } catch (err) {
    if (err instanceof CheckoutStartError) {
      return { ok: false as const, response: NextResponse.json({ error: err.message }, { status: err.status }) };
    }
    throw err;
  }
}

function expireStoredCheckoutSession(payment: Payment, stripe: Stripe, requestOptions?: StripeConnectRequestOptions) {
  return expireCheckoutSession(payment.stripe_checkout_session_id, stripe, requestOptions);
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
  return expireStoredCheckoutSession(payment, stripe, requestOptions);
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
    // The client's card fee is on top of the deposit; compare the deposit itself.
    if (item.description === CARD_FEE_LINE_NAME) continue;
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
  if (!paySettings.allowClientPayInFull) {
    throw new CheckoutChoiceError("Paying the full total is not available.", 400);
  }

  const db = await createTenantServiceClient(businessId);
  const { data: quote } = await db
    .from("project_quotes")
    .select("id, project_id, total_cents, deposit_mode, deposit_percent, deposit_amount_cents")
    .eq("id", payment.quote_id)
    .maybeSingle();
  if (!quote || quote.project_id !== payment.project_id || quote.total_cents <= 0) {
    throw new CheckoutChoiceError("Quote not found.", 404);
  }
  const terms = resolveQuoteDepositTerms(quote, paySettings);
  if (terms.depositMode === "none") {
    throw new CheckoutChoiceError("Paying the full total is not available.", 400);
  }

  const { data: rows } = await db
    .from("payments")
    .select("amount, status")
    .eq("quote_id", payment.quote_id);
  const paidCents = (rows ?? [])
    .filter((row) => isPaymentCovered(row.status))
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
  if (isPaymentCovered(settled.status)) {
    throw new CheckoutChoiceError(coveredMessage(settled.status), 409);
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

  const db = await createTenantServiceClient(businessId);
  const { data: quote } = await db
    .from("project_quotes")
    .select("id, project_id, total_cents, deposit_mode, deposit_percent, deposit_amount_cents")
    .eq("id", payment.quote_id)
    .maybeSingle();
  if (!quote || quote.project_id !== payment.project_id || quote.total_cents <= 0) {
    throw new CheckoutChoiceError("Quote not found.", 404);
  }
  const terms = resolveQuoteDepositTerms(quote, paySettings);
  if (terms.depositMode === "none") {
    throw new CheckoutChoiceError("Switching to the deposit is not available.", 400);
  }

  const { data: rows } = await db
    .from("payments")
    .select("amount, status")
    .eq("quote_id", payment.quote_id);
  const paidCents = (rows ?? [])
    .filter((row) => isPaymentCovered(row.status))
    .reduce((sum, row) => sum + row.amount, 0);
  if (paidCents > 0) {
    throw new CheckoutChoiceError("A payment was already recorded for this quote.", 409);
  }

  const charge = resolveDepositCharge(quote.total_cents, terms);
  const targetCents = charge.isDeposit ? charge.amountCents : quote.total_cents;
  const targetDescription = charge.isDeposit
    ? depositPaymentDescription(charge.amountCents, quote.total_cents)
    : fullPaymentDescription(quote.total_cents);

  const before = await ensureCheckoutNotAlreadyPaid(payment, "checkout_deposit_before_update");
  if (before.blocked) {
    throw new CheckoutChoiceError(before.message ?? ALREADY_PAID_MESSAGE, 409);
  }

  const { stripe, requestOptions } = await getStripeForBusiness(businessId);
  const expired = await expireStoredCheckoutSession(payment, stripe, requestOptions);
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
  if (isPaymentCovered(settled.status)) {
    throw new CheckoutChoiceError(coveredMessage(settled.status), 409);
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

    if (isPaymentCovered(payment.status)) {
      const redirectUrl = `${portalCheckoutBaseUrl(tenant.business)}/dashboard/projects/${payment.project_id}?payment=${payment.status === "processing" ? "processing" : "already_completed"}#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const block = await ensureCheckoutNotAlreadyPaid(payment, "checkout_get");
    if (block.blocked) {
      const redirectUrl = `${portalCheckoutBaseUrl(tenant.business)}/dashboard/projects/${payment.project_id}?payment=already_completed#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const method: CheckoutMethod = new URL(_request.url).searchParams.get("method") === "bank" ? "bank" : "card";
    const result = await createCheckoutSession(payment, tenant.businessId, tenant.business, method);
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

    if (isPaymentCovered(payment.status)) {
      return NextResponse.json({ error: coveredMessage(payment.status) }, { status: 409 });
    }

    let choice: string | undefined;
    let methodRaw: string | undefined;
    let returnTo: "payments" | "marketing" = "payments";
    let embedded = false;
    try {
      const body = await request.json();
      if (body && body.embedded === true) embedded = true;
      if (body && typeof body.choice === "string") choice = body.choice;
      if (body && typeof body.method === "string") methodRaw = body.method;
      if (body && body.returnTo === "marketing") returnTo = "marketing";
    } catch {
      choice = undefined;
    }
    if (choice && choice !== "full" && choice !== "deposit") {
      return NextResponse.json({ error: "Unknown checkout choice." }, { status: 400 });
    }
    if (methodRaw && methodRaw !== "card" && methodRaw !== "bank") {
      return NextResponse.json({ error: "Unknown payment method." }, { status: 400 });
    }
    const method: CheckoutMethod = methodRaw === "bank" ? "bank" : "card";
    if (method === "bank" && !(await isBankPaymentAvailable(tenant.businessId))) {
      return NextResponse.json({ error: BANK_UNAVAILABLE_MESSAGE }, { status: 400 });
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

    const result = await createCheckoutSession(paymentToCharge, tenant.businessId, tenant.business, method, returnTo, {
      uiMode: embedded ? "elements" : "hosted",
      requestHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    });
    if (!result.ok) return result.response;

    if (result.embedded) {
      // Embedded (Payment Element) checkout: no redirect. Only the client secret leaves the server.
      return NextResponse.json(result.embedded);
    }
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
