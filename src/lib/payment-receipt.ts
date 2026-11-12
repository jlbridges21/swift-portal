/**
 * Permanent ShootPortal payment receipts.
 *
 * Stripe-hosted receipt URLs (charge.receipt_url) expire, so they are never the receipt.
 * A receipt is built from the ShootPortal payment row plus a live, read-only Stripe lookup
 * of the PaymentIntent / Charge. What it showed is frozen in `payment_receipts` (v125) so
 * later edits to the project or business settings — or a disconnected Stripe account —
 * do not change or break an old receipt.
 *
 * Read-only toward payments and Stripe: nothing here changes a payment's status, amount,
 * refund state, downloads or Marketing Kit access.
 */
import type Stripe from "stripe";
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";
import { parsePaymentIdFromMetadata } from "@/lib/stripe-metadata";
import type { Payment } from "@/lib/types";
import { formatReceiptMoney } from "@/lib/payment-receipt-format";

export { formatReceiptMoney };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReceiptKind = "stripe" | "manual";
export type ReceiptStatus = "paid" | "partially_refunded" | "refunded";

export type ReceiptBusiness = {
  name: string;
  addressLines: string[];
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
};

/** Stripe facts read from the Charge. Only non-sensitive card/bank details. */
export type StripeReceiptFacts = {
  paymentIntentId: string | null;
  chargeId: string | null;
  amountCents: number;
  currency: string;
  createdAt: string | null;
  methodType: "card" | "us_bank_account" | "other" | null;
  cardBrand: string | null;
  last4: string | null;
  bankName: string | null;
  refundedCents: number;
  lastRefundAt: string | null;
  disputed: boolean;
};

export type ReceiptFrozen = {
  business: ReceiptBusiness;
  projectName: string;
  propertyAddress: string;
  clientName: string;
  description: string;
  /** "Property Website" / "Social Media Kit" when this payment bought a Marketing Kit add-on. */
  purchaseLabel: string | null;
  quote: { title: string; totalCents: number; lineItems: { description: string; amountCents: number }[] } | null;
  frozenAt: string;
};

type ReceiptSnapshot = {
  v: 1;
  frozen: ReceiptFrozen;
  stripe: StripeReceiptFacts | null;
  stripeVerifiedAt: string | null;
};

export type ReceiptLine = { label: string; amountCents: number; muted?: boolean };

export type PaymentReceipt = {
  paymentId: string;
  projectId: string;
  receiptNumber: string;
  kind: ReceiptKind;
  status: ReceiptStatus;
  title: string;
  business: ReceiptBusiness;
  projectName: string;
  propertyAddress: string;
  clientName: string;
  description: string;
  paidAt: string | null;
  currency: string;
  lineItems: ReceiptLine[];
  /** What this payment covered (payment row amount), before any card fee. */
  amountCents: number;
  feeCents: number;
  /** What the client was actually charged. Stripe's figure when verified. */
  totalCents: number;
  refundedCents: number;
  lastRefundAt: string | null;
  disputed: boolean;
  methodLabel: string | null;
  /** Context line: what this payment applied toward (never claims the whole estimate was paid). */
  appliedToward: string | null;
  verification: {
    source: "stripe_live" | "stripe_saved" | "record_only" | "manual";
    verifiedAt: string | null;
    paymentIntentId: string | null;
  };
  notes: string[];
};

export type ReceiptUnavailable = {
  code: "processing" | "not_paid" | "mismatch";
  title: string;
  message: string;
};

export type ReceiptResult = { ok: true; receipt: PaymentReceipt } | { ok: false; unavailable: ReceiptUnavailable };

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in scripts/verify-payment-receipt-view.ts)
// ---------------------------------------------------------------------------

/** Stable, human-friendly receipt number derived from the payment id. Never changes. */
export function receiptNumberFor(paymentId: string): string {
  return `RCPT-${paymentId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

const BRAND_LABELS: Record<string, string> = {
  amex: "American Express",
  diners: "Diners Club",
  discover: "Discover",
  eftpos_au: "eftpos",
  jcb: "JCB",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  visa: "Visa",
};

export function receiptMethodLabel(args: {
  kind: ReceiptKind;
  methodType: string | null | undefined;
  cardBrand?: string | null;
  last4?: string | null;
  bankName?: string | null;
}): string | null {
  if (args.kind === "manual") return "Recorded by the business";
  const last4 = args.last4 && /^\d{4}$/.test(args.last4) ? args.last4 : null;
  if (args.methodType === "us_bank_account") {
    const bank = args.bankName?.trim();
    return `Bank transfer (ACH)${bank ? ` · ${bank}` : ""}${last4 ? ` ending ${last4}` : ""}`;
  }
  if (args.methodType === "card" || args.cardBrand || last4) {
    const brand = args.cardBrand ? BRAND_LABELS[args.cardBrand] ?? args.cardBrand.charAt(0).toUpperCase() + args.cardBrand.slice(1) : "Card";
    return last4 ? `${brand} ending ${last4}` : brand;
  }
  return null;
}

/** Is this payment row a business-recorded (manual) payment rather than a Stripe payment? */
export function isManualPayment(payment: Pick<Payment, "payment_method_type" | "stripe_payment_intent_id" | "stripe_checkout_session_id" | "stripe_invoice_id">): boolean {
  if (payment.payment_method_type === "manual") return true;
  return !payment.stripe_payment_intent_id && !payment.stripe_checkout_session_id && !payment.stripe_invoice_id;
}

/**
 * Gate: only a payment ShootPortal records as paid gets a receipt. Pending ACH, failed,
 * cancelled, expired, draft and unpaid requests never produce a "Paid" document.
 */
export function receiptGate(status: Payment["status"]): ReceiptUnavailable | null {
  if (status === "paid") return null;
  if (status === "processing") {
    return {
      code: "processing",
      title: "Bank payment still processing",
      message: "Bank (ACH) payments usually clear in a few business days. The receipt will be available here once the payment has cleared.",
    };
  }
  if (status === "failed") {
    return { code: "not_paid", title: "No receipt for this payment", message: "This payment did not go through, so there is no receipt." };
  }
  if (status === "cancelled" || status === "expired") {
    return { code: "not_paid", title: "No receipt for this payment", message: "This payment request was closed without being paid, so there is no receipt." };
  }
  return { code: "not_paid", title: "Not paid yet", message: "A receipt is available after this payment is completed." };
}

export function receiptStatusFor(totalCents: number, refundedCents: number): ReceiptStatus {
  if (refundedCents <= 0) return "paid";
  return refundedCents >= totalCents ? "refunded" : "partially_refunded";
}

/** Compose the receipt from the payment row, frozen details and (optionally) Stripe facts. */
export function composeReceipt(args: {
  payment: Pick<Payment, "id" | "project_id" | "amount" | "paid_at" | "client_fee_cents" | "payment_method_type" | "card_last4" | "stripe_payment_intent_id" | "stripe_checkout_session_id" | "stripe_invoice_id">;
  frozen: ReceiptFrozen;
  stripe: StripeReceiptFacts | null;
  stripeSource: "live" | "saved" | null;
  stripeVerifiedAt: string | null;
}): PaymentReceipt {
  const { payment, frozen, stripe } = args;
  const kind: ReceiptKind = isManualPayment(payment) ? "manual" : "stripe";
  const feeCents = kind === "stripe" ? Math.max(0, payment.client_fee_cents ?? 0) : 0;
  const amountCents = payment.amount;
  const recordTotal = amountCents + feeCents;
  const totalCents = kind === "stripe" && stripe ? stripe.amountCents : recordTotal;
  const currency = (stripe?.currency || "usd").toLowerCase();
  const refundedCents = kind === "stripe" && stripe ? Math.min(stripe.refundedCents, stripe.amountCents) : 0;
  const notes: string[] = [];

  // Line items: the quote's own lines only when this single payment covered the whole
  // estimate. Otherwise one line for this payment, so a deposit or partial payment never
  // reads as if the full estimate was paid.
  const lineItems: ReceiptLine[] = [];
  const quote = frozen.quote;
  const quoteFullyCovered =
    quote && quote.lineItems.length > 0 && quote.totalCents === amountCents &&
    quote.lineItems.reduce((sum, line) => sum + line.amountCents, 0) === amountCents;
  if (quoteFullyCovered && quote) {
    for (const line of quote.lineItems) lineItems.push({ label: line.description, amountCents: line.amountCents });
  } else {
    lineItems.push({ label: frozen.description || "Payment", amountCents });
  }
  if (feeCents > 0) lineItems.push({ label: "Card processing fee", amountCents: feeCents, muted: true });

  let appliedToward: string | null = null;
  if (quote && !quoteFullyCovered) {
    appliedToward = `Applied toward ${quote.title || "estimate"} (estimate total ${formatReceiptMoney(quote.totalCents, currency)})`;
  }

  if (kind === "stripe" && stripe && stripe.amountCents !== recordTotal) {
    notes.push(
      `Stripe charged ${formatReceiptMoney(stripe.amountCents, currency)}, which differs from the ShootPortal payment record (${formatReceiptMoney(recordTotal, currency)}). The total shown is Stripe's charged amount.`
    );
  }
  if (kind === "stripe" && !stripe) {
    notes.push(
      "Payment details could not be confirmed with Stripe right now. Amounts shown come from the ShootPortal payment record created when the payment succeeded. Refund status could not be checked."
    );
  } else if (kind === "stripe" && args.stripeSource === "saved") {
    notes.push(
      `Stripe could not be reached just now. Details shown were verified with Stripe on ${formatIsoDate(args.stripeVerifiedAt)}.`
    );
  }
  if (kind === "manual") {
    notes.push(
      `This payment was recorded as paid by ${frozen.business.name || "the business"}. It was not processed through ShootPortal's Stripe checkout, so this is a payment acknowledgment rather than a Stripe-verified receipt.`
    );
  }
  if (stripe?.disputed) notes.push("This payment is disputed with the card issuer.");

  const status = receiptStatusFor(totalCents, refundedCents);
  return {
    paymentId: payment.id,
    projectId: payment.project_id,
    receiptNumber: receiptNumberFor(payment.id),
    kind,
    status,
    title: kind === "manual" ? "Payment Acknowledgment" : "Payment Receipt",
    business: frozen.business,
    projectName: frozen.projectName,
    propertyAddress: frozen.propertyAddress,
    clientName: frozen.clientName,
    description: frozen.purchaseLabel || frozen.description,
    paidAt: payment.paid_at ?? stripe?.createdAt ?? null,
    currency,
    lineItems,
    amountCents,
    feeCents,
    totalCents,
    refundedCents,
    lastRefundAt: stripe?.lastRefundAt ?? null,
    disputed: Boolean(stripe?.disputed),
    methodLabel: receiptMethodLabel({
      kind,
      methodType: stripe?.methodType ?? payment.payment_method_type,
      cardBrand: stripe?.cardBrand,
      last4: stripe?.last4 ?? payment.card_last4,
      bankName: stripe?.bankName,
    }),
    appliedToward,
    verification: {
      source: kind === "manual" ? "manual" : !stripe ? "record_only" : args.stripeSource === "live" ? "stripe_live" : "stripe_saved",
      verifiedAt: kind === "stripe" && stripe ? args.stripeVerifiedAt : null,
      paymentIntentId: stripe?.paymentIntentId ?? payment.stripe_payment_intent_id ?? null,
    },
    notes,
  };
}

function formatIsoDate(iso: string | null): string {
  if (!iso) return "an earlier date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

/** Read the non-sensitive facts off a Charge. */
export function factsFromCharge(
  charge: Pick<Stripe.Charge, "id" | "amount" | "currency" | "created" | "amount_refunded" | "disputed"> & {
    payment_method_details?: Stripe.Charge["payment_method_details"] | null;
  },
  paymentIntentId: string | null,
  lastRefundAt: string | null
): StripeReceiptFacts {
  const details = charge.payment_method_details;
  const type = details?.type;
  const last4 = details?.card?.last4 ?? details?.us_bank_account?.last4 ?? null;
  return {
    paymentIntentId,
    chargeId: charge.id,
    amountCents: charge.amount,
    currency: charge.currency,
    createdAt: charge.created ? new Date(charge.created * 1000).toISOString() : null,
    methodType: type === "card" || type === "us_bank_account" ? type : type ? "other" : null,
    cardBrand: details?.card?.brand ?? null,
    last4: last4 && /^\d{4}$/.test(last4) ? last4 : null,
    bankName: details?.us_bank_account?.bank_name ?? null,
    refundedCents: charge.amount_refunded ?? 0,
    lastRefundAt,
    disputed: Boolean(charge.disputed),
  };
}

// ---------------------------------------------------------------------------
// Stripe lookup (read-only)
// ---------------------------------------------------------------------------

export class ReceiptMismatchError extends Error {}

const STRIPE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Stripe lookup timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

/**
 * Find the succeeded Stripe charge behind this payment row and read its facts.
 * Returns null when Stripe has no completed charge for it (e.g. a checkout that was started
 * and then the business marked the payment paid by hand). Throws ReceiptMismatchError if the
 * stored Stripe object belongs to a different ShootPortal payment.
 */
export async function fetchStripeFacts(payment: Payment): Promise<StripeReceiptFacts | null> {
  const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
  const opts = requestOptions ?? undefined;
  const assertOwned = (metadata: Stripe.Metadata | null | undefined) => {
    const owner = parsePaymentIdFromMetadata(metadata);
    if (owner && owner !== payment.id) throw new ReceiptMismatchError("Stripe payment belongs to another record");
  };

  let intentId = payment.stripe_payment_intent_id?.trim() || null;
  let chargeId: string | null = null;

  if (!intentId && payment.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id, {}, opts);
    assertOwned(session.metadata);
    if (session.payment_status !== "paid") return null;
    intentId = idOf(session.payment_intent as string | Stripe.PaymentIntent | null);
  }
  if (!intentId && payment.stripe_invoice_id) {
    const invoice = (await stripe.invoices.retrieve(payment.stripe_invoice_id, { expand: ["payments"] }, opts)) as Stripe.Invoice & {
      payments?: { data?: { payment?: { payment_intent?: string | { id?: string } | null; charge?: string | { id?: string } | null } | null }[] };
    };
    assertOwned(invoice.metadata);
    for (const row of invoice.payments?.data ?? []) {
      intentId = intentId ?? idOf(row.payment?.payment_intent ?? null);
      chargeId = chargeId ?? idOf(row.payment?.charge ?? null);
    }
  }

  let charge: Stripe.Charge | null = null;
  if (intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] }, opts);
    assertOwned(intent.metadata);
    if (intent.status !== "succeeded") return null;
    const latest = intent.latest_charge as Stripe.Charge | string | null;
    charge = typeof latest === "string" ? await stripe.charges.retrieve(latest, {}, opts) : latest;
  } else if (chargeId) {
    charge = await stripe.charges.retrieve(chargeId, {}, opts);
    assertOwned(charge.metadata);
  }
  if (!charge || charge.status !== "succeeded" || !charge.paid) return null;

  let lastRefundAt: string | null = null;
  if ((charge.amount_refunded ?? 0) > 0) {
    try {
      const refunds = await stripe.refunds.list({ charge: charge.id, limit: 20 }, opts);
      const latest = refunds.data.filter((r) => r.status === "succeeded").sort((a, b) => b.created - a.created)[0];
      lastRefundAt = latest ? new Date(latest.created * 1000).toISOString() : null;
    } catch {
      lastRefundAt = null; // the amount is still known from the charge
    }
  }
  return factsFromCharge(charge, intentId ?? idOf(charge.payment_intent as string | null), lastRefundAt);
}

// ---------------------------------------------------------------------------
// Snapshot storage (v125, optional)
// ---------------------------------------------------------------------------

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /payment_receipts/.test(error.message ?? "") && /does not exist|schema cache/i.test(error.message ?? "");
}

async function readSnapshot(db: TenantServiceClient, paymentId: string): Promise<{ snapshot: ReceiptSnapshot | null; tableReady: boolean }> {
  const { data, error } = await db.from("payment_receipts").select("snapshot").eq("payment_id", paymentId).maybeSingle();
  if (error) return { snapshot: null, tableReady: !isMissingTable(error) };
  const snap = (data?.snapshot ?? null) as ReceiptSnapshot | null;
  return { snapshot: snap && snap.v === 1 && snap.frozen ? snap : null, tableReady: true };
}

async function writeSnapshot(db: TenantServiceClient, paymentId: string, snapshot: ReceiptSnapshot): Promise<void> {
  const { error } = await db.from("payment_receipts").upsert(
    {
      payment_id: paymentId,
      snapshot,
      stripe_verified_at: snapshot.stripeVerifiedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "payment_id" }
  );
  if (error && !isMissingTable(error)) {
    console.error("[payment-receipt] snapshot save failed", error.message?.slice(0, 200));
  }
}

// ---------------------------------------------------------------------------
// Frozen details (business / project / client at first receipt view)
// ---------------------------------------------------------------------------

async function loadFrozenDetails(db: TenantServiceClient, businessId: string, payment: Payment): Promise<ReceiptFrozen> {
  const settings = await getAppSettings(businessId);
  const b = settings.business;
  const [{ data: project }, { data: purchase }, { data: quote }] = await Promise.all([
    db.from("projects").select("project_name, property_address, client_id").eq("id", payment.project_id).maybeSingle(),
    db.from("marketing_kit_purchases").select("product").eq("payment_id", payment.id).limit(1).maybeSingle(),
    payment.quote_id
      ? db.from("project_quotes").select("title, total_cents, line_items").eq("id", payment.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const clientId = payment.client_id || (project?.client_id as string | null) || null;
  const { data: client } = clientId
    ? await db.from("clients").select("name").eq("id", clientId).maybeSingle()
    : { data: null };

  const cityLine = [[b.city, b.state].filter((v) => v?.trim()).join(", "), b.postalCode].filter((v) => v?.trim()).join(" ");
  const addressLines = [b.addressLine1, b.addressLine2, cityLine, b.country].map((l) => (l || "").trim()).filter(Boolean);
  const product = (purchase as { product?: string } | null)?.product;
  const q = quote as { title?: string; total_cents?: number; line_items?: { description?: string; amount_cents?: number }[] } | null;

  return {
    business: {
      name: (b.legalName || b.businessName || b.portalName || "").trim(),
      addressLines,
      email: (b.supportEmail || b.primaryContactEmail || "").trim(),
      phone: (b.phoneNumber || "").trim(),
      website: (b.websiteUrl || "").trim(),
      logoUrl: (b.logoUrl || b.emailLogoUrl || "").trim(),
    },
    projectName: (project?.project_name as string | undefined)?.trim() || "",
    propertyAddress: (project?.property_address as string | undefined)?.trim() || "",
    clientName: (client?.name as string | undefined)?.trim() || "",
    description: payment.description?.trim() || "",
    purchaseLabel: product === "website" ? "Property Website" : product === "social" ? "Social Media Kit" : null,
    quote: q && typeof q.total_cents === "number"
      ? {
          title: q.title?.trim() || "Estimate",
          totalCents: q.total_cents,
          lineItems: (Array.isArray(q.line_items) ? q.line_items : [])
            .filter((l) => typeof l?.amount_cents === "number" && l.description)
            .map((l) => ({ description: String(l.description), amountCents: Number(l.amount_cents) })),
        }
      : null,
    frozenAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the receipt for one payment. The caller must already have authorized the viewer
 * for this payment (see receipt-access.ts). The payment row must belong to `businessId`.
 */
export async function buildPaymentReceipt(payment: Payment, businessId: string): Promise<ReceiptResult> {
  if (payment.business_id && payment.business_id !== businessId) {
    return { ok: false, unavailable: { code: "mismatch", title: "Receipt not found", message: "This receipt could not be found." } };
  }
  const gate = receiptGate(payment.status);
  if (gate) return { ok: false, unavailable: gate };

  const db = await createTenantServiceClient(businessId);
  const { snapshot, tableReady } = await readSnapshot(db, payment.id);
  const frozen = snapshot?.frozen ?? (await loadFrozenDetails(db, businessId, payment));

  let stripe: StripeReceiptFacts | null = null;
  let stripeSource: "live" | "saved" | null = null;
  let stripeVerifiedAt: string | null = null;
  if (!isManualPayment(payment)) {
    try {
      stripe = await withTimeout(fetchStripeFacts(payment), STRIPE_TIMEOUT_MS);
      if (stripe) {
        stripeSource = "live";
        stripeVerifiedAt = new Date().toISOString();
      }
    } catch (err) {
      if (err instanceof ReceiptMismatchError) {
        console.error("[payment-receipt] Stripe object belongs to another payment", { paymentId: payment.id });
        return {
          ok: false,
          unavailable: {
            code: "mismatch",
            title: "Receipt needs review",
            message: "This payment's Stripe record doesn't match it, so ShootPortal won't show a receipt that could be wrong. Please contact the business.",
          },
        };
      }
      console.error("[payment-receipt] Stripe lookup failed", err instanceof Error ? err.message.slice(0, 200) : "unknown");
    }
    if (!stripe && snapshot?.stripe) {
      stripe = snapshot.stripe;
      stripeSource = "saved";
      stripeVerifiedAt = snapshot.stripeVerifiedAt;
    }
  }

  if (tableReady) {
    const next: ReceiptSnapshot = {
      v: 1,
      frozen,
      stripe: stripe ?? snapshot?.stripe ?? null,
      stripeVerifiedAt: stripeSource === "live" ? stripeVerifiedAt : snapshot?.stripeVerifiedAt ?? null,
    };
    const changed =
      !snapshot ||
      JSON.stringify({ ...snapshot, stripeVerifiedAt: null }) !== JSON.stringify({ ...next, stripeVerifiedAt: null });
    if (changed) await writeSnapshot(db, payment.id, next);
  }

  return { ok: true, receipt: composeReceipt({ payment, frozen, stripe, stripeSource, stripeVerifiedAt }) };
}
