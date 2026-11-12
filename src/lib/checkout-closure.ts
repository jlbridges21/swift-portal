import type Stripe from "stripe";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";
import { parsePaymentIdFromMetadata } from "@/lib/stripe-metadata";
import type { Payment } from "@/lib/types";

/**
 * Duplicate-charge guards shared by checkout creation, webhooks and admin actions.
 *
 * A payment row (one payable obligation) can be paid through three Stripe surfaces:
 *  - the Checkout Session stored on the row (in-app or hosted),
 *  - Checkout Sessions opened from its Stripe Payment Link (links already emailed),
 *  - in rare cases an older session that was replaced on the row.
 * Before a new session is opened, and as soon as the row is settled or removed, every other
 * open session for the row is expired so only one can ever take the client's money.
 */

type Ctx = ReturnType<typeof getStripeForStoredAccount>;

function stripeCtx(payment: Pick<Payment, "stripe_account_id">): Ctx {
  return getStripeForStoredAccount(payment.stripe_account_id);
}

async function expire({ stripe, requestOptions }: Ctx, sessionId: string): Promise<boolean> {
  try {
    if (requestOptions) await stripe.checkout.sessions.expire(sessionId, {}, requestOptions);
    else await stripe.checkout.sessions.expire(sessionId);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/status of `expired`|already expired/i.test(message)) return true;
    console.warn("[checkout-closure] could not expire session", { sessionId, error: message });
    return false;
  }
}

async function retrieveSession({ stripe, requestOptions }: Ctx, sessionId: string): Promise<Stripe.Checkout.Session | "missing" | null> {
  try {
    return requestOptions
      ? await stripe.checkout.sessions.retrieve(sessionId, {}, requestOptions)
      : await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    // The session doesn't exist on this account (deleted test data, reconnected account): it
    // can't be paid, so it doesn't block. Any other error is unknown → treated as possibly open.
    const code = (err as { code?: string } | null)?.code;
    return code === "resource_missing" ? "missing" : null;
  }
}

/** Open Checkout Sessions started from the row's Stripe Payment Link (an emailed buy.stripe.com link). */
async function openPaymentLinkSessions(ctx: Ctx, paymentLinkId: string): Promise<Stripe.Checkout.Session[]> {
  const params = { payment_link: paymentLinkId, status: "open" as const, limit: 20 };
  const list = ctx.requestOptions
    ? await ctx.stripe.checkout.sessions.list(params, ctx.requestOptions)
    : await ctx.stripe.checkout.sessions.list(params);
  return list.data;
}

export type CloseCheckoutsResult = {
  /** Every open session other than `exceptSessionId` is now closed. */
  allClosed: boolean;
  /** A session (other than the excepted one) already completed — money may have moved. */
  completedSessionId: string | null;
};

/**
 * Expire every open Checkout Session for this payment except `exceptSessionId`.
 * Never throws; `allClosed: false` means a session could not be closed (callers that are
 * about to open a new session must then refuse, so two sessions are never payable at once).
 */
export async function closeOpenCheckoutsForPayment(
  payment: Pick<Payment, "id" | "stripe_account_id" | "stripe_checkout_session_id" | "stripe_payment_link_id">,
  options: { exceptSessionId?: string | null } = {}
): Promise<CloseCheckoutsResult> {
  const ctx = stripeCtx(payment);
  const except = options.exceptSessionId ?? null;
  let allClosed = true;
  let completedSessionId: string | null = null;

  const stored = payment.stripe_checkout_session_id;
  if (stored && stored !== except) {
    const session = await retrieveSession(ctx, stored);
    if (session === "missing") {
      // nothing to close
    } else if (session?.status === "open") {
      if (!(await expire(ctx, stored))) allClosed = false;
    } else if (session?.status === "complete") {
      completedSessionId = session.id;
    } else if (!session) {
      // Unknown state (network / permissions): don't assume it's closed.
      allClosed = false;
    }
  }

  if (payment.stripe_payment_link_id) {
    try {
      for (const s of await openPaymentLinkSessions(ctx, payment.stripe_payment_link_id)) {
        if (s.id === except) continue;
        if (!(await expire(ctx, s.id))) allClosed = false;
      }
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== "resource_missing") allClosed = false;
      console.warn("[checkout-closure] payment link session list failed", {
        paymentId: payment.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  return { allClosed, completedSessionId };
}

export type InFlightStripePayment = {
  paymentIntentId: string;
  status: "succeeded" | "processing" | "requires_capture";
  amountReceived: number;
};

/**
 * Last-resort search for money already moving for this payment row, by the payment id stamped
 * on every PaymentIntent we create (in-app, hosted and Payment Link). Catches charges the row
 * doesn't point at — e.g. an older session whose webhook was lost. One Stripe Search call;
 * only used before opening a new checkout and by the status check. Search results can lag a
 * few seconds, so the session-level checks run first.
 */
export async function findInFlightStripePayment(
  payment: Pick<Payment, "id" | "stripe_account_id">
): Promise<InFlightStripePayment | null> {
  const { stripe, requestOptions } = stripeCtx(payment);
  const params = { query: `metadata['payment_id']:'${payment.id.replace(/[^0-9a-f-]/gi, "")}'`, limit: 20, expand: ["data.latest_charge"] };
  let result: Stripe.ApiSearchResult<Stripe.PaymentIntent>;
  try {
    result = requestOptions ? await stripe.paymentIntents.search(params, requestOptions) : await stripe.paymentIntents.search(params);
  } catch (err) {
    console.warn("[checkout-closure] payment intent search unavailable", { paymentId: payment.id, error: err instanceof Error ? err.message : err });
    return null;
  }
  for (const intent of result.data) {
    if (parsePaymentIdFromMetadata(intent.metadata) !== payment.id) continue;
    if (intent.status === "processing" || intent.status === "requires_capture") {
      return { paymentIntentId: intent.id, status: intent.status, amountReceived: intent.amount_received ?? 0 };
    }
    if (intent.status === "succeeded") {
      const charge = intent.latest_charge as Stripe.Charge | string | null;
      const refunded = typeof charge === "object" && charge !== null && charge.refunded === true;
      if (!refunded) return { paymentIntentId: intent.id, status: "succeeded", amountReceived: intent.amount_received ?? 0 };
    }
  }
  return null;
}

/**
 * Was this session closed by ShootPortal (replaced, settled or cancelled) rather than left to
 * time out? Stripe sends checkout.session.expired either way; only a natural timeout of the
 * row's current hosted session is worth an admin notification.
 */
export function wasClosedEarly(session: Pick<Stripe.Checkout.Session, "expires_at">, eventCreatedSec: number): boolean {
  return typeof session.expires_at === "number" && eventCreatedSec < session.expires_at - 60;
}

/**
 * The row is being cancelled or deleted: nothing may still take money for it. Expires every
 * open session and deactivates the Stripe Payment Link (otherwise an emailed link stays
 * payable and the money would arrive with no row to record it). Never throws.
 */
export async function retirePaymentCheckouts(
  payment: Pick<Payment, "id" | "stripe_account_id" | "stripe_checkout_session_id" | "stripe_payment_link_id">
): Promise<CloseCheckoutsResult> {
  const ctx = stripeCtx(payment);
  if (payment.stripe_payment_link_id) {
    try {
      if (ctx.requestOptions) await ctx.stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false }, ctx.requestOptions);
      else await ctx.stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false });
    } catch (err) {
      console.warn("[checkout-closure] could not deactivate payment link", { paymentId: payment.id, error: err instanceof Error ? err.message : err });
    }
  }
  return closeOpenCheckoutsForPayment(payment);
}
