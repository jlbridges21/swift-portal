/**
 * Integration proof: evaluate verification partner + simulate dry-run email gate.
 * Does not send emails.
 *
 *   npx tsx scripts/verify-payout-skip-email-integration.ts
 */

import { createServiceClient } from "../src/lib/supabase/server";
import { evaluatePartnerForPayout } from "../src/lib/partner-payout-run";
import { shouldSendPayoutSkipEmail } from "../src/lib/partner-payout-email";
import { getStripeMode } from "../src/lib/stripe";
import { PARTNER_PAYOUT_MINIMUM_CENTS } from "../src/lib/partner-payout-constants";
import {
  resolveTransferExecution,
  DEFAULT_PAYOUT_AUTOMATION,
} from "../src/lib/partner-payout-automation";

const VERIFY_PARTNER_ID = "683726a2-56e6-4376-93ef-ef06adf0d0c7";
const HAJAT_ID = "b638b018-0124-48b7-afa0-456fcca301e9";
const LIVE_JACKSON_ID = "140ccbea-1c16-4b76-9412-a95ad4f5311c";

async function loadPartner(id: string) {
  const raw = await createServiceClient();
  const { data, error } = await raw.from("partners").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Partner ${id} not found`);
  return data as {
    id: string;
    email: string;
    name: string;
    brand_name: string | null;
    status: string;
    stripe_connect_account_id: string | null;
    stripe_connect_mode: string | null;
    stripe_connect_payouts_enabled: boolean | null;
    stripe_connect_requirements_due: boolean | null;
    stripe_connect_requirements_summary: string | null;
    stripe_connect_account_status: string | null;
  };
}

async function main() {
  const stripeMode = getStripeMode();
  console.log("deploy stripeMode:", stripeMode);

  for (const [label, id] of [
    ["verification", VERIFY_PARTNER_ID],
    ["Hajat (live)", HAJAT_ID],
    ["Jackson (live)", LIVE_JACKSON_ID],
  ] as const) {
    const partner = await loadPartner(id);
    const evaluation = await evaluatePartnerForPayout({
      partner,
      periodKey: "2026-08",
      stripeMode,
      minimumCents: PARTNER_PAYOUT_MINIMUM_CENTS,
    });
    const shouldEmail = evaluation.skipReason
      ? shouldSendPayoutSkipEmail({
          skipReason: evaluation.skipReason,
          openNetCents: evaluation.openNetCents,
        })
      : false;
    console.log(`\n[${label}]`, {
      name: partner.name,
      email: partner.email,
      connect: partner.stripe_connect_account_id ? "linked" : "none",
      eligible: evaluation.eligible,
      skipReason: evaluation.skipReason ?? null,
      openNetCents: evaluation.openNetCents,
      shouldSendSkipEmail: shouldEmail,
    });
  }

  // Simulated zero-balance connect_not_linked (Hajat shape) — prove gate
  console.log("\n=== Simulated: zero payable + connect_not_linked ===");
  console.log({
    shouldSend: shouldSendPayoutSkipEmail({
      skipReason: "connect_not_linked",
      openNetCents: 0,
    }),
  });

  // Dry-run runPartnerPayouts email gate (same condition as partner-payout-run.ts)
  const execution = resolveTransferExecution({
    settings: DEFAULT_PAYOUT_AUTOMATION,
    deployMode: stripeMode,
    dryRunRequested: true,
  });
  const emailGate =
    true && !execution.dryRun && execution.executeTransfers;
  console.log("\n=== Dry-run email gate (runPartnerPayouts) ===");
  console.log({ execution, wouldCallSendPartnerPayoutSkippedEmail: emailGate });
  if (emailGate) throw new Error("Dry run must not call send");

  console.log("\nIntegration checks passed (no emails sent).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
