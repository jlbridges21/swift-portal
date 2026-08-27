/**
 * Automated partner payout settings — OFF by default.
 * Live and test transfer enables are separate; test enable never enables live.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripeMode, type StripeMode } from "@/lib/stripe";

export type PartnerPayoutAutomationSettings = {
  automated_payouts_enabled: boolean;
  automated_payouts_dry_run: boolean;
  automated_payouts_live_transfers_enabled: boolean;
  automated_payouts_test_transfers_enabled: boolean;
  automated_payouts_minimum_cents: number;
  automated_payouts_kill_switch: boolean;
};

export const DEFAULT_PAYOUT_AUTOMATION: PartnerPayoutAutomationSettings = {
  automated_payouts_enabled: false,
  automated_payouts_dry_run: true,
  automated_payouts_live_transfers_enabled: false,
  automated_payouts_test_transfers_enabled: false,
  automated_payouts_minimum_cents: 5000,
  automated_payouts_kill_switch: false,
};

const AUTOMATION_SELECT =
  "automated_payouts_enabled, automated_payouts_dry_run, automated_payouts_live_transfers_enabled, automated_payouts_test_transfers_enabled, automated_payouts_minimum_cents, automated_payouts_kill_switch";

export async function loadPartnerPayoutAutomationSettings(): Promise<PartnerPayoutAutomationSettings> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_program_settings")
    .select(AUTOMATION_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...DEFAULT_PAYOUT_AUTOMATION };
  return {
    automated_payouts_enabled: Boolean(data.automated_payouts_enabled),
    automated_payouts_dry_run: data.automated_payouts_dry_run !== false,
    automated_payouts_live_transfers_enabled: Boolean(
      data.automated_payouts_live_transfers_enabled
    ),
    automated_payouts_test_transfers_enabled: Boolean(
      data.automated_payouts_test_transfers_enabled
    ),
    automated_payouts_minimum_cents:
      typeof data.automated_payouts_minimum_cents === "number"
        ? data.automated_payouts_minimum_cents
        : DEFAULT_PAYOUT_AUTOMATION.automated_payouts_minimum_cents,
    automated_payouts_kill_switch: Boolean(data.automated_payouts_kill_switch),
  };
}

export async function updatePartnerPayoutAutomationSettings(
  patch: Partial<PartnerPayoutAutomationSettings>
): Promise<PartnerPayoutAutomationSettings> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_program_settings")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select(AUTOMATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return loadPartnerPayoutAutomationSettingsFromRow(data as Record<string, unknown>);
}

function loadPartnerPayoutAutomationSettingsFromRow(
  data: Record<string, unknown>
): PartnerPayoutAutomationSettings {
  return {
    automated_payouts_enabled: Boolean(data.automated_payouts_enabled),
    automated_payouts_dry_run: data.automated_payouts_dry_run !== false,
    automated_payouts_live_transfers_enabled: Boolean(
      data.automated_payouts_live_transfers_enabled
    ),
    automated_payouts_test_transfers_enabled: Boolean(
      data.automated_payouts_test_transfers_enabled
    ),
    automated_payouts_minimum_cents:
      typeof data.automated_payouts_minimum_cents === "number"
        ? data.automated_payouts_minimum_cents
        : DEFAULT_PAYOUT_AUTOMATION.automated_payouts_minimum_cents,
    automated_payouts_kill_switch: Boolean(data.automated_payouts_kill_switch),
  };
}

/** UTC month key for the current payout period (YYYY-MM). */
export function currentPayoutPeriodKey(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Deterministic idempotency key — one automated payout per partner per period per mode. */
export function automatedPayoutIdempotencyKey(args: {
  partnerId: string;
  periodKey: string;
  stripeMode: StripeMode;
}): string {
  return `auto-payout:${args.partnerId}:${args.periodKey}:${args.stripeMode}`;
}

/** Human-readable label for a period key. */
export function payoutPeriodLabel(periodKey: string): string {
  const [y, m] = periodKey.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Next scheduled monthly run — 1st of next UTC month (matches vercel.json cron). */
export function nextScheduledPayoutRunDate(at = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1, 15, 0, 0));
}

export type TransferExecutionPlan = {
  dryRun: boolean;
  executeTransfers: boolean;
  blockedReason?: string;
};

/**
 * Resolve whether this invocation may create real Stripe transfers.
 * Manual dryRun=true always computes only. Live requires explicit live enable.
 */
export function resolveTransferExecution(args: {
  settings: PartnerPayoutAutomationSettings;
  deployMode: StripeMode;
  dryRunRequested?: boolean;
  executeTransfersRequested?: boolean;
}): TransferExecutionPlan {
  if (args.dryRunRequested === true) {
    return { dryRun: true, executeTransfers: false };
  }
  if (args.executeTransfersRequested === false) {
    return { dryRun: true, executeTransfers: false };
  }
  if (args.settings.automated_payouts_dry_run && args.executeTransfersRequested !== true) {
    return { dryRun: true, executeTransfers: false };
  }
  if (args.deployMode === "live") {
    if (!args.settings.automated_payouts_live_transfers_enabled) {
      return {
        dryRun: true,
        executeTransfers: false,
        blockedReason: "live_transfers_disabled",
      };
    }
  } else if (!args.settings.automated_payouts_test_transfers_enabled) {
    return {
      dryRun: true,
      executeTransfers: false,
      blockedReason: "test_transfers_disabled",
    };
  }
  return { dryRun: false, executeTransfers: true };
}

export function formatCentsForEmail(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
