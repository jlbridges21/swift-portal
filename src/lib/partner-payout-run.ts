/**
 * Automated partner payout run — FLOW C Stripe transfers + ledger stamp.
 *
 * OFF by default. Dry-run computes only. Idempotent per partner per period.
 * Never partially records a payout that did not happen.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode, type StripeMode } from "@/lib/stripe";
import { computePartnerBalance } from "@/lib/partner-commissions";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  automatedPayoutIdempotencyKey,
  currentPayoutPeriodKey,
  loadPartnerPayoutAutomationSettings,
  resolveTransferExecution,
  type PartnerPayoutAutomationSettings,
  type TransferExecutionPlan,
} from "@/lib/partner-payout-automation";
import {
  sendPartnerPayoutSentEmail,
  sendPartnerPayoutSkippedEmail,
} from "@/lib/partner-payout-email";
import { loadPartnerConnectByPartnerId } from "@/lib/partner-stripe-connect";
import { recordAutomatedPartnerPayout } from "@/lib/partner-payouts";

export type PayoutSkipReason =
  | "partner_not_active"
  | "connect_not_linked"
  | "connect_payouts_disabled"
  | "connect_requirements_due"
  | "connect_not_ready"
  | "mode_mismatch"
  | "below_minimum_threshold"
  | "negative_balance"
  | "zero_payable"
  | "already_paid_this_period"
  | "insufficient_platform_balance"
  | "kill_switch";

export type PartnerPayoutEvaluation = {
  partnerId: string;
  partnerEmail: string | null;
  partnerName: string;
  brandName: string | null;
  eligible: boolean;
  skipReason?: PayoutSkipReason;
  amountCents: number;
  openNetCents: number;
  payableCents: number;
  currency: string;
  stripeConnectAccountId: string | null;
  idempotencyKey: string;
  details: Record<string, unknown>;
};

export type PartnerPayoutRunItemOutcome =
  | "paid"
  | "skipped"
  | "failed"
  | "dry_run_would_pay";

export type PartnerPayoutRunItemResult = {
  partnerId: string;
  partnerEmail: string | null;
  partnerName: string;
  outcome: PartnerPayoutRunItemOutcome;
  skipReason?: string;
  amountCents?: number;
  stripeTransferId?: string;
  payoutId?: string;
  idempotencyKey?: string;
  error?: string;
  details: Record<string, unknown>;
};

export type PartnerPayoutRunResult = {
  runId: string | null;
  periodKey: string;
  stripeMode: StripeMode;
  triggeredBy: "cron" | "manual";
  dryRun: boolean;
  executeTransfers: boolean;
  blockedReason?: string;
  automationDisabled?: boolean;
  killSwitchTriggered?: boolean;
  status: "completed" | "aborted" | "failed" | "skipped";
  platformBalanceAvailableCents: number | null;
  totalEvaluated: number;
  totalPaid: number;
  totalSkipped: number;
  totalFailed: number;
  totalAmountCents: number;
  insufficientPlatformBalance?: boolean;
  errorSummary?: string;
  partners: PartnerPayoutRunItemResult[];
};

type PartnerRow = {
  id: string;
  email: string;
  name: string;
  brand_name: string | null;
  status: string;
  stripe_connect_account_id: string | null;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_requirements_due: boolean;
  stripe_connect_requirements_summary: string | null;
  stripe_connect_mode: string | null;
  stripe_connect_account_status: string | null;
};

export async function listActivePartnersForPayoutRun(): Promise<PartnerRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partners")
    .select(
      "id, email, name, brand_name, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_account_status"
    )
    .eq("status", "active")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerRow[];
}

export async function evaluatePartnerForPayout(args: {
  partner: PartnerRow;
  periodKey: string;
  stripeMode: StripeMode;
  minimumCents: number;
}): Promise<PartnerPayoutEvaluation> {
  const { partner, periodKey, stripeMode, minimumCents } = args;
  const idempotencyKey = automatedPayoutIdempotencyKey({
    partnerId: partner.id,
    periodKey,
    stripeMode,
  });
  const base = {
    partnerId: partner.id,
    partnerEmail: partner.email,
    partnerName: partner.name,
    brandName: partner.brand_name,
    amountCents: 0,
    openNetCents: 0,
    payableCents: 0,
    currency: "usd",
    stripeConnectAccountId: partner.stripe_connect_account_id,
    idempotencyKey,
    details: {} as Record<string, unknown>,
  };

  if (partner.status !== "active") {
    return { ...base, eligible: false, skipReason: "partner_not_active" };
  }

  if (!partner.stripe_connect_account_id) {
    return { ...base, eligible: false, skipReason: "connect_not_linked" };
  }

  if (partner.stripe_connect_mode && partner.stripe_connect_mode !== stripeMode) {
    return {
      ...base,
      eligible: false,
      skipReason: "mode_mismatch",
      details: {
        connectMode: partner.stripe_connect_mode,
        deployMode: stripeMode,
      },
    };
  }

  if (!partner.stripe_connect_payouts_enabled) {
    return { ...base, eligible: false, skipReason: "connect_payouts_disabled" };
  }

  if (partner.stripe_connect_requirements_due) {
    return {
      ...base,
      eligible: false,
      skipReason: "connect_requirements_due",
      details: {
        requirementsSummary: partner.stripe_connect_requirements_summary,
      },
    };
  }

  if (partner.stripe_connect_account_status !== "ready") {
    return {
      ...base,
      eligible: false,
      skipReason: "connect_not_ready",
      details: { status: partner.stripe_connect_account_status },
    };
  }

  const balance = await computePartnerBalance(partner.id, stripeMode);
  base.openNetCents = balance.openNetCents;
  base.payableCents = balance.payableCents;
  base.currency = balance.currency;

  if (balance.openNetCents < 0) {
    return {
      ...base,
      eligible: false,
      skipReason: "negative_balance",
      details: { openNetCents: balance.openNetCents },
    };
  }

  if (balance.openNetCents === 0) {
    return { ...base, eligible: false, skipReason: "zero_payable" };
  }

  if (balance.openNetCents < minimumCents) {
    return {
      ...base,
      eligible: false,
      skipReason: "below_minimum_threshold",
      details: {
        openNetCents: balance.openNetCents,
        minimumCents,
      },
    };
  }

  // Check existing payout for this period (idempotency)
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("partner_payouts")
    .select("id, amount_cents, reference")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      ...base,
      eligible: false,
      skipReason: "already_paid_this_period",
      amountCents: existing.amount_cents as number,
      details: {
        existingPayoutId: existing.id,
        existingReference: existing.reference,
      },
    };
  }

  return {
    ...base,
    eligible: true,
    amountCents: balance.openNetCents,
    details: { openNetCents: balance.openNetCents },
  };
}

async function fetchPlatformAvailableBalanceCents(): Promise<number> {
  const simulated = process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS?.trim();
  if (simulated != null && simulated !== "") {
    const n = Number(simulated);
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }

  const { stripe } = getStripe();
  const balance = await stripe.balance.retrieve();
  const usd = balance.available.find((b) => b.currency === "usd");
  return usd?.amount ?? 0;
}

async function createPartnerStripeTransfer(args: {
  amountCents: number;
  currency: string;
  destination: string;
  partnerId: string;
  periodKey: string;
  stripeMode: StripeMode;
  idempotencyKey: string;
}): Promise<Stripe.Transfer> {
  const failPartner = process.env.PARTNER_PAYOUT_FORCE_TRANSFER_FAIL_PARTNER_ID?.trim();
  if (failPartner && failPartner === args.partnerId) {
    throw new Error("Simulated transfer failure (PARTNER_PAYOUT_FORCE_TRANSFER_FAIL_PARTNER_ID).");
  }

  const { stripe } = getStripe();
  return stripe.transfers.create(
    {
      amount: args.amountCents,
      currency: args.currency,
      destination: args.destination,
      description: `ShootPortal partner commission payout ${args.periodKey}`,
      metadata: {
        shootportal_flow: "partner_payouts",
        shootportal_partner_id: args.partnerId,
        shootportal_period: args.periodKey,
        shootportal_stripe_mode: args.stripeMode,
      },
    },
    { idempotencyKey: args.idempotencyKey }
  );
}

async function isKillSwitchActive(): Promise<boolean> {
  const settings = await loadPartnerPayoutAutomationSettings();
  return settings.automated_payouts_kill_switch;
}

async function insertRunHeader(args: {
  periodKey: string;
  stripeMode: StripeMode;
  triggeredBy: "cron" | "manual";
  triggeredByUserId?: string | null;
  dryRun: boolean;
  executeTransfers: boolean;
  platformBalanceAvailableCents: number | null;
}): Promise<string> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_payout_runs")
    .insert({
      period_key: args.periodKey,
      stripe_mode: args.stripeMode,
      triggered_by: args.triggeredBy,
      triggered_by_user_id: args.triggeredByUserId ?? null,
      dry_run: args.dryRun,
      execute_transfers: args.executeTransfers,
      status: "running",
      platform_balance_available_cents: args.platformBalanceAvailableCents,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create payout run audit row.");
  return data.id as string;
}

async function insertRunItem(args: {
  runId: string;
  result: PartnerPayoutRunItemResult;
}): Promise<void> {
  const raw = await createServiceClient();
  await raw.from("partner_payout_run_items").insert({
    run_id: args.runId,
    partner_id: args.result.partnerId,
    outcome: args.result.outcome,
    skip_reason: args.result.skipReason ?? null,
    amount_cents: args.result.amountCents ?? null,
    stripe_transfer_id: args.result.stripeTransferId ?? null,
    payout_id: args.result.payoutId ?? null,
    idempotency_key: args.result.idempotencyKey ?? null,
    partner_email: args.result.partnerEmail,
    details: args.result.details,
  });
}

async function finalizeRun(args: {
  runId: string;
  status: "completed" | "aborted" | "failed";
  killSwitchTriggered?: boolean;
  totals: {
    totalEvaluated: number;
    totalPaid: number;
    totalSkipped: number;
    totalFailed: number;
    totalAmountCents: number;
  };
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const raw = await createServiceClient();
  await raw
    .from("partner_payout_runs")
    .update({
      status: args.status,
      kill_switch_triggered: Boolean(args.killSwitchTriggered),
      total_evaluated: args.totals.totalEvaluated,
      total_paid: args.totals.totalPaid,
      total_skipped: args.totals.totalSkipped,
      total_failed: args.totals.totalFailed,
      total_amount_cents: args.totals.totalAmountCents,
      error_summary: args.errorSummary ?? null,
      finished_at: new Date().toISOString(),
      metadata: args.metadata ?? {},
    })
    .eq("id", args.runId);
}

export async function previewPartnerPayoutRun(options?: {
  partnerIds?: string[];
  periodKey?: string;
}): Promise<{
  periodKey: string;
  stripeMode: StripeMode;
  minimumCents: number;
  partners: PartnerPayoutEvaluation[];
}> {
  const stripeMode = getStripeMode();
  const settings = await loadPartnerPayoutAutomationSettings();
  const periodKey = options?.periodKey ?? currentPayoutPeriodKey();
  const partners = options?.partnerIds?.length
    ? (await listActivePartnersForPayoutRun()).filter((p) =>
        options.partnerIds!.includes(p.id)
      )
    : await listActivePartnersForPayoutRun();

  const evaluations: PartnerPayoutEvaluation[] = [];
  for (const partner of partners) {
    evaluations.push(
      await evaluatePartnerForPayout({
        partner,
        periodKey,
        stripeMode,
        minimumCents: settings.automated_payouts_minimum_cents,
      })
    );
  }
  return {
    periodKey,
    stripeMode,
    minimumCents: settings.automated_payouts_minimum_cents,
    partners: evaluations,
  };
}

export async function runPartnerPayouts(args: {
  triggeredBy: "cron" | "manual";
  triggeredByUserId?: string | null;
  triggeredByEmail?: string | null;
  dryRunRequested?: boolean;
  executeTransfersRequested?: boolean;
  partnerIds?: string[];
  periodKey?: string;
  skipAutomationGate?: boolean;
  sendEmails?: boolean;
}): Promise<PartnerPayoutRunResult> {
  const stripeMode = getStripeMode();
  const settings = await loadPartnerPayoutAutomationSettings();
  const periodKey = args.periodKey ?? currentPayoutPeriodKey();

  if (args.triggeredBy === "cron" && !settings.automated_payouts_enabled && !args.skipAutomationGate) {
    return {
      runId: null,
      periodKey,
      stripeMode,
      triggeredBy: args.triggeredBy,
      dryRun: true,
      executeTransfers: false,
      automationDisabled: true,
      status: "skipped",
      platformBalanceAvailableCents: null,
      totalEvaluated: 0,
      totalPaid: 0,
      totalSkipped: 0,
      totalFailed: 0,
      totalAmountCents: 0,
      partners: [],
    };
  }

  const execution = resolveTransferExecution({
    settings,
    deployMode: stripeMode,
    dryRunRequested: args.dryRunRequested,
    executeTransfersRequested: args.executeTransfersRequested,
  });

  let platformBalanceAvailableCents: number | null = null;
  if (execution.executeTransfers) {
    platformBalanceAvailableCents = await fetchPlatformAvailableBalanceCents();
  }

  const runId = await insertRunHeader({
    periodKey,
    stripeMode,
    triggeredBy: args.triggeredBy,
    triggeredByUserId: args.triggeredByUserId,
    dryRun: execution.dryRun,
    executeTransfers: execution.executeTransfers,
    platformBalanceAvailableCents,
  });

  const partners = args.partnerIds?.length
    ? (await listActivePartnersForPayoutRun()).filter((p) => args.partnerIds!.includes(p.id))
    : await listActivePartnersForPayoutRun();

  const results: PartnerPayoutRunItemResult[] = [];
  let remainingPlatformCents = platformBalanceAvailableCents ?? 0;
  let killSwitchTriggered = false;
  let insufficientPlatformBalance = false;
  let totalPaid = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalAmountCents = 0;

  try {
    for (const partner of partners) {
      if (await isKillSwitchActive()) {
        killSwitchTriggered = true;
        break;
      }

      const evaluation = await evaluatePartnerForPayout({
        partner,
        periodKey,
        stripeMode,
        minimumCents: settings.automated_payouts_minimum_cents,
      });

      const itemBase: PartnerPayoutRunItemResult = {
        partnerId: partner.id,
        partnerEmail: partner.email,
        partnerName: partner.name,
        outcome: "skipped",
        details: evaluation.details,
        idempotencyKey: evaluation.idempotencyKey,
      };

      if (!evaluation.eligible) {
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "skipped",
          skipReason: evaluation.skipReason,
          amountCents: evaluation.amountCents || undefined,
        };
        results.push(result);
        await insertRunItem({ runId, result });
        totalSkipped += 1;

        if (args.sendEmails !== false && evaluation.skipReason) {
          await sendPartnerPayoutSkippedEmail({
            partnerId: partner.id,
            email: partner.email,
            partnerName: partner.name,
            periodKey,
            skipReason: evaluation.skipReason,
            details: evaluation.details,
          }).catch((err) =>
            console.error("[partner-payout-run] skip email failed", {
              partnerId: partner.id,
              err,
            })
          );
        }
        continue;
      }

      if (execution.dryRun || !execution.executeTransfers) {
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "dry_run_would_pay",
          amountCents: evaluation.amountCents,
          details: {
            ...evaluation.details,
            reason: execution.blockedReason ?? "dry_run",
          },
        };
        results.push(result);
        await insertRunItem({ runId, result });
        continue;
      }

      // Real transfer path — check platform balance first
      if (remainingPlatformCents < evaluation.amountCents) {
        insufficientPlatformBalance = true;
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "skipped",
          skipReason: "insufficient_platform_balance",
          amountCents: evaluation.amountCents,
          details: {
            ...evaluation.details,
            requiredCents: evaluation.amountCents,
            remainingPlatformCents,
          },
        };
        results.push(result);
        await insertRunItem({ runId, result });
        totalSkipped += 1;
        continue;
      }

      // Verify Connect snapshot still valid before transfer
      const connect = await loadPartnerConnectByPartnerId(partner.id);
      if (
        !connect?.stripeConnectAccountId ||
        !connect.payoutsEnabled ||
        connect.requirementsDue ||
        connect.stripeMode !== stripeMode
      ) {
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "skipped",
          skipReason: connect?.requirementsDue
            ? "connect_requirements_due"
            : "connect_not_ready",
          amountCents: evaluation.amountCents,
          details: { connectStatus: connect?.status },
        };
        results.push(result);
        await insertRunItem({ runId, result });
        totalSkipped += 1;
        continue;
      }

      let transfer: Stripe.Transfer;
      try {
        transfer = await createPartnerStripeTransfer({
          amountCents: evaluation.amountCents,
          currency: evaluation.currency,
          destination: connect.stripeConnectAccountId,
          partnerId: partner.id,
          periodKey,
          stripeMode,
          idempotencyKey: evaluation.idempotencyKey,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "failed",
          amountCents: evaluation.amountCents,
          error: message,
          details: evaluation.details,
        };
        results.push(result);
        await insertRunItem({ runId, result });
        totalFailed += 1;
        continue;
      }

      // Transfer succeeded — record payout + stamp ledger atomically via RPC
      try {
        const recorded = await recordAutomatedPartnerPayout({
          partnerId: partner.id,
          amountCents: evaluation.amountCents,
          currency: evaluation.currency,
          reference: transfer.id,
          note: `Automated payout ${periodKey}`,
          idempotencyKey: evaluation.idempotencyKey,
          stripeMode,
        });

        remainingPlatformCents -= evaluation.amountCents;
        totalPaid += 1;
        totalAmountCents += evaluation.amountCents;

        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "paid",
          amountCents: evaluation.amountCents,
          stripeTransferId: transfer.id,
          payoutId: recorded.payoutId,
          details: {
            ...evaluation.details,
            reusedExisting: recorded.reusedExisting,
            transferObject: {
              id: transfer.id,
              amount: transfer.amount,
              currency: transfer.currency,
              destination: transfer.destination,
              created: transfer.created,
            },
          },
        };
        results.push(result);
        await insertRunItem({ runId, result });

        if (args.sendEmails !== false && !recorded.reusedExisting) {
          await sendPartnerPayoutSentEmail({
            partnerId: partner.id,
            email: partner.email,
            partnerName: partner.name,
            amountCents: evaluation.amountCents,
            periodKey,
            payoutId: recorded.payoutId,
          }).catch((err) =>
            console.error("[partner-payout-run] sent email failed", {
              partnerId: partner.id,
              err,
            })
          );
        }
      } catch (err) {
        // Transfer succeeded but ledger record failed — critical; log loudly
        const message = err instanceof Error ? err.message : String(err);
        console.error("[partner-payout-run] CRITICAL: transfer succeeded but payout record failed", {
          partnerId: partner.id,
          transferId: transfer.id,
          error: message,
        });
        const result: PartnerPayoutRunItemResult = {
          ...itemBase,
          outcome: "failed",
          amountCents: evaluation.amountCents,
          stripeTransferId: transfer.id,
          error: `transfer_ok_ledger_failed: ${message}`,
          details: evaluation.details,
        };
        results.push(result);
        await insertRunItem({ runId, result });
        totalFailed += 1;
      }
    }

    const runStatus = killSwitchTriggered ? "aborted" : "completed";
    await finalizeRun({
      runId,
      status: runStatus,
      killSwitchTriggered,
      totals: {
        totalEvaluated: results.length,
        totalPaid,
        totalSkipped,
        totalFailed,
        totalAmountCents,
      },
      errorSummary: insufficientPlatformBalance
        ? "Insufficient platform balance — some partners skipped; balances remain payable."
        : undefined,
      metadata: {
        blockedReason: execution.blockedReason,
        insufficientPlatformBalance,
      },
    });

    await writePlatformAudit({
      actorUserId: args.triggeredByUserId ?? null,
      actorEmail: args.triggeredByEmail ?? null,
      action: "partner.payout_run",
      targetType: "partner_payout_run",
      targetId: runId,
      metadata: {
        periodKey,
        stripeMode,
        triggeredBy: args.triggeredBy,
        dryRun: execution.dryRun,
        executeTransfers: execution.executeTransfers,
        totalPaid,
        totalSkipped,
        totalFailed,
        totalAmountCents,
        killSwitchTriggered,
        insufficientPlatformBalance,
        automationDisabled: false,
      },
    });

    if (insufficientPlatformBalance) {
      await writePlatformAudit({
        actorUserId: args.triggeredByUserId ?? null,
        actorEmail: args.triggeredByEmail ?? null,
        action: "partner.payout_run.insufficient_balance",
        targetType: "partner_payout_run",
        targetId: runId,
        metadata: {
          periodKey,
          remainingPlatformCents,
          skippedPartners: results
            .filter((r) => r.skipReason === "insufficient_platform_balance")
            .map((r) => r.partnerId),
        },
      });
    }

    return {
      runId,
      periodKey,
      stripeMode,
      triggeredBy: args.triggeredBy,
      dryRun: execution.dryRun,
      executeTransfers: execution.executeTransfers,
      blockedReason: execution.blockedReason,
      killSwitchTriggered,
      status: runStatus,
      platformBalanceAvailableCents,
      totalEvaluated: results.length,
      totalPaid,
      totalSkipped,
      totalFailed,
      totalAmountCents,
      insufficientPlatformBalance,
      partners: results,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizeRun({
      runId,
      status: "failed",
      totals: {
        totalEvaluated: results.length,
        totalPaid,
        totalSkipped,
        totalFailed,
        totalAmountCents,
      },
      errorSummary: message,
    }).catch(() => undefined);

    return {
      runId,
      periodKey,
      stripeMode,
      triggeredBy: args.triggeredBy,
      dryRun: execution.dryRun,
      executeTransfers: execution.executeTransfers,
      status: "failed",
      platformBalanceAvailableCents,
      totalEvaluated: results.length,
      totalPaid,
      totalSkipped,
      totalFailed,
      totalAmountCents,
      errorSummary: message,
      partners: results,
    };
  }
}

export async function listPartnerPayoutRuns(limit = 20): Promise<
  Array<{
    id: string;
    period_key: string;
    stripe_mode: string;
    triggered_by: string;
    dry_run: boolean;
    execute_transfers: boolean;
    status: string;
    total_paid: number;
    total_skipped: number;
    total_failed: number;
    total_amount_cents: number;
    started_at: string;
    finished_at: string | null;
    error_summary: string | null;
  }>
> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_payout_runs")
    .select(
      "id, period_key, stripe_mode, triggered_by, dry_run, execute_transfers, status, total_paid, total_skipped, total_failed, total_amount_cents, started_at, finished_at, error_summary"
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPartnerPayoutRunWithItems(runId: string): Promise<{
  run: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
} | null> {
  const raw = await createServiceClient();
  const { data: run } = await raw.from("partner_payout_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return null;
  const { data: items } = await raw
    .from("partner_payout_run_items")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  return { run: run as Record<string, unknown>, items: (items ?? []) as Array<Record<string, unknown>> };
}

export type PartnerNextPayoutInfo = {
  nextRunDate: string;
  periodKey: string;
  estimatedAmountCents: number;
  eligible: boolean;
  skipReason?: string;
  minimumCents: number;
  /** Master automation toggle — when false, UI must not promise a live monthly run. */
  automationEnabled: boolean;
};

export async function loadPartnerNextPayoutInfo(partnerId: string): Promise<PartnerNextPayoutInfo> {
  const { nextScheduledPayoutRunDate, currentPayoutPeriodKey, loadPartnerPayoutAutomationSettings } =
    await import("@/lib/partner-payout-automation");
  const settings = await loadPartnerPayoutAutomationSettings();
  const stripeMode = getStripeMode();
  const periodKey = currentPayoutPeriodKey();
  const automationEnabled = settings.automated_payouts_enabled;
  const raw = await createServiceClient();
  const { data: partner } = await raw
    .from("partners")
    .select(
      "id, email, name, brand_name, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_account_status"
    )
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) {
    return {
      nextRunDate: nextScheduledPayoutRunDate().toISOString(),
      periodKey,
      estimatedAmountCents: 0,
      eligible: false,
      skipReason: "partner_not_found",
      minimumCents: settings.automated_payouts_minimum_cents,
      automationEnabled,
    };
  }

  const evaluation = await evaluatePartnerForPayout({
    partner: partner as PartnerRow,
    periodKey,
    stripeMode,
    minimumCents: settings.automated_payouts_minimum_cents,
  });

  return {
    nextRunDate: nextScheduledPayoutRunDate().toISOString(),
    periodKey,
    estimatedAmountCents: evaluation.eligible ? evaluation.amountCents : evaluation.openNetCents,
    eligible: evaluation.eligible,
    skipReason: evaluation.skipReason,
    minimumCents: settings.automated_payouts_minimum_cents,
    automationEnabled,
  };
}
