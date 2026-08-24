import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/subscription";
import { getStripeMode } from "@/lib/stripe";

/**
 * Persist a paid ShootPortal SaaS invoice locally so /platform revenue does not
 * depend on a live Stripe list call. Idempotent on stripe_invoice_id.
 *
 * Insert detection: upsert with ignoreDuplicates + .select('id'). On conflict the
 * row is not returned — recorded=false. Commission creation only runs when a NEW
 * payment id is returned. The DB unique on partner_commissions(subscription_payment_id)
 * WHERE kind='commission' is the hard guarantee if this ever races.
 *
 * Comped businesses are skipped (they pay nothing → no payment → no commission).
 */
export async function recordPlatformSubscriptionPayment(
  invoice: Stripe.Invoice,
  businessId: string,
  options?: { stripeEventId?: string | null }
): Promise<{ recorded: boolean; reason?: string; paymentId?: string }> {
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

  // Comped → no revenue collected → no payment row → no commission.
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
  const stripeMode = getStripeMode();

  const { data: inserted, error } = await raw
    .from("platform_subscription_payments")
    .upsert(
      {
        business_id: businessId,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: subId,
        amount_paid_cents: amount,
        currency: (invoice.currency || "usd").toLowerCase(),
        paid_at: paidAt,
        stripe_mode: stripeMode,
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[platform-revenue] failed to record invoice", {
      invoiceId: invoice.id,
      businessId,
      error: error.message,
    });
    return { recorded: false, reason: error.message };
  }

  // ignoreDuplicates: conflicting rows are not returned → treat as already recorded.
  if (!inserted?.id) {
    return { recorded: false, reason: "duplicate_invoice" };
  }

  const paymentId = inserted.id as string;

  // Commission must never break payment recording or the webhook.
  try {
    const { maybeCreateCommissionForPayment } = await import("@/lib/partner-commissions");
    const commission = await maybeCreateCommissionForPayment({
      paymentId,
      businessId,
      amountPaidCents: amount,
      currency: (invoice.currency || "usd").toLowerCase(),
      stripeMode,
      paidAt,
      stripeEventId: options?.stripeEventId ?? null,
    });
    if (commission.created) {
      console.info("[platform-revenue] partner commission created", {
        paymentId,
        businessId,
        commissionId: commission.commissionId,
      });
    } else {
      console.info("[platform-revenue] partner commission skipped", {
        paymentId,
        businessId,
        reason: commission.reason,
      });
    }
  } catch (err) {
    console.error("[platform-revenue] partner commission FAILED (payment kept)", {
      paymentId,
      businessId,
      invoiceId: invoice.id,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { recorded: true, paymentId };
}

/**
 * Lifetime ShootPortal SaaS revenue from local ledger.
 * Excludes currently-comped businesses (they should not appear, but filter anyway).
 */
export async function sumShootPortalSubscriptionRevenueCents(
  filters?: PlatformRevenueFilters
): Promise<number> {
  const rows = await listShootPortalSubscriptionPayments(filters);
  return rows.reduce((sum, row) => sum + row.amountPaidCents, 0);
}

export type PlatformRevenueFilters = {
  businessId?: string | null;
  from?: string | null;
  to?: string | null;
};

export type SubscriptionPaymentRow = {
  id: string;
  businessId: string;
  businessName: string;
  plan: string;
  /** Invoice amount Stripe actually charged (not the current catalog list price). */
  amountPaidCents: number;
  /** Current catalog monthly list price for the business's plan, if available. */
  catalogMonthlyCents: number | null;
  currency: string;
  paidAt: string;
  stripeInvoiceId: string;
  stripeSubscriptionId: string | null;
  stripeMode: string;
};

function parseDayBound(value: string | null | undefined, endOfDay: boolean): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setUTCHours(23, 59, 59, 999);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

async function loadCompedBusinessIds(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  businessIds: string[]
): Promise<Set<string>> {
  if (!businessIds.length) return new Set();
  const { data: businesses } = await raw
    .from("businesses")
    .select(
      "id, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end"
    )
    .in("id", businessIds);
  return new Set(
    (businesses ?? [])
      .filter((b) => getSubscriptionState(b).isComped)
      .map((b) => b.id)
  );
}

/** Cross-tenant SaaS subscription payments for platform console (super_admin only). */
export async function listShootPortalSubscriptionPayments(
  filters?: PlatformRevenueFilters
): Promise<SubscriptionPaymentRow[]> {
  const raw = await createServiceClient();
  let query = raw
    .from("platform_subscription_payments")
    .select(
      "id, business_id, amount_paid_cents, currency, paid_at, stripe_invoice_id, stripe_subscription_id, stripe_mode"
    )
    .order("paid_at", { ascending: false });

  if (filters?.businessId) {
    query = query.eq("business_id", filters.businessId);
  }
  const fromIso = parseDayBound(filters?.from, false);
  const toIso = parseDayBound(filters?.to, true);
  if (fromIso) query = query.gte("paid_at", fromIso);
  if (toIso) query = query.lte("paid_at", toIso);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[platform-revenue] list subscription payments failed", error.message);
    throw new Error(error.message);
  }
  if (!rows?.length) return [];

  const businessIds = [...new Set(rows.map((r) => r.business_id))];
  const compedIds = await loadCompedBusinessIds(raw, businessIds);
  const { data: businesses } = await raw
    .from("businesses")
    .select("id, name, plan")
    .in("id", businessIds);
  const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));

  const planKeys = [...new Set((businesses ?? []).map((b) => b.plan).filter(Boolean))] as string[];
  const { data: planRows } = planKeys.length
    ? await raw.from("plans").select("key, price_monthly_cents, price_annual_cents").in("key", planKeys)
    : { data: [] as { key: string; price_monthly_cents: number | null; price_annual_cents: number | null }[] };
  const planCatalog = new Map((planRows ?? []).map((p) => [p.key, p]));

  return rows
    .filter((r) => !compedIds.has(r.business_id))
    .map((r) => {
      const biz = bizMap.get(r.business_id);
      const catalog = biz?.plan ? planCatalog.get(biz.plan) : null;
      return {
        id: r.id,
        businessId: r.business_id,
        businessName: biz?.name ?? "Unknown",
        plan: biz?.plan ?? "—",
        amountPaidCents: typeof r.amount_paid_cents === "number" ? r.amount_paid_cents : 0,
        catalogMonthlyCents: catalog?.price_monthly_cents ?? null,
        currency: r.currency || "usd",
        paidAt: r.paid_at,
        stripeInvoiceId: r.stripe_invoice_id,
        stripeSubscriptionId: r.stripe_subscription_id,
        stripeMode: r.stripe_mode,
      };
    });
}

export type ClientPaymentLine = {
  id: string;
  businessId: string;
  businessName: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  description: string | null;
  projectId: string | null;
};

export type ClientPaymentsByBusiness = {
  businessId: string;
  businessName: string;
  totalCents: number;
  clients: {
    clientId: string | null;
    clientName: string;
    clientEmail: string | null;
    totalCents: number;
    payments: ClientPaymentLine[];
  }[];
};

/**
 * Cross-tenant client→studio payments (Connect GMV). Headline uses status=paid only;
 * pass status to match. Super-admin path only — never call from tenant code.
 */
export async function listClientPaymentsProcessed(
  filters?: PlatformRevenueFilters & { status?: string | null }
): Promise<{
  totalCents: number;
  byBusiness: ClientPaymentsByBusiness[];
  lines: ClientPaymentLine[];
}> {
  const raw = await createServiceClient();
  const status = filters?.status?.trim() || "paid";

  let query = raw
    .from("payments")
    .select(
      "id, business_id, client_id, project_id, amount, status, paid_at, created_at, description"
    )
    .order("paid_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (filters?.businessId) {
    query = query.eq("business_id", filters.businessId);
  }
  const fromIso = parseDayBound(filters?.from, false);
  const toIso = parseDayBound(filters?.to, true);
  // Prefer paid_at for paid rows; fall back to created_at window for unpaid filters.
  if (fromIso) {
    if (status === "paid") query = query.gte("paid_at", fromIso);
    else query = query.gte("created_at", fromIso);
  }
  if (toIso) {
    if (status === "paid") query = query.lte("paid_at", toIso);
    else query = query.lte("created_at", toIso);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[platform-revenue] list client payments failed", error.message);
    throw new Error(error.message);
  }
  if (!rows?.length) {
    return { totalCents: 0, byBusiness: [], lines: [] };
  }

  const businessIds = [...new Set(rows.map((r) => r.business_id).filter(Boolean))];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];

  const [{ data: businesses }, { data: clients }] = await Promise.all([
    raw.from("businesses").select("id, name").in("id", businessIds),
    clientIds.length
      ? raw.from("clients").select("id, name, email").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string | null }[] }),
  ]);

  const bizMap = new Map((businesses ?? []).map((b) => [b.id, b.name as string]));
  const clientMap = new Map(
    (clients ?? []).map((c) => [c.id, { name: c.name as string, email: c.email as string | null }])
  );

  const lines: ClientPaymentLine[] = rows.map((r) => {
    const client = r.client_id ? clientMap.get(r.client_id) : null;
    return {
      id: r.id,
      businessId: r.business_id,
      businessName: bizMap.get(r.business_id) ?? "Unknown",
      clientId: r.client_id,
      clientName: client?.name ?? (r.client_id ? "Unknown client" : "No client"),
      clientEmail: client?.email ?? null,
      amountCents: typeof r.amount === "number" ? r.amount : 0,
      status: r.status,
      paidAt: r.paid_at,
      createdAt: r.created_at,
      description: r.description,
      projectId: r.project_id,
    };
  });

  const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);

  const byBusinessMap = new Map<string, ClientPaymentsByBusiness>();
  for (const line of lines) {
    let biz = byBusinessMap.get(line.businessId);
    if (!biz) {
      biz = {
        businessId: line.businessId,
        businessName: line.businessName,
        totalCents: 0,
        clients: [],
      };
      byBusinessMap.set(line.businessId, biz);
    }
    biz.totalCents += line.amountCents;
    const clientKey = line.clientId ?? "__none__";
    let clientBucket = biz.clients.find((c) => (c.clientId ?? "__none__") === clientKey);
    if (!clientBucket) {
      clientBucket = {
        clientId: line.clientId,
        clientName: line.clientName,
        clientEmail: line.clientEmail,
        totalCents: 0,
        payments: [],
      };
      biz.clients.push(clientBucket);
    }
    clientBucket.totalCents += line.amountCents;
    clientBucket.payments.push(line);
  }

  const byBusiness = [...byBusinessMap.values()].sort((a, b) => b.totalCents - a.totalCents);
  for (const biz of byBusiness) {
    biz.clients.sort((a, b) => b.totalCents - a.totalCents);
  }

  return { totalCents, byBusiness, lines };
}
