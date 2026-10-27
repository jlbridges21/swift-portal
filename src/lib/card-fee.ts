/**
 * Optional card processing fee a business can pass on to its clients (Settings →
 * Payments). Bank (ACH) payments never carry it.
 *
 * The fee grosses up Stripe's standard US card rate (2.9% + 30¢) so the business keeps
 * the invoice amount, but never exceeds 3% of the amount: the card networks' US cap
 * for surcharges. Small payments therefore recover slightly less than the full fee.
 */

export const CARD_FEE_PERCENT = 2.9;
export const CARD_FEE_FIXED_CENTS = 30;
export const CARD_SURCHARGE_CAP_PERCENT = 3;

/** Line item name on Stripe checkouts and payment links. */
export const CARD_FEE_LINE_NAME = "Card processing fee";

export function cardFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const amount = Math.round(amountCents);
  const grossed = Math.ceil((amount + CARD_FEE_FIXED_CENTS) / (1 - CARD_FEE_PERCENT / 100));
  const cap = Math.floor((amount * CARD_SURCHARGE_CAP_PERCENT) / 100);
  return Math.max(0, Math.min(grossed - amount, cap));
}

/** Stripe's US ACH Direct Debit price: 0.8%, capped at $5. Paid by the business. */
export function achFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.min(500, Math.round(amountCents * 0.008));
}
