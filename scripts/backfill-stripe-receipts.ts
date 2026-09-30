/**
 * One-time, re-runnable backfill of payments.stripe_receipt_url from the Stripe charge.
 * Does not invent a URL when Stripe has none. Skips rows that already have one.
 *
 * Usage: npx tsx scripts/backfill-stripe-receipts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveStripeReceipt } from "../src/lib/stripe-receipt";

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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing supabase env");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error } = await db
    .from("payments")
    .select("id, business_id, status, stripe_payment_intent_id, stripe_account_id, stripe_receipt_url, card_last4")
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
    if (!row.stripe_payment_intent_id) {
      unrepairable.push({ id: row.id, reason: "missing_payment_intent" });
      continue;
    }
    try {
      const receipt = await resolveStripeReceipt({
        paymentIntentId: row.stripe_payment_intent_id,
        stripeAccountId: row.stripe_account_id,
      });
      if (!receipt.receiptUrl) {
        unrepairable.push({ id: row.id, reason: "stripe_has_no_receipt" });
        continue;
      }
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
