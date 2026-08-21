import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/subscription";

function detectStripeMode(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_") ? "live" : "test";
}

/**
 * Persist a paid ShootPortal SaaS invoice locally so /platform revenue does not
 * depend on a live Stripe list call. Idempotent on stripe_invoice_id.
 * Comped businesses are skipped (they pay nothing).
 */
export async function recordPlatformSubscriptionPayment(
  invoice: Stripe.Invoice,
  businessId: string
): Promise<{ recorded: boolean; reason?: string }> {
  if (invoice.status !== "paid") {
    return { recorded: false, reason: "invoice_not_paid" };
  }
  const amount = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;
  if (amount <= 0) {
    return { recorded: false, reason: "zero_amount" };
  }
  if (!invoice.id) {
    return { recorded: false, reason: "missing_invoice_id" };
  }

  const raw = await createServiceClient();
  const { data: biz } = await raw
    .from("businesses")
    .select(
      "subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (biz) {
    const sub = getSubscriptionState(biz);
    if (sub.isComped) {
      return { recorded: false, reason: "business_comped" };
    }
  }

  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
    : new Date().toISOString();

  const { invoiceSubscriptionId } = await import("@/lib/stripe-billing");
  const subId = invoiceSubscriptionId(invoice);

  const { error } = await raw.from("platform_subscription_payments").upsert(
    {
      business_id: businessId,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subId,
      amount_paid_cents: amount,
      currency: (invoice.currency || "usd").toLowerCase(),
      paid_at: paidAt,
      stripe_mode: detectStripeMode(),
    },
    { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[platform-revenue] failed to record invoice", {
      invoiceId: invoice.id,
      businessId,
      error: error.message,
    });
    return { recorded: false, reason: error.message };
  }
  return { recorded: true };
}

/**
 * Lifetime ShootPortal SaaS revenue from local ledger.
 * Excludes currently-comped businesses (they should not appear, but filter anyway).
 */
export async function sumShootPortalSubscriptionRevenueCents(): Promise<number> {
  const raw = await createServiceClient();
  const { data: rows, error } = await raw
    .from("platform_subscription_payments")
    .select("amount_paid_cents, business_id");
  if (error) {
    console.error("[platform-revenue] sum failed", error.message);
    return 0;
  }
  if (!rows?.length) return 0;

  const businessIds = [...new Set(rows.map((r) => r.business_id))];
  const { data: businesses } = await raw
    .from("businesses")
    .select(
      "id, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end"
    )
    .in("id", businessIds);

  const compedIds = new Set(
    (businesses ?? [])
      .filter((b) => getSubscriptionState(b).isComped)
      .map((b) => b.id)
  );

  return rows.reduce((sum, row) => {
    if (compedIds.has(row.business_id)) return sum;
    return sum + (typeof row.amount_paid_cents === "number" ? row.amount_paid_cents : 0);
  }, 0);
}
