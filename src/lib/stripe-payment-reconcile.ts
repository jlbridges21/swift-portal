import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";
import { isPaymentComplete } from "@/lib/payment-status";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";
import {
  findPaymentFromStripe,
  handlePaymentSuccess,
  resolvePaymentFromCheckoutSession,
} from "@/lib/stripe-payments";
import type { Payment } from "@/lib/types";
import type Stripe from "stripe";

export type StripeSucceededPayment = {
  checkoutSessionId: string;
  paymentIntentId: string;
  receiptUrl: string | null;
  metadata: Stripe.Metadata;
  amountReceived: number;
  paidAt: string;
};

export type ReconcilePaymentResult = {
  paymentId: string;
  businessId: string | null;
  repaired: boolean;
  alreadyPaid: boolean;
  skipped?: string;
};

export type ReconcileProjectResult = {
  projectId: string;
  businessId: string;
  results: ReconcilePaymentResult[];
  changed: boolean;
};

export type PaymentReconciliationDrift = {
  businessId: string;
  businessName: string;
  paymentId: string;
  projectId: string;
  amount: number;
  stripePaymentIntentId: string;
  stripePaidAt: string;
};

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

function isChargeRefunded(charge: Stripe.Charge | string | null | undefined): boolean {
  if (!charge || typeof charge === "string") return false;
  return Boolean(charge.refunded);
}

/** Prefer the earliest non-refunded succeeded checkout for this payment link / amount. */
export function pickAuthoritativeSucceededSession(
  sessions: Stripe.Checkout.Session[],
  expectedAmountCents: number
): Stripe.Checkout.Session | null {
  const candidates = sessions
    .filter(
      (session) =>
        session.payment_status === "paid" &&
        typeof session.amount_total === "number" &&
        session.amount_total === expectedAmountCents
    )
    .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

  return candidates[0] ?? null;
}

export async function isPaymentIntentRefunded(
  stripe: Stripe,
  paymentIntentId: string,
  requestOptions?: Stripe.RequestOptions
): Promise<boolean> {
  try {
    const intent = requestOptions
      ? await stripe.paymentIntents.retrieve(
          paymentIntentId,
          { expand: ["latest_charge"] },
          requestOptions
        )
      : await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });

    if (intent.status !== "succeeded") return true;
    return isChargeRefunded(intent.latest_charge as Stripe.Charge | string | null | undefined);
  } catch {
    return false;
  }
}

async function sessionToSucceededPayment(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  requestOptions?: Stripe.RequestOptions
): Promise<StripeSucceededPayment | null> {
  const paymentIntentId = paymentIntentIdFromSession(session);
  if (!paymentIntentId) return null;

  if (await isPaymentIntentRefunded(stripe, paymentIntentId, requestOptions)) {
    return null;
  }

  let metadata = session.metadata ?? {};
  if (!metadata.payment_id && paymentIntentId) {
    try {
      const intent = requestOptions
        ? await stripe.paymentIntents.retrieve(paymentIntentId, {}, requestOptions)
        : await stripe.paymentIntents.retrieve(paymentIntentId);
      metadata = { ...metadata, ...intent.metadata };
    } catch {
      // Non-fatal — link / session lookup may still match.
    }
  }

  const receiptUrl =
    (session as { receipt_url?: string | null }).receipt_url ??
    (typeof session.invoice === "object" && session.invoice
      ? (session.invoice as Stripe.Invoice).hosted_invoice_url
      : null);

  return {
    checkoutSessionId: session.id,
    paymentIntentId,
    receiptUrl: receiptUrl ?? null,
    metadata,
    amountReceived: session.amount_total ?? 0,
    paidAt: new Date((session.created ?? 0) * 1000).toISOString(),
  };
}

/** Query Stripe directly for a succeeded, non-refunded payment tied to this row. */
export async function findSucceededStripePaymentForRecord(
  payment: Payment
): Promise<StripeSucceededPayment | null> {
  const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);

  if (payment.stripe_checkout_session_id) {
    try {
      const session = requestOptions
        ? await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id, {}, requestOptions)
        : await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id);

      if (session.payment_status === "paid") {
        return sessionToSucceededPayment(stripe, session, requestOptions);
      }
    } catch (err) {
      console.warn("[stripe-reconcile] checkout session lookup failed", {
        paymentId: payment.id,
        sessionId: payment.stripe_checkout_session_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  if (payment.stripe_payment_intent_id) {
    try {
      const intent = requestOptions
        ? await stripe.paymentIntents.retrieve(
            payment.stripe_payment_intent_id,
            { expand: ["latest_charge"] },
            requestOptions
          )
        : await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
            expand: ["latest_charge"],
          });

      if (
        intent.status === "succeeded" &&
        !isChargeRefunded(intent.latest_charge as Stripe.Charge | string | null | undefined)
      ) {
        return {
          checkoutSessionId: payment.stripe_checkout_session_id ?? "",
          paymentIntentId: intent.id,
          receiptUrl: payment.stripe_receipt_url,
          metadata: intent.metadata ?? {},
          amountReceived: intent.amount_received ?? payment.amount,
          paidAt: new Date(intent.created * 1000).toISOString(),
        };
      }
    } catch (err) {
      console.warn("[stripe-reconcile] payment intent lookup failed", {
        paymentId: payment.id,
        paymentIntentId: payment.stripe_payment_intent_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  if (payment.stripe_payment_link_id) {
    try {
      const sessions = requestOptions
        ? await stripe.checkout.sessions.list(
            { payment_link: payment.stripe_payment_link_id, limit: 100 },
            requestOptions
          )
        : await stripe.checkout.sessions.list({
            payment_link: payment.stripe_payment_link_id,
            limit: 100,
          });

      const session = pickAuthoritativeSucceededSession(sessions.data, payment.amount);
      if (!session) return null;

      const succeeded = await sessionToSucceededPayment(stripe, session, requestOptions);
      if (!succeeded) return null;

      for (const extra of sessions.data) {
        if (extra.id === session.id) continue;
        if (extra.payment_status !== "paid") continue;
        const extraPi = paymentIntentIdFromSession(extra);
        if (!extraPi) continue;
        if (await isPaymentIntentRefunded(stripe, extraPi, requestOptions)) {
          await recordRefundedOrDuplicateStripeAttempt(payment, extraPi, "refunded");
        } else if (isPaymentComplete(payment.status)) {
          await recordRefundedOrDuplicateStripeAttempt(payment, extraPi, "duplicate_checkout_session");
        }
      }

      return succeeded;
    } catch (err) {
      console.warn("[stripe-reconcile] payment link session list failed", {
        paymentId: payment.id,
        paymentLinkId: payment.stripe_payment_link_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  return null;
}

/** Fill missing Stripe IDs on an already-paid row and deactivate the payment link if needed. */
export async function backfillPaidPaymentStripeIds(payment: Payment): Promise<boolean> {
  if (!isPaymentComplete(payment.status) || !payment.business_id) return false;

  const stripeMatch = await findSucceededStripePaymentForRecord(payment);
  if (!stripeMatch) return false;

  const needsUpdate = Boolean(
    !payment.stripe_payment_intent_id ||
      (!payment.stripe_checkout_session_id && stripeMatch.checkoutSessionId)
  );

  if (needsUpdate) {
    const db = await createTenantServiceClient(payment.business_id);
    await db
      .from("payments")
      .update({
        stripe_payment_intent_id: payment.stripe_payment_intent_id ?? stripeMatch.paymentIntentId,
        stripe_checkout_session_id:
          payment.stripe_checkout_session_id || stripeMatch.checkoutSessionId || null,
        stripe_receipt_url: payment.stripe_receipt_url ?? stripeMatch.receiptUrl,
      })
      .eq("id", payment.id);
  }

  if (payment.stripe_payment_link_id) {
    try {
      const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
      if (requestOptions) {
        await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false }, requestOptions);
      } else {
        await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false });
      }
    } catch (err) {
      console.warn("[stripe-reconcile] failed to deactivate payment link on backfill", {
        paymentId: payment.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  return needsUpdate;
}

export async function recordRefundedOrDuplicateStripeAttempt(
  payment: Payment,
  stripePaymentIntentId: string,
  reason: "refunded" | "duplicate_checkout_session"
): Promise<void> {
  const businessId = payment.business_id;
  if (!businessId) return;

  const description =
    reason === "refunded"
      ? `Refunded duplicate Stripe payment (${stripePaymentIntentId}) — not counted as revenue`
      : `Additional Stripe checkout succeeded (${stripePaymentIntentId}) — not recorded; client should use original payment`;

  await logProjectActivity("payment_requested", description, {
    businessId,
    projectId: payment.project_id,
    idempotencyKey: `payment:stripe-duplicate:${payment.id}:${stripePaymentIntentId}`,
    metadata: {
      paymentId: payment.id,
      stripePaymentIntentId,
      reason,
      excludedFromRevenue: true,
    },
  });
}

/** Idempotent — safe if webhook already recorded the payment. */
export async function reconcilePaymentFromStripe(
  payment: Payment,
  source: string
): Promise<ReconcilePaymentResult> {
  const businessId = payment.business_id ?? null;
  const base = {
    paymentId: payment.id,
    businessId,
    repaired: false,
    alreadyPaid: false,
  };

  if (!businessId) {
    return { ...base, skipped: "missing_business_id" };
  }

  if (isPaymentComplete(payment.status)) {
    await backfillPaidPaymentStripeIds(payment);
    return { ...base, alreadyPaid: true };
  }

  const stripeMatch = await findSucceededStripePaymentForRecord(payment);
  if (!stripeMatch) {
    return { ...base, skipped: "no_succeeded_stripe_payment" };
  }

  if (stripeMatch.amountReceived > 0 && stripeMatch.amountReceived !== payment.amount) {
    console.error("[stripe-reconcile] amount mismatch — refusing auto-repair", {
      paymentId: payment.id,
      expected: payment.amount,
      received: stripeMatch.amountReceived,
      source,
    });
    return { ...base, skipped: "amount_mismatch" };
  }

  const resolved =
    (await findPaymentFromStripe({
      metadata: stripeMatch.metadata,
      paymentIntentId: stripeMatch.paymentIntentId,
      checkoutSessionId: stripeMatch.checkoutSessionId || undefined,
      paymentLinkId: payment.stripe_payment_link_id ?? undefined,
    })) ?? payment;

  try {
    const result = await handlePaymentSuccess({
      payment: resolved,
      checkoutSessionId: stripeMatch.checkoutSessionId || payment.stripe_checkout_session_id || undefined,
      paymentIntentId: stripeMatch.paymentIntentId,
      receiptUrl: stripeMatch.receiptUrl,
      source: `reconcile:${source}`,
      metadata: stripeMatch.metadata,
    });

    return {
      paymentId: payment.id,
      businessId,
      repaired: result.updated,
      alreadyPaid: result.alreadyPaid,
    };
  } catch (err) {
    console.error("[stripe-reconcile] handlePaymentSuccess failed", {
      paymentId: payment.id,
      source,
      error: err instanceof Error ? err.message : err,
    });
    return { ...base, skipped: "handle_failed" };
  }
}

export async function reconcileProjectOutstandingPayments(
  projectId: string,
  businessId: string,
  source: string
): Promise<ReconcileProjectResult> {
  const db = await createServiceClient();
  const { data: rows } = await db
    .from("payments")
    .select("*")
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: true });

  const results: ReconcilePaymentResult[] = [];
  for (const row of rows ?? []) {
    results.push(await reconcilePaymentFromStripe(row as Payment, source));
  }

  return {
    projectId,
    businessId,
    results,
    changed: results.some((r) => r.repaired),
  };
}

/** Reconcile outstanding rows and backfill/deactivate paid rows (project page load). */
export async function reconcileProjectPaymentsOnLoad(
  projectId: string,
  businessId: string,
  source: string
): Promise<ReconcileProjectResult> {
  const outstanding = await reconcileProjectOutstandingPayments(projectId, businessId, source);

  const db = await createServiceClient();
  const { data: paidRows } = await db
    .from("payments")
    .select("*")
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .eq("status", "paid");

  for (const row of paidRows ?? []) {
    const payment = row as Payment;
    if (!payment.stripe_payment_intent_id || payment.stripe_payment_link_id) {
      const backfilled = await backfillPaidPaymentStripeIds(payment);
      if (backfilled) {
        outstanding.changed = true;
      }
      await findSucceededStripePaymentForRecord(payment);
    }
  }

  return outstanding;
}

export async function ensureCheckoutNotAlreadyPaid(
  payment: Payment,
  source: string
): Promise<{ blocked: boolean; message?: string; reconciled?: boolean }> {
  if (isPaymentComplete(payment.status)) {
    return { blocked: true, message: "This payment has already been completed." };
  }

  const reconcile = await reconcilePaymentFromStripe(payment, `${source}:preflight`);
  if (reconcile.repaired || reconcile.alreadyPaid) {
    return {
      blocked: true,
      message: "This payment has already been completed.",
      reconciled: reconcile.repaired,
    };
  }

  const stripeMatch = await findSucceededStripePaymentForRecord(payment);
  if (stripeMatch) {
    const secondPass = await reconcilePaymentFromStripe(payment, `${source}:stripe_block`);
    if (secondPass.repaired || secondPass.alreadyPaid) {
      return {
        blocked: true,
        message: "This payment has already been completed.",
        reconciled: secondPass.repaired,
      };
    }
    return {
      blocked: true,
      message:
        "Stripe shows this payment as already completed. Refresh the page — your downloads should be unlocked.",
    };
  }

  return { blocked: false };
}

export async function scanOutstandingPaymentsForReconciliation(options?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<{
  scanned: number;
  drift: PaymentReconciliationDrift[];
  repaired: ReconcilePaymentResult[];
  errors: string[];
}> {
  const dryRun = options?.dryRun ?? false;
  const limit = options?.limit ?? 200;
  const supabase = await createServiceClient();

  const { data: outstanding } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["pending", "sent"])
    .not("stripe_payment_link_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  const { data: businesses } = await supabase.from("businesses").select("id, name").is("deleted_at", null);
  const businessNames = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));

  const drift: PaymentReconciliationDrift[] = [];
  const repaired: ReconcilePaymentResult[] = [];
  const errors: string[] = [];

  for (const row of outstanding ?? []) {
    const payment = row as Payment;
    let stripeMatch: StripeSucceededPayment | null = null;
    try {
      stripeMatch = await findSucceededStripePaymentForRecord(payment);
    } catch (err) {
      errors.push(
        `${payment.id}: ${err instanceof Error ? err.message : "stripe lookup failed"}`
      );
      continue;
    }

    if (!stripeMatch) continue;

    drift.push({
      businessId: payment.business_id ?? "",
      businessName: businessNames.get(payment.business_id ?? "") ?? "Unknown",
      paymentId: payment.id,
      projectId: payment.project_id,
      amount: payment.amount,
      stripePaymentIntentId: stripeMatch.paymentIntentId,
      stripePaidAt: stripeMatch.paidAt,
    });

    if (dryRun) continue;

    const result = await reconcilePaymentFromStripe(payment, "cron");
    repaired.push(result);

    if (result.repaired && payment.business_id) {
      await notifyAdmins({
        businessId: payment.business_id,
        type: "payment_received",
        eventKey: "payment_received",
        title: "Payment auto-reconciled",
        body: `Stripe payment ${stripeMatch.paymentIntentId} was succeeded but missing in the portal — repaired automatically.`,
        link: `/admin/projects/${payment.project_id}#payments`,
        projectId: payment.project_id,
        paymentId: payment.id,
      });
    }
  }

  if (drift.length > 0) {
    console.error("[cron/payment-reconciliation] drift detected", {
      count: drift.length,
      dryRun,
      drift,
    });
  }

  return { scanned: outstanding?.length ?? 0, drift, repaired, errors };
}

/** Resolve checkout session object the same way the webhook does (for tests / tooling). */
export async function resolvePaymentFromStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  stripeAccountId?: string | null
) {
  return resolvePaymentFromCheckoutSession(session, stripeAccountId);
}
