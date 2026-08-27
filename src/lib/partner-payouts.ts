/**
 * Partner payouts + manual adjustments (phase 5).
 * Automated transfers via partner-payout-run.ts (Phase 2).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe";
import { writePlatformAudit } from "@/lib/platform-audit";
import { computePartnerBalance } from "@/lib/partner-commissions";
import { getPartnerById } from "@/lib/partners";
import type { PartnerAccess } from "@/lib/partner-dashboard";
import {
  PARTNER_ADJUST_DEBIT_CONFIRM,
  PARTNER_PAYOUT_DISCREPANCY_ACK,
} from "@/lib/partner-payout-constants";

export {
  PARTNER_ADJUST_DEBIT_CONFIRM,
  PARTNER_PAYOUT_DISCREPANCY_ACK,
} from "@/lib/partner-payout-constants";

export type PartnerPayoutSource = "manual" | "automated";

export type PartnerPayoutRow = {
  id: string;
  partner_id: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  stripe_mode: string;
  idempotency_key: string | null;
  /** Null when source=automated (Phase 2). */
  created_by: string | null;
  source: PartnerPayoutSource;
  created_at: string;
};

export type PartnerActor = { id: string; email: string | null };

export async function listPartnerPayouts(access: PartnerAccess): Promise<PartnerPayoutRow[]> {
  if (access.kind !== "active") {
    throw new Error("Active partner access required");
  }
  return listPartnerPayoutsAsPlatform(access.partner.id);
}

/** Super-admin / platform only — caller must already be authorized. */
export async function listPartnerPayoutsAsPlatform(partnerId: string): Promise<PartnerPayoutRow[]> {
  const raw = await createServiceClient();
  const mode = getStripeMode();
  const { data, error } = await raw
    .from("partner_payouts")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("stripe_mode", mode)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerPayoutRow[];
}

/**
 * Manual ledger correction. Never edits existing rows.
 * Negative adjustments require confirm === ADJUST_DEBIT.
 */
export async function createPartnerAdjustment(args: {
  partnerId: string;
  amountCents: number;
  note: string;
  confirm?: string;
  actor: PartnerActor;
}): Promise<{ id: string }> {
  const note = args.note.trim();
  if (!note || note.length < 3) throw new Error("A note is required for adjustments.");
  if (!Number.isFinite(args.amountCents) || args.amountCents === 0) {
    throw new Error("Adjustment amount must be a non-zero integer (cents).");
  }
  if (args.amountCents < 0 && args.confirm !== PARTNER_ADJUST_DEBIT_CONFIRM) {
    throw new Error(
      `Negative adjustments require confirm: “${PARTNER_ADJUST_DEBIT_CONFIRM}”.`
    );
  }

  const partner = await getPartnerById(args.partnerId);
  if (!partner) throw new Error("Partner not found.");

  const mode = getStripeMode();
  const raw = await createServiceClient();
  const earnedAt = new Date().toISOString();
  const { data, error } = await raw
    .from("partner_commissions")
    .insert({
      partner_id: args.partnerId,
      business_id: null,
      subscription_payment_id: null,
      kind: "adjustment",
      commission_rate_pct: 0,
      source_amount_cents: Math.abs(Math.trunc(args.amountCents)),
      amount_cents: Math.trunc(args.amountCents),
      currency: "usd",
      stripe_mode: mode,
      payable_at: earnedAt,
      note,
      created_by: args.actor.id,
      earned_at: earnedAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create adjustment.");

  await writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "partner.adjustment",
    targetType: "partner",
    targetId: args.partnerId,
    metadata: {
      adjustmentId: data.id,
      amountCents: args.amountCents,
      note,
    },
  });

  return { id: data.id as string };
}

export type RecordPayoutInput = {
  partnerId: string;
  amountCents: number;
  paidAt?: string;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  /** Client-generated UUID — prevents double-submit. */
  idempotencyKey: string;
  /**
   * When amount ≠ computed openNet, must be PARTNER_PAYOUT_DISCREPANCY_ACK.
   * We insert an adjustment for the difference so the stamped sum matches.
   */
  discrepancyAck?: string;
  actor: PartnerActor;
};

/**
 * Record a full payout of currently-payable balance (V1: no partials).
 * Negative open net → blocked. Amount mismatch → requires ack + bridging adjustment.
 */
export async function recordPartnerPayout(input: RecordPayoutInput): Promise<{
  payoutId: string;
  amountCents: number;
  reusedExisting: boolean;
}> {
  const key = input.idempotencyKey?.trim();
  if (!key || key.length < 8) throw new Error("idempotencyKey is required.");

  const partner = await getPartnerById(input.partnerId);
  if (!partner) throw new Error("Partner not found.");

  const mode = getStripeMode();
  const raw = await createServiceClient();

  const { data: existing } = await raw
    .from("partner_payouts")
    .select("id, amount_cents")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing) {
    return {
      payoutId: existing.id as string,
      amountCents: existing.amount_cents as number,
      reusedExisting: true,
    };
  }

  const balance = await computePartnerBalance(input.partnerId, mode);
  if (balance.openNetCents < 0) {
    throw new Error(
      `Payable balance is negative (${balance.openNetCents}¢). Refunds exceed unpaid earnings — this carries forward against future commissions. A payout cannot be recorded until the balance is positive.`
    );
  }
  if (balance.openNetCents === 0) {
    throw new Error("Nothing payable — no unpaid commissions past the hold period.");
  }

  let amount = Math.trunc(input.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payout amount must be a positive integer (cents).");
  }

  let note = (input.note ?? "").trim();
  const computed = balance.openNetCents;

  if (amount !== computed) {
    if (input.discrepancyAck !== PARTNER_PAYOUT_DISCREPANCY_ACK) {
      throw new Error(
        `Amount ${amount}¢ does not match payable balance ${computed}¢. Acknowledge the discrepancy to continue.`
      );
    }
    const diff = amount - computed;
    const bridgeNote =
      `DISCREPANCY: operator entered ${amount}¢ vs computed payable ${computed}¢ (diff ${diff}¢). ${note}`.trim();
    const earnedAt = new Date().toISOString();
    const { error: adjErr } = await raw.from("partner_commissions").insert({
      partner_id: input.partnerId,
      business_id: null,
      subscription_payment_id: null,
      kind: "adjustment",
      commission_rate_pct: 0,
      source_amount_cents: Math.abs(diff),
      amount_cents: diff,
      currency: balance.currency || "usd",
      stripe_mode: mode,
      payable_at: earnedAt,
      note: bridgeNote,
      created_by: input.actor.id,
      earned_at: earnedAt,
    });
    if (adjErr) throw new Error(adjErr.message);
    note = bridgeNote;
  }

  const after = await computePartnerBalance(input.partnerId, mode);
  if (after.openNetCents !== amount) {
    if (after.openNetCents <= 0) {
      throw new Error("Payable balance is no longer positive after discrepancy adjustment.");
    }
    throw new Error(
      `Payable balance after discrepancy adjustment is ${after.openNetCents}¢, expected ${amount}¢. Refresh and try again.`
    );
  }

  const { data: payoutId, error } = await raw.rpc("record_partner_payout", {
    p_partner_id: input.partnerId,
    p_amount_cents: amount,
    p_currency: balance.currency || "usd",
    p_paid_at: input.paidAt ? new Date(input.paidAt).toISOString() : new Date().toISOString(),
    p_method: input.method ?? null,
    p_reference: input.reference ?? null,
    p_note: note || null,
    p_created_by: input.actor.id,
    p_idempotency_key: key,
    p_stripe_mode: mode,
    p_source: "manual",
  });

  if (error) {
    const msg = error.message || "Payout failed";
    if (/payable_balance_not_positive/i.test(msg)) {
      throw new Error(
        "Payable balance is not positive. Refunds may have reduced the balance below zero."
      );
    }
    if (/amount_mismatch/i.test(msg)) {
      throw new Error("Payable balance changed during save — refresh and try again.");
    }
    throw new Error(msg);
  }

  const id = payoutId as string;

  await writePlatformAudit({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email,
    action: "partner.payout",
    targetType: "partner",
    targetId: input.partnerId,
    metadata: {
      payoutId: id,
      amountCents: amount,
      computedPayableCents: computed,
      method: input.method ?? null,
      reference: input.reference ?? null,
      discrepancy: amount !== computed,
      idempotencyKey: key,
    },
  });

  return { payoutId: id, amountCents: amount, reusedExisting: false };
}

/** Automated cron transfer — no human actor. Idempotent via idempotencyKey. */
export async function recordAutomatedPartnerPayout(input: {
  partnerId: string;
  amountCents: number;
  currency: string;
  reference: string;
  note?: string | null;
  idempotencyKey: string;
  stripeMode: "test" | "live";
}): Promise<{ payoutId: string; amountCents: number; reusedExisting: boolean }> {
  const key = input.idempotencyKey?.trim();
  if (!key || key.length < 8) throw new Error("idempotencyKey is required.");

  const raw = await createServiceClient();

  const { data: existing } = await raw
    .from("partner_payouts")
    .select("id, amount_cents")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing) {
    return {
      payoutId: existing.id as string,
      amountCents: existing.amount_cents as number,
      reusedExisting: true,
    };
  }

  if (process.env.PARTNER_PAYOUT_FORCE_LEDGER_FAIL_PARTNER_ID?.trim() === input.partnerId) {
    throw new Error(
      "Simulated ledger record failure (PARTNER_PAYOUT_FORCE_LEDGER_FAIL_PARTNER_ID)."
    );
  }

  const { data: payoutId, error } = await raw.rpc("record_partner_payout", {
    p_partner_id: input.partnerId,
    p_amount_cents: Math.trunc(input.amountCents),
    p_currency: input.currency,
    p_paid_at: new Date().toISOString(),
    p_method: "stripe_transfer",
    p_reference: input.reference,
    p_note: input.note ?? `Automated payout`,
    p_created_by: null,
    p_idempotency_key: key,
    p_stripe_mode: input.stripeMode,
    p_source: "automated",
  });

  if (error) {
    const msg = error.message || "Automated payout record failed";
    if (/unique|duplicate/i.test(msg)) {
      const { data: dup } = await raw
        .from("partner_payouts")
        .select("id, amount_cents")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (dup) {
        return {
          payoutId: dup.id as string,
          amountCents: dup.amount_cents as number,
          reusedExisting: true,
        };
      }
    }
    throw new Error(msg);
  }

  return {
    payoutId: payoutId as string,
    amountCents: Math.trunc(input.amountCents),
    reusedExisting: false,
  };
}
