/**
 * Reconcile partner commission ledger integrity.
 * Usage: npx tsx scripts/verify-partner-commissions.ts
 * Exit 1 on any discrepancy.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getStripeMode } from "../src/lib/stripe";
import { computePartnerBalance } from "../src/lib/partner-commissions";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(k in process.env)) process.env[k] = v;
}

type Finding = { check: string; detail: string };

function roundCommission(source: number, rate: number): number {
  return Math.round((source * rate) / 100);
}

async function main() {
  const findings: Finding[] = [];
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const mode = getStripeMode();

  const { data: commissions, error } = await raw.from("partner_commissions").select("*");
  if (error) throw new Error(error.message);
  const rows = commissions ?? [];

  const paymentIds = [...new Set(rows.map((r) => r.subscription_payment_id))];
  const { data: payments } = paymentIds.length
    ? await raw
        .from("platform_subscription_payments")
        .select("id, business_id, amount_paid_cents, stripe_mode, stripe_invoice_id")
        .in("id", paymentIds)
    : { data: [] as { id: string; business_id: string; amount_paid_cents: number; stripe_mode: string; stripe_invoice_id: string }[] };
  const paymentMap = new Map((payments ?? []).map((p) => [p.id, p]));

  const { data: referrals } = await raw.from("partner_referrals").select("business_id, partner_id");
  const referralByBusiness = new Map(
    (referrals ?? []).map((r) => [r.business_id as string, r.partner_id as string])
  );

  // every commission traces to exactly one subscription payment
  for (const row of rows) {
    if (row.kind !== "commission") continue;
    const pay = paymentMap.get(row.subscription_payment_id);
    if (!pay) {
      findings.push({
        check: "commission_payment_missing",
        detail: `commission ${row.id} → payment ${row.subscription_payment_id}`,
      });
    }
  }

  // no payment has more than one commission row
  const commissionsByPayment = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== "commission") continue;
    commissionsByPayment.set(
      row.subscription_payment_id,
      (commissionsByPayment.get(row.subscription_payment_id) ?? 0) + 1
    );
  }
  for (const [paymentId, n] of commissionsByPayment) {
    if (n > 1) {
      findings.push({
        check: "duplicate_commission",
        detail: `payment ${paymentId} has ${n} commission rows`,
      });
    }
  }

  // amount equals source × snapshotted rate (within rounding)
  for (const row of rows) {
    if (row.kind !== "commission" && row.kind !== "reversal") continue;
    const expected = roundCommission(row.source_amount_cents, Number(row.commission_rate_pct));
    const actual = Math.abs(row.amount_cents as number);
    // Reversals may be capped below expected when prior partials exist — allow <= expected
    if (row.kind === "commission" && actual !== expected) {
      findings.push({
        check: "amount_rate_mismatch",
        detail: `${row.id}: amount ${actual} != round(${row.source_amount_cents}×${row.commission_rate_pct}/100)=${expected}`,
      });
    }
    if (row.kind === "reversal" && actual > expected) {
      findings.push({
        check: "reversal_exceeds_source_rate",
        detail: `${row.id}: |amount| ${actual} > ${expected}`,
      });
    }
  }

  // reversals never exceed their original
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const reversalSum = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== "reversal" || !row.reverses_commission_id) continue;
    const parent = byId.get(row.reverses_commission_id as string);
    if (!parent) {
      findings.push({
        check: "reversal_orphan",
        detail: `reversal ${row.id} missing parent ${row.reverses_commission_id}`,
      });
      continue;
    }
    reversalSum.set(
      parent.id as string,
      (reversalSum.get(parent.id as string) ?? 0) + Math.abs(row.amount_cents as number)
    );
  }
  for (const [parentId, sum] of reversalSum) {
    const parent = byId.get(parentId)!;
    if (sum > (parent.amount_cents as number)) {
      findings.push({
        check: "reversal_exceeds_original",
        detail: `parent ${parentId}: reversed ${sum} > original ${parent.amount_cents}`,
      });
    }
  }

  // no commission without a referral (at create time — business_id may later be null)
  for (const row of rows) {
    if (row.kind !== "commission") continue;
    if (!row.business_id) continue; // deleted business — skip referral check
    const refPartner = referralByBusiness.get(row.business_id as string);
    if (!refPartner) {
      findings.push({
        check: "commission_without_referral",
        detail: `commission ${row.id} business ${row.business_id}`,
      });
    } else if (refPartner !== row.partner_id) {
      findings.push({
        check: "commission_partner_mismatch_referral",
        detail: `commission ${row.id}: partner ${row.partner_id} vs referral ${refPartner}`,
      });
    }
  }

  // test and live never mix on a row vs its payment
  for (const row of rows) {
    const pay = paymentMap.get(row.subscription_payment_id);
    if (pay && pay.stripe_mode !== row.stripe_mode) {
      findings.push({
        check: "mode_mix_row_payment",
        detail: `row ${row.id} mode=${row.stripe_mode} payment mode=${pay.stripe_mode}`,
      });
    }
  }

  // per-partner balances reconcile to sum of rows
  const partnerIds = [...new Set(rows.map((r) => r.partner_id as string))];
  for (const partnerId of partnerIds) {
    const partnerRows = rows.filter((r) => r.partner_id === partnerId && r.stripe_mode === mode);
    const sumNet = partnerRows.reduce((s, r) => s + (r.amount_cents as number), 0);
    const bal = await computePartnerBalance(partnerId, mode);
    if (bal.netCents !== sumNet) {
      findings.push({
        check: "balance_net_mismatch",
        detail: `partner ${partnerId}: balance.net=${bal.netCents} sum=${sumNet}`,
      });
    }
  }

  console.log(`verify-partner-commissions: scanned ${rows.length} ledger rows (deploy mode=${mode})`);
  if (findings.length) {
    console.error("DISCREPANCIES:");
    for (const f of findings) {
      console.error(`  [${f.check}] ${f.detail}`);
    }
    process.exit(1);
  }
  console.log("ok — every commission traces to one payment");
  console.log("ok — no duplicate commission per payment");
  console.log("ok — amounts match snapshotted rate (reversals ≤ expected)");
  console.log("ok — reversals never exceed originals");
  console.log("ok — commissions have matching referrals");
  console.log("ok — test/live modes do not mix");
  console.log("ok — partner balances reconcile to ledger sums");
  console.log("\nPartner commission ledger reconciliation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
