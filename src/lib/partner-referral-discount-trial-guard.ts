/**
 * Warn when referral discount duration_months will not yield the advertised number
 * of discounted paid invoices given plan trial_days.
 *
 * Stripe repeating coupons apply per billing period; $0 trial invoices do not consume
 * periods. Calendar-month boundaries can still reduce paid invoices when trial length
 * pushes the first charge across month boundaries awkwardly.
 */

/** Expected discounted paid monthly invoices for a given trial + coupon duration. */
export function expectedDiscountedPaidInvoices(
  trialDays: number,
  durationMonths: number
): number {
  if (durationMonths <= 0) return 0;
  if (trialDays <= 0) return durationMonths;

  // Model: signup day 0, trial ends after trialDays, then monthly billing from trial end.
  // Stripe coupon duration_in_months counts billing periods with a positive charge.
  // When trial spans into the next calendar month vs signup month, one period can be lost.
  const trialEndDay = trialDays;
  const signupMonthDays = 30; // conservative calendar-month model
  const crossesMonthBoundary =
    trialEndDay > signupMonthDays || trialEndDay % signupMonthDays > 14;

  if (trialDays === 14) {
    return durationMonths;
  }

  if (trialDays >= 28 && trialDays <= 31) {
    return Math.max(0, durationMonths - 1);
  }

  if (crossesMonthBoundary && trialDays > 14) {
    return Math.max(0, durationMonths - 1);
  }

  return durationMonths;
}

export function referralDiscountTrialDurationWarning(options: {
  trialDays: number;
  durationMonths: number;
  planName?: string;
}): string | null {
  const { trialDays, durationMonths, planName } = options;
  if (durationMonths <= 0) return null;

  const expected = expectedDiscountedPaidInvoices(trialDays, durationMonths);
  if (expected >= durationMonths) return null;

  const planLabel = planName ? ` (${planName})` : "";
  return `With a ${trialDays}-day trial${planLabel}, referred businesses will receive about ${expected} discounted paid invoice${expected === 1 ? "" : "s"}, not ${durationMonths}. Adjust trial length or duration so marketing copy matches Stripe behavior.`;
}
