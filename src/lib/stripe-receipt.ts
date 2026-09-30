/**
 * Stripe receipt URL lives on the Charge, not the Checkout Session.
 * One resolver for the platform account (no Stripe-Account header) and
 * Connect (header set). Callers pass the stored stripe account id or null.
 */
import type Stripe from "stripe";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";

export type StripeReceiptDetails = {
  receiptUrl: string | null;
  cardLast4: string | null;
};

type ChargeLike = {
  receipt_url?: string | null;
  payment_method_details?: {
    card?: { last4?: string | null } | null;
  } | null;
};

export function receiptDetailsFromCharge(charge: ChargeLike | null | undefined): StripeReceiptDetails {
  const receiptUrl = charge?.receipt_url?.trim() || null;
  const last4 = charge?.payment_method_details?.card?.last4?.trim() || null;
  return {
    receiptUrl: receiptUrl || null,
    cardLast4: last4 && /^\d{4}$/.test(last4) ? last4 : null,
  };
}

/**
 * Retrieve the PaymentIntent's latest charge and read receipt_url.
 * stripeAccountId null/empty = platform account. A connected account id
 * is sent as the Stripe-Account header, same as other Flow B calls.
 * Returns nulls when Stripe has no receipt. Does not invent one.
 */
async function retrieveCharge(
  stripe: Stripe,
  chargeId: string,
  requestOptions?: Stripe.RequestOptions
): Promise<Stripe.Charge> {
  return requestOptions
    ? stripe.charges.retrieve(chargeId, {}, requestOptions)
    : stripe.charges.retrieve(chargeId);
}

export async function resolveStripeReceipt(args: {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  stripeAccountId?: string | null;
}): Promise<StripeReceiptDetails> {
  const paymentIntentId = args.paymentIntentId?.trim() || "";
  const chargeId = args.chargeId?.trim() || "";
  if (!paymentIntentId && !chargeId) return { receiptUrl: null, cardLast4: null };

  const { stripe, requestOptions } = getStripeForStoredAccount(args.stripeAccountId);

  if (paymentIntentId) {
    const intent = requestOptions
      ? await stripe.paymentIntents.retrieve(
          paymentIntentId,
          { expand: ["latest_charge"] },
          requestOptions
        )
      : await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });

    const latest = intent.latest_charge as Stripe.Charge | string | null;
    if (!latest) return { receiptUrl: null, cardLast4: null };
    if (typeof latest !== "string") return receiptDetailsFromCharge(latest);
    return receiptDetailsFromCharge(await retrieveCharge(stripe, latest, requestOptions));
  }

  return receiptDetailsFromCharge(await retrieveCharge(stripe, chargeId, requestOptions));
}

/** Webhook-safe wrapper. A Stripe error must not block recording the payment. */
export async function loadStripeReceipt(args: {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  stripeAccountId?: string | null;
}): Promise<StripeReceiptDetails> {
  try {
    return await resolveStripeReceipt(args);
  } catch (err) {
    console.error(
      "[stripe-receipt] charge lookup failed",
      err instanceof Error ? err.message.slice(0, 300) : "unknown"
    );
    return { receiptUrl: null, cardLast4: null };
  }
}

type InvoicePaymentRef = {
  payment?: {
    type?: string;
    payment_intent?: string | { id?: string | null } | null;
    charge?: string | { id?: string | null } | null;
  } | null;
};

function idOf(value: string | { id?: string | null } | null | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && typeof value.id === "string" && value.id.trim()) {
    return value.id;
  }
  return null;
}

/**
 * Invoice objects are not receipts. Read a PaymentIntent or Charge id from the
 * invoice payment list (and the legacy payment_intent field when present).
 * Hosted invoice URLs are never treated as receipts.
 */
export function stripeIdsFromInvoice(invoice: {
  payment_intent?: string | { id?: string | null } | null;
  payments?: { data?: InvoicePaymentRef[] | null } | null;
}): { paymentIntentId: string | null; chargeId: string | null } {
  const legacy = idOf(invoice.payment_intent);
  if (legacy) return { paymentIntentId: legacy, chargeId: null };

  for (const row of invoice.payments?.data ?? []) {
    const payment = row.payment;
    if (!payment) continue;
    const paymentIntentId = idOf(payment.payment_intent);
    if (paymentIntentId) return { paymentIntentId, chargeId: null };
    const chargeId = idOf(payment.charge);
    if (chargeId) return { paymentIntentId: null, chargeId };
  }
  return { paymentIntentId: null, chargeId: null };
}
