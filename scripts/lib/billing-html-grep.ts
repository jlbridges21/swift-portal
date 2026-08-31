import type { SupabaseClient } from "@supabase/supabase-js";

const BILLING_UI_MARKERS = [
  "Outstanding Payments",
  "Pay Now",
  "PaymentsSection",
  "QuoteSection",
  "ClientPricingCta",
  "/api/payments/",
  "checkout.stripe.com",
  "stripe_checkout",
];

function formatMoney(amount: number): string[] {
  const out: string[] = [String(amount)];
  if (Number.isInteger(amount) && amount >= 100) {
    out.push((amount / 100).toFixed(2));
    out.push(`$${(amount / 100).toFixed(2)}`);
  }
  if (amount % 1 !== 0) {
    out.push(amount.toFixed(2));
    out.push(`$${amount.toFixed(2)}`);
  }
  return out;
}

/** Returns matched sensitive substrings found in rendered HTML. */
export async function grepBillingLeaksInHtml(
  admin: SupabaseClient,
  projectId: string,
  html: string,
  label: string
): Promise<string[]> {
  const [{ data: payments }, { data: quotes }] = await Promise.all([
    admin.from("payments").select("amount, stripe_checkout_session_id, description").eq("project_id", projectId),
    admin.from("project_quotes").select("total_cents, title, line_items").eq("project_id", projectId),
  ]);

  const needles = new Set<string>(BILLING_UI_MARKERS);
  for (const p of payments ?? []) {
    if (p.amount != null) formatMoney(Number(p.amount)).forEach((s) => needles.add(s));
    if (p.stripe_checkout_session_id) needles.add(String(p.stripe_checkout_session_id));
  }
  for (const q of quotes ?? []) {
    if (q.total_cents != null) formatMoney(Number(q.total_cents)).forEach((s) => needles.add(s));
    const items = q.line_items as { amount_cents?: number }[] | null;
    for (const item of items ?? []) {
      if (item.amount_cents != null) formatMoney(Number(item.amount_cents)).forEach((s) => needles.add(s));
    }
  }

  const hits = [...needles].filter((n) => n.length >= 3 && html.includes(n));
  console.log(`\n--- Billing HTML grep (${label}) ---`);
  if (hits.length === 0) {
    console.log("(clean — no payment/quote/checkout markers found)");
  } else {
    console.log("HITS:", hits);
  }
  return hits;
}

export async function assertNoBillingInHtml(
  admin: SupabaseClient,
  projectId: string,
  html: string,
  label: string
): Promise<void> {
  const hits = await grepBillingLeaksInHtml(admin, projectId, html, label);
  if (hits.length) {
    throw new Error(`${label}: billing data in HTML — ${hits.join(", ")}`);
  }
}

/** Assigned client should still see at least one billing marker when project has payments/quotes. */
export async function assertBillingPresentForClient(
  admin: SupabaseClient,
  projectId: string,
  html: string,
  label: string
): Promise<void> {
  const [{ count: payCount }, { count: quoteCount }] = await Promise.all([
    admin.from("payments").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    admin.from("project_quotes").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);
  if ((payCount ?? 0) === 0 && (quoteCount ?? 0) === 0) {
    console.log(`${label}: no payments/quotes on project — skip billing presence check`);
    return;
  }
  const hasBillingUi =
    html.includes("Pay Now") ||
    html.includes("Outstanding Payments") ||
    html.includes("Quote") ||
    html.includes("Payment");
  console.log(`${label} billing UI present:`, hasBillingUi ? "YES" : "NO");
  if (!hasBillingUi) {
    throw new Error(`${label}: assigned client page missing expected billing UI`);
  }
}
