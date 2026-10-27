import type { PaymentStatus } from "@/lib/types";

/** Payment is settled — the money has arrived. */
export function isPaymentComplete(status: PaymentStatus | string): boolean {
  return status === "paid";
}

/** Bank (ACH) payment authorized and on its way; Stripe confirms it in a few business days. */
export function isPaymentProcessing(status: PaymentStatus | string): boolean {
  return status === "processing";
}

/**
 * Paid, or authorized and processing. Counts toward the quote balance, unlocks delivery,
 * and blocks starting another checkout for the same payment.
 */
export function isPaymentCovered(status: PaymentStatus | string): boolean {
  return status === "paid" || status === "processing";
}

/** Client checkout URL — validates status before redirecting to Stripe. */
export function paymentCheckoutPath(paymentId: string): string {
  return `/api/payments/${paymentId}/checkout`;
}

/** How a payment was made, for history rows and receipts. */
export function paymentMethodLabel(payment: { payment_method_type?: string | null; card_last4?: string | null; stripe_checkout_session_id?: string | null; stripe_payment_intent_id?: string | null }): string | null {
  switch (payment.payment_method_type) {
    case "us_bank_account":
      return "Bank transfer (ACH)";
    case "card":
      return payment.card_last4 ? `Card ending ${payment.card_last4}` : "Card";
    case "manual":
      return "Recorded by the business";
    default:
      return payment.card_last4 ? `Card ending ${payment.card_last4}` : null;
  }
}
