/**
 * One-time, re-runnable backfill of payments.stripe_receipt_url from the Stripe charge.
 * Does not invent a URL when Stripe has none. Skips rows that already have one.
 *
 * Usage: npx tsx scripts/backfill-stripe-receipts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type Stripe from "stripe";
import { getStripe } from "../src/lib/stripe";
import { receiptDetailsFromCharge, resolveStripeReceipt, type StripeReceiptDetails } from "../src/lib/stripe-receipt";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

type PaidRow = {
  id: string;
  business_id: string;
  amount: number;
  description: string | null;
  paid_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_link_id: string | null;
  stripe_account_id: string | null;
  stripe_receipt_url: string | null;
  card_last4: string | null;
};

function paymentIntentIdOf(value: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && value.id) return value.id;
  return null;
}

async function receiptFromIntent(
  paymentIntentId: string | null,
  stripeAccountId: string | null
): Promise<StripeReceiptDetails | null> {
  if (!paymentIntentId) return null;
  const receipt = await resolveStripeReceipt({ paymentIntentId, stripeAccountId });
  return receipt.receiptUrl ? receipt : null;
}

/**
 * Look up a Stripe receipt without inventing one.
 * Order: stored PaymentIntent, stored Checkout Session, stored payment link's
 * paid session, then a charge whose metadata names this payment.
 * An amount/date match that is not tied to this payment is reported only.
 */
async function lookupReceipt(row: PaidRow): Promise<{
  receipt: StripeReceiptDetails | null;
  reason: string;
}> {
  const fromIntent = await receiptFromIntent(row.stripe_payment_intent_id, row.stripe_account_id);
  if (fromIntent) return { receipt: fromIntent, reason: "payment_intent" };

  const { stripe, requestOptions } = getStripe({ stripeAccount: row.stripe_account_id });
  const call = <T>(fn: (opts?: Stripe.RequestOptions) => Promise<T>) =>
    requestOptions ? fn(requestOptions) : fn();

  if (row.stripe_checkout_session_id) {
    const session = await call((opts) =>
      opts
        ? stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id!, { expand: ["payment_intent"] }, opts)
        : stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id!, { expand: ["payment_intent"] })
    );
    const found = await receiptFromIntent(paymentIntentIdOf(session.payment_intent), row.stripe_account_id);
    if (found) return { receipt: found, reason: "checkout_session" };
    return { receipt: null, reason: "checkout_session_has_no_receipt" };
  }

  if (row.stripe_payment_link_id) {
    const sessions = await call((opts) =>
      opts
        ? stripe.checkout.sessions.list({ payment_link: row.stripe_payment_link_id!, limit: 20 }, opts)
        : stripe.checkout.sessions.list({ payment_link: row.stripe_payment_link_id!, limit: 20 })
    );
    const paid = sessions.data.filter((session) => session.payment_status === "paid");
    if (paid.length === 1) {
      const found = await receiptFromIntent(paymentIntentIdOf(paid[0].payment_intent), row.stripe_account_id);
      if (found) return { receipt: found, reason: "payment_link_session" };
      return { receipt: null, reason: "payment_link_session_has_no_receipt" };
    }
    if (paid.length > 1) {
      return { receipt: null, reason: `ambiguous_payment_link_sessions:${paid.length}` };
    }
  }

  const when = new Date(row.paid_at || row.created_at);
  const center = Math.floor(when.getTime() / 1000);
  const charges = await call((opts) =>
    opts
      ? stripe.charges.list(
          { created: { gte: center - 7 * 86400, lte: center + 2 * 86400 }, limit: 100 },
          opts
        )
      : stripe.charges.list({ created: { gte: center - 7 * 86400, lte: center + 2 * 86400 }, limit: 100 })
  );
  const sameAmount = charges.data.filter(
    (charge) => charge.amount === row.amount && charge.status === "succeeded" && !charge.refunded
  );
  const tied = sameAmount.filter((charge) => {
    const metaId = charge.metadata?.payment_id || charge.metadata?.paymentId;
    return metaId === row.id || (row.description && charge.description === row.description);
  });
  if (tied.length === 1) {
    const details = receiptDetailsFromCharge(tied[0]);
    if (details.receiptUrl) return { receipt: details, reason: "charge_metadata_or_description" };
    return { receipt: null, reason: "tied_charge_has_no_receipt" };
  }
  if (sameAmount.length === 0) return { receipt: null, reason: "no_charge_for_amount_and_date" };
  if (tied.length === 0) {
    return { receipt: null, reason: `untied_amount_matches:${sameAmount.length}` };
  }
  return { receipt: null, reason: `ambiguous_tied_charges:${tied.length}` };
}

async function main() {
  loadEnv();
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  console.log("stripe_key_prefix", stripeKey.slice(0, 7) || "missing");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing supabase env");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error } = await db
    .from("payments")
    .select("id, business_id, amount, description, paid_at, created_at, status, stripe_payment_intent_id, stripe_checkout_session_id, stripe_payment_link_id, stripe_account_id, stripe_receipt_url, card_last4")
    .eq("status", "paid")
    .is("stripe_receipt_url", null);
  if (error) throw new Error(error.message);

  let repaired = 0;
  let already = 0;
  const unrepairable: { id: string; reason: string }[] = [];

  for (const row of rows ?? []) {
    if (row.stripe_receipt_url) {
      already += 1;
      continue;
    }
    try {
      const lookedUp = await lookupReceipt(row as PaidRow);
      const receipt = lookedUp.receipt;
      if (!receipt?.receiptUrl) {
        unrepairable.push({ id: row.id, reason: lookedUp.reason });
        continue;
      }
      console.log("resolved", row.id, "via", lookedUp.reason, "last4", receipt.cardLast4 ?? "none");
      const { error: updateError } = await db
        .from("payments")
        .update({
          stripe_receipt_url: receipt.receiptUrl,
          card_last4: row.card_last4 ?? receipt.cardLast4,
        })
        .eq("id", row.id)
        .is("stripe_receipt_url", null);
      if (updateError) {
        unrepairable.push({ id: row.id, reason: `update_failed:${updateError.message}` });
        continue;
      }
      repaired += 1;
      console.log("repaired", row.id, "last4", receipt.cardLast4 ?? "none");
    } catch (err) {
      unrepairable.push({
        id: row.id,
        reason: `stripe_error:${err instanceof Error ? err.message.slice(0, 180) : "unknown"}`,
      });
    }
  }

  console.log(JSON.stringify({ scanned: rows?.length ?? 0, repaired, already, unrepairable }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
