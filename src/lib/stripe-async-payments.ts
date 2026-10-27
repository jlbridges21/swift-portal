/**
 * Delayed-settlement (bank / ACH Direct Debit) payments.
 *
 * A Checkout Session paid by US bank account completes with payment_status "unpaid": the
 * client authorized the debit and Stripe is collecting it. The PaymentIntent is then
 * "processing" until the bank settles (checkout.session.async_payment_succeeded /
 * payment_intent.succeeded) or rejects it (checkout.session.async_payment_failed /
 * payment_intent.payment_failed). Only a "processing" intent counts as a started payment:
 * an unverified bank (microdeposits pending, "requires_action") has not been debited yet.
 */
import type Stripe from "stripe";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";

export function paymentIntentIdFromSession(session: Pick<Stripe.Checkout.Session, "payment_intent">): string | null {
  const pi = session.payment_intent;
  return typeof pi === "string" ? pi : pi?.id ?? null;
}

/** Pure check on an intent object (status + method). */
export function isProcessingBankIntent(intent: Pick<Stripe.PaymentIntent, "status" | "payment_method_types"> | null | undefined): boolean {
  return Boolean(intent && intent.status === "processing" && intent.payment_method_types?.includes("us_bank_account"));
}

/** Retrieve the session's PaymentIntent (on the right account) and ask whether it is a processing bank debit. */
export async function sessionIsProcessingBankPayment(
  session: Pick<Stripe.Checkout.Session, "payment_intent" | "status" | "payment_status">,
  stripeAccountId: string | null | undefined
): Promise<boolean> {
  if (session.status !== "complete" || session.payment_status !== "unpaid") return false;
  const intentId = paymentIntentIdFromSession(session);
  if (!intentId) return false;
  try {
    const { stripe, requestOptions } = getStripeForStoredAccount(stripeAccountId);
    const intent = requestOptions ? await stripe.paymentIntents.retrieve(intentId, {}, requestOptions) : await stripe.paymentIntents.retrieve(intentId);
    return isProcessingBankIntent(intent);
  } catch (err) {
    console.warn("[stripe-async] could not read payment intent for completed session", err instanceof Error ? err.message : err);
    return false;
  }
}
