import type { PaymentStatus } from "@/lib/types";

/** Payment is settled — no further checkout should be created. */
export function isPaymentComplete(status: PaymentStatus | string): boolean {
  return status === "paid";
}

/** Client checkout URL — validates status before redirecting to Stripe. */
export function paymentCheckoutPath(paymentId: string): string {
  return `/api/payments/${paymentId}/checkout`;
}
