/** Shared payout strings and copy helpers (safe for client + server). */

export const PARTNER_ADJUST_DEBIT_CONFIRM = "ADJUST_DEBIT";
export const PARTNER_PAYOUT_DISCREPANCY_ACK = "ACK_PAYOUT_DISCREPANCY";

/** Days after a referred payment before commission becomes payable. Client-safe. */
export const PARTNER_COMMISSION_HOLD_DAYS = 30;

/**
 * Vercel cron for `/api/cron/partner-payouts` — single source of truth.
 * `vercel.json` must match; tenant-lint enforces it.
 * Format: minute hour day-of-month month day-of-week (UTC).
 */
export const PARTNER_PAYOUT_CRON_SCHEDULE = "0 15 1 * *";

/** Planned automated payout floor (cents). Surfaces in copy and eligibility. */
export const PARTNER_PAYOUT_MINIMUM_CENTS = 5000;

function dayOfMonthOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * Human schedule label derived from the cron expression — never a free-typed sentence.
 * Day-of-month field (3rd token) drives "on the Nth of each month".
 */
export function partnerPayoutScheduleLabelFromCron(
  cron: string = PARTNER_PAYOUT_CRON_SCHEDULE
): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    throw new Error(`Invalid partner payout cron (expected 5 fields): ${cron}`);
  }
  const dayField = parts[2];
  if (dayField === "*" || dayField.includes(",") || dayField.includes("-") || dayField.includes("/")) {
    throw new Error(
      `Partner payout cron day-of-month must be a single day 1–31 (got "${dayField}")`
    );
  }
  const day = Number(dayField);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Partner payout cron day-of-month out of range: ${dayField}`);
  }
  return `on the ${dayOfMonthOrdinal(day)} of each month`;
}

/** Derived from PARTNER_PAYOUT_CRON_SCHEDULE — changes when the cron day changes. */
export const PARTNER_PAYOUT_SCHEDULE_LABEL = partnerPayoutScheduleLabelFromCron();

export function formatPartnerCommissionKindLabel(kind: string): string {
  switch (kind) {
    case "commission":
      return "Commission";
    case "adjustment":
      return "Adjustment";
    case "reversal":
      return "Reversal";
    default:
      return kind;
  }
}

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Full-sentence skip reasons for partner UI and emails.
 * Minimum threshold must be passed in (derived) — never typed in the sentence.
 */
export function formatPartnerPayoutSkipReason(
  reason: string,
  details?: { minimumCents?: number; requirementsSummary?: string | null }
): string {
  const minimumCents = details?.minimumCents ?? PARTNER_PAYOUT_MINIMUM_CENTS;
  const minimumLabel = formatUsdCents(minimumCents);
  switch (reason) {
    case "partner_not_active":
      return "Your partner account is not active, so payouts are paused.";
    case "partner_not_found":
      return "We could not find your partner account. Contact ShootPortal support.";
    case "connect_not_linked":
      return "Connect your Stripe payout account under Payout details.";
    case "connect_payouts_disabled":
      return "Stripe has disabled payouts on your account. Finish Stripe requirements or contact Stripe support.";
    case "connect_requirements_due":
      return `Stripe needs more information: ${details?.requirementsSummary?.trim() || "complete onboarding in Stripe."}`;
    case "connect_not_ready":
      return "Your Stripe payout account is not ready to receive transfers yet.";
    case "mode_mismatch":
      return "Your payout account was connected with different Stripe keys. Connect again from Payout details.";
    case "below_minimum_threshold":
      return `Balance is below the ${minimumLabel} minimum.`;
    case "negative_balance":
      return "Your open balance is negative from refunds. It will clear as new commissions become payable.";
    case "zero_payable":
      return "There is no payable balance yet. Commissions become payable after the hold clears.";
    case "already_paid_this_period":
      return "A payout was already recorded for this month.";
    case "insufficient_platform_balance":
      return "ShootPortal could not complete the transfer right now. We will retry on the next run.";
    case "kill_switch":
      return "Payouts were paused by ShootPortal. No action needed on your side.";
    default:
      return reason.replace(/_/g, " ");
  }
}
