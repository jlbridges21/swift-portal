/**
 * Local verification for partner payout skip-email fixes.
 * Does NOT send mail to live partners (isTest / gate-only / dry-run path checks).
 *
 *   npx tsx scripts/verify-payout-skip-email.ts
 */

import {
  renderEmailTemplate,
  renderEmailTemplatePair,
  UnresolvedEmailTemplateError,
} from "../src/lib/email-template-render";
import {
  shouldSendPayoutSkipEmail,
  humanizePayoutSkipReason,
} from "../src/lib/partner-payout-email";
import {
  formatCentsForEmail,
  payoutPeriodLabel,
  resolveTransferExecution,
} from "../src/lib/partner-payout-automation";
import { DEFAULT_PAYOUT_AUTOMATION } from "../src/lib/partner-payout-automation";

const SKIPPED_SUBJECT =
  "Finish Stripe setup to receive your {{payableAmount}} commission payout";
const SKIPPED_BODY = `Hi {{partnerName}},

You have {{payableAmount}} in payable commissions for {{periodLabel}}, but we could not send a Stripe transfer yet.

Reason: {{skipReason}}

Open payout details to finish setup: {{partnerPayoutDetailsUrl}}

— ShootPortal`;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function main() {
  // 1) Rendered body with all variables resolved
  section("1. Rendered skip email (all vars resolved)");
  const variables = {
    partnerName: "Verification Partner",
    periodLabel: payoutPeriodLabel("2026-08"),
    skipReason: humanizePayoutSkipReason("connect_not_linked"),
    payableAmount: formatCentsForEmail(12500),
    partnerPayoutDetailsUrl: "https://shootportal.app/partner/payout-details",
  };
  const rendered = renderEmailTemplatePair(SKIPPED_SUBJECT, SKIPPED_BODY, variables, {
    context: "verify",
  });
  if (!rendered.ok) throw new Error(rendered.error);
  console.log("SUBJECT:", rendered.subject);
  console.log("BODY:\n" + rendered.body);

  // 2) Zero balance + connect_not_linked → no email
  section("2. Zero balance + connect_not_linked → NO email");
  const zeroGate = shouldSendPayoutSkipEmail({
    skipReason: "connect_not_linked",
    openNetCents: 0,
  });
  console.log({ openNetCents: 0, skipReason: "connect_not_linked", shouldSend: zeroGate });
  if (zeroGate) throw new Error("Expected no email for zero balance");

  // 3) Positive balance + connect_not_linked → email
  section("3. Positive balance + connect_not_linked → email");
  const posGate = shouldSendPayoutSkipEmail({
    skipReason: "connect_not_linked",
    openNetCents: 12500,
  });
  console.log({ openNetCents: 12500, skipReason: "connect_not_linked", shouldSend: posGate });
  if (!posGate) throw new Error("Expected email for positive balance + connect block");
  console.log("Would render subject:", rendered.subject);
  console.log("Reason text:", variables.skipReason);

  // 4) Below minimum → no email
  section("4. below_minimum_threshold → NO email (informational only)");
  const below = shouldSendPayoutSkipEmail({
    skipReason: "below_minimum_threshold",
    openNetCents: 2500,
  });
  console.log({
    openNetCents: 2500,
    skipReason: "below_minimum_threshold",
    shouldSend: below,
    rationale:
      "Partner cannot act except by earning more; no Action needed email.",
  });
  if (below) throw new Error("Expected no email for below_minimum");

  // Never-email reasons
  for (const reason of [
    "zero_payable",
    "negative_balance",
    "partner_not_active",
    "already_paid_this_period",
  ] as const) {
    const g = shouldSendPayoutSkipEmail({ skipReason: reason, openNetCents: 99999 });
    if (g) throw new Error(`Expected no email for ${reason}`);
    console.log({ skipReason: reason, openNetCents: 99999, shouldSend: g });
  }

  // 5) Dry run → resolveTransferExecution never executeTransfers when dryRun
  section("5. Dry run → executeTransfers false (emails gated on !dryRun && executeTransfers)");
  const dry = resolveTransferExecution({
    settings: {
      ...DEFAULT_PAYOUT_AUTOMATION,
      automated_payouts_enabled: true,
      automated_payouts_dry_run: true,
      automated_payouts_test_transfers_enabled: true,
    },
    deployMode: "test",
    dryRunRequested: true,
  });
  console.log(dry);
  if (dry.executeTransfers || !dry.dryRun) {
    throw new Error("Dry run must not execute transfers");
  }
  const wouldEmail =
    true /* sendEmails */ && !dry.dryRun && dry.executeTransfers;
  console.log({ wouldSendSkipOrSentEmail: wouldEmail });
  if (wouldEmail) throw new Error("Dry run must not send emails");

  // 6) Empty-variable guard
  section("6. Empty-variable guard on deliberately broken template");
  let threw = false;
  try {
    renderEmailTemplate("Hello {{partnerName}} for {{periodLabel}}", {
      partnerName: "X",
      periodLabel: "",
    });
  } catch (err) {
    threw = err instanceof UnresolvedEmailTemplateError;
    console.log("threw UnresolvedEmailTemplateError:", threw, String(err));
  }
  if (!threw) throw new Error("Expected UnresolvedEmailTemplateError");

  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const soft = renderEmailTemplatePair(
    "Hi {{missingVar}}",
    "Body {{partnerName}}",
    { partnerName: "X" },
    { context: "broken-prod" }
  );
  process.env.NODE_ENV = prev;
  console.log("production soft-fail:", soft);
  if (soft.ok) throw new Error("Expected production soft-fail");

  console.log("\nAll skip-email verification checks passed.");
}

main();
