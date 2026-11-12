import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  getStripeForBusiness,
  getStripeForStoredAccount,
  isBankPaymentAvailable,
  portalCheckoutBaseUrl,
  StripeConnectNotReadyError,
} from "@/lib/stripe-connect";
import { buildStripePaymentMetadata, CLIENT_FEE_METADATA_KEY, parseClientFeeFromMetadata, parsePaymentIdFromMetadata } from "@/lib/stripe-metadata";
import { CARD_FEE_LINE_NAME, cardFeeCents } from "@/lib/card-fee";
import { buildPaymentCheckoutParams, type CheckoutReturnTarget } from "@/lib/checkout-session-params";
import { reconcilePaymentFromStripe } from "@/lib/stripe-payment-reconcile";
import { closeOpenCheckoutsForPayment, findInFlightStripePayment } from "@/lib/checkout-closure";
import { getAppSettings } from "@/lib/app-settings";
import { paymentMethodLabel } from "@/lib/payment-status";
import { effectiveRequireDeliveredForDownloads, resolveProjectDownloadAllowed } from "@/lib/deliverables";
import type { StripeConnectRequestOptions } from "@/lib/stripe";
import type { Payment } from "@/lib/types";

/**
 * Client checkout for a project payment row, shared by the signed-in portal
 * (POST /api/payments/{id}/checkout) and the public pay page (/pay/{token}).
 *
 * Amounts always come from the payment row and business settings — never from the browser.
 * Every session is created on the business's own Stripe account (direct charge, same as the
 * hosted flow), with the same line items and metadata, so the existing Connect webhooks and
 * reconciliation record the payment exactly as before.
 */

/** card = cards and wallets (plus the business's other Stripe methods); bank = US bank account (ACH). */
export type CheckoutMethod = "card" | "bank";

export const BANK_UNAVAILABLE_MESSAGE = "Bank payments aren't available for this business. Please pay by card.";

export class CheckoutStartError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutStartError";
    this.status = status;
  }
}

/** What the client sees in the embedded checkout. Computed on the server from the payment row. */
export type EmbeddedCheckoutSummary = {
  paymentId: string;
  description: string;
  dueDate: string | null;
  amountCents: number;
  feeCents: number;
  feeLabel: string | null;
  totalCents: number;
  method: CheckoutMethod;
  bankAvailable: boolean;
};

export type EmbeddedCheckoutStart = {
  clientSecret: string;
  sessionId: string;
  /** Connected account the Payment Element must initialize against (null = platform account). */
  stripeAccountId: string | null;
  summary: EmbeddedCheckoutSummary;
};

type BusinessForCheckout = Parameters<typeof portalCheckoutBaseUrl>[0] & { slug: string };

export async function expireCheckoutSession(
  sessionId: string | null | undefined,
  stripe: Stripe,
  requestOptions?: StripeConnectRequestOptions
): Promise<boolean> {
  if (!sessionId) return true;
  try {
    if (requestOptions) {
      await stripe.checkout.sessions.expire(sessionId, {}, requestOptions);
    } else {
      await stripe.checkout.sessions.expire(sessionId);
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/status of `expired`/i.test(message)) return true;
    console.warn("[client-checkout] previous checkout session was not expired", err);
    return false;
  }
}

async function loadClientEmail(businessId: string, clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("clients").select("email").eq("id", clientId).maybeSingle();
  const email = (data as { email?: string | null } | null)?.email?.trim();
  return email || null;
}

const registeredWalletDomains = new Set<string>();

function isRegistrableHost(host: string): boolean {
  const h = host.toLowerCase();
  return Boolean(h) && h !== "localhost" && !h.endsWith(".localhost") && !h.endsWith(".test") && !/^\d+\.\d+\.\d+\.\d+$/.test(h) && !h.startsWith("[");
}

/**
 * Apple Pay and Google Pay in the Payment Element only appear on domains registered with the
 * Stripe account that takes the charge (here the business's connected account). Best effort:
 * a failure only hides the wallet buttons — cards and banks still work.
 */
async function ensureWalletDomains(hosts: string[], stripe: Stripe, requestOptions?: StripeConnectRequestOptions) {
  const account = requestOptions?.stripeAccount ?? "platform";
  for (const raw of hosts) {
    const host = raw.split(":")[0]?.toLowerCase() ?? "";
    if (!isRegistrableHost(host)) continue;
    const cacheKey = `${account}|${host}`;
    if (registeredWalletDomains.has(cacheKey)) continue;
    try {
      const params = { domain_name: host };
      if (requestOptions) await stripe.paymentMethodDomains.create(params, requestOptions);
      else await stripe.paymentMethodDomains.create(params);
      registeredWalletDomains.add(cacheKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already|exists/i.test(message)) {
        registeredWalletDomains.add(cacheKey);
      } else {
        console.warn("[client-checkout] wallet domain registration skipped", { host, error: message });
      }
    }
  }
}

function sessionMethod(session: Stripe.Checkout.Session): CheckoutMethod {
  const types = session.payment_method_types ?? [];
  return types.length === 1 && types[0] === "us_bank_account" ? "bank" : "card";
}

/**
 * Create a Checkout Session for one payment row. Hosted sessions redirect to Stripe
 * (unchanged behavior); embedded sessions return a client secret for the Payment Element.
 *
 * Every session (hosted or in-app) goes through the same duplicate-charge guards: a single
 * open session per payment row (reused for in-app refreshes and second tabs), Payment Link
 * sessions closed first, a Stripe search for money already moving, an idempotency key for
 * duplicate clicks, and an atomic compare-and-swap when the session is saved on the row.
 */
export async function createClientCheckoutSession(args: {
  payment: Payment;
  businessId: string;
  business: BusinessForCheckout;
  method?: CheckoutMethod;
  returnTo?: CheckoutReturnTarget;
  uiMode?: "hosted" | "elements";
  /** Host the client is on, so Apple Pay / Google Pay can be enabled for it. */
  requestHost?: string | null;
}): Promise<{ session: Stripe.Checkout.Session; embedded: EmbeddedCheckoutStart | null }> {
  const { payment, businessId, business } = args;
  const method = args.method ?? "card";
  const uiMode = args.uiMode ?? "hosted";

  const appUrl = portalCheckoutBaseUrl(business);
  if (!appUrl) throw new CheckoutStartError("App URL not configured", 500);

  const metadata = buildStripePaymentMetadata({
    paymentId: payment.id,
    businessId: payment.business_id || businessId,
    projectId: payment.project_id,
    clientId: payment.client_id ?? undefined,
  });

  let stripeContext;
  try {
    stripeContext = await getStripeForBusiness(businessId);
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) throw new CheckoutStartError(err.message, 400);
    throw err;
  }
  const { stripe, requestOptions, stripeAccountId } = stripeContext;

  const bankAvailable = await isBankPaymentAvailable(businessId);
  if (method === "bank" && !bankAvailable) throw new CheckoutStartError(BANK_UNAVAILABLE_MESSAGE, 400);

  const settings = await getAppSettings(businessId);
  const feeCents = method === "card" && settings.workflow.payments.passCardFeeToClient ? cardFeeCents(payment.amount) : 0;
  const sessionMetadata: Stripe.MetadataParam = { ...metadata, ...(feeCents > 0 ? { [CLIENT_FEE_METADATA_KEY]: String(feeCents) } : {}) };
  const totalCents = payment.amount + feeCents;

  const sessionParams = buildPaymentCheckoutParams({
    payment,
    method,
    feeCents,
    metadata: sessionMetadata,
    appUrl,
    returnTo: args.returnTo,
    uiMode,
    customerEmail: uiMode === "elements" ? await loadClientEmail(businessId, payment.client_id) : null,
  });

  const summary: EmbeddedCheckoutSummary = {
    paymentId: payment.id,
    description: payment.description,
    dueDate: payment.due_date,
    amountCents: payment.amount,
    feeCents,
    feeLabel: feeCents > 0 ? CARD_FEE_LINE_NAME : null,
    totalCents,
    method,
    bankAvailable,
  };

  if (uiMode === "elements") {
    const hosts = [new URL(appUrl).host, args.requestHost ?? ""].filter(Boolean);
    await ensureWalletDomains([...new Set(hosts)], stripe, requestOptions);
  }

  // --- One payable session per payment row -------------------------------------------------
  // Reuse the row's open in-app session when it charges exactly the same thing (refresh, second
  // tab, second device, reopened modal). Otherwise close it — and any session opened from the
  // emailed Stripe Payment Link — before creating another, so two sessions are never payable.
  const previousId = payment.stripe_checkout_session_id;
  if (previousId) {
    const previous = await retrieveSessionSafe(stripe, previousId, requestOptions);
    if (previous?.status === "complete") {
      throw new CheckoutStartError(ALREADY_SUBMITTED_MESSAGE, 409);
    }
    if (
      uiMode === "elements" &&
      previous?.status === "open" &&
      previous.ui_mode === "elements" &&
      previous.client_secret &&
      previous.amount_total === totalCents &&
      parsePaymentIdFromMetadata(previous.metadata) === payment.id &&
      sessionMethod(previous) === method &&
      previous.return_url === sessionParams.return_url
    ) {
      return {
        session: previous,
        embedded: { clientSecret: previous.client_secret, sessionId: previous.id, stripeAccountId, summary },
      };
    }
  }

  const closure = await closeOpenCheckoutsForPayment(payment);
  if (closure.completedSessionId) throw new CheckoutStartError(ALREADY_SUBMITTED_MESSAGE, 409);
  if (!closure.allClosed) {
    throw new CheckoutStartError("Another checkout for this payment is still open or finishing. Wait a moment, then refresh.", 409);
  }

  // Money already moving through a session the row no longer points at (lost webhook, older
  // tab)? Stop here; the status check records it.
  const inFlight = await findInFlightStripePayment(payment);
  if (inFlight) {
    console.warn("[client-checkout] refusing new checkout — Stripe already has a payment for this row", {
      paymentId: payment.id,
      paymentIntentId: inFlight.paymentIntentId,
      status: inFlight.status,
    });
    throw new CheckoutStartError(ALREADY_SUBMITTED_MESSAGE, 409);
  }

  // Duplicate clicks / concurrent requests with the same inputs resolve to one Stripe session.
  const idempotencyKey = `sp-checkout:${payment.id}:${createHash("sha256")
    .update(JSON.stringify({ sessionParams, previousId: previousId ?? null }))
    .digest("hex")
    .slice(0, 40)}`;
  const session = await stripe.checkout.sessions.create(sessionParams, { ...(requestOptions ?? {}), idempotencyKey });
  if (uiMode === "elements" ? !session.client_secret : !session.url) {
    throw new CheckoutStartError("Failed to start checkout", 500);
  }

  // Compare-and-swap: attach the session only if the row still points at the session we read
  // and is still payable. A concurrent request that won the race keeps its session; ours is
  // expired so it can never be paid.
  const attached = await attachSessionToPayment(payment, businessId, session.id, previousId ?? null, stripeAccountId);
  if (!attached) {
    await expireCheckoutSession(session.id, stripe, requestOptions);
    throw new CheckoutStartError("This payment was updated in another window. Refresh and try again.", 409);
  }

  return {
    session,
    embedded:
      uiMode === "elements"
        ? { clientSecret: session.client_secret!, sessionId: session.id, stripeAccountId, summary }
        : null,
  };
}

const ALREADY_SUBMITTED_MESSAGE =
  "A payment for this request has already been submitted. We're confirming it with Stripe — please don't pay again.";

export function isAlreadySubmittedError(err: unknown): boolean {
  return err instanceof CheckoutStartError && err.message === ALREADY_SUBMITTED_MESSAGE;
}

async function retrieveSessionSafe(
  stripe: Stripe,
  sessionId: string,
  requestOptions?: StripeConnectRequestOptions
): Promise<Stripe.Checkout.Session | null> {
  try {
    return requestOptions
      ? await stripe.checkout.sessions.retrieve(sessionId, {}, requestOptions)
      : await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

/**
 * Atomic attach: UPDATE … WHERE id = ? AND status IN (pending, sent) AND session = <previous>.
 * Returns false when another request changed the row first (or it was paid / cancelled).
 * Two requests that got the same idempotent session both succeed.
 */
async function attachSessionToPayment(
  payment: Payment,
  businessId: string,
  sessionId: string,
  previousId: string | null,
  stripeAccountId: string | null
): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  let query = db
    .from("payments")
    .update({
      stripe_checkout_session_id: sessionId,
      ...(payment.stripe_account_id ? {} : { stripe_account_id: stripeAccountId }),
    })
    .eq("id", payment.id)
    .in("status", ["pending", "sent"]);
  query = previousId ? query.eq("stripe_checkout_session_id", previousId) : query.is("stripe_checkout_session_id", null);
  const { data, error } = await query.select("id");
  if (error) throw new CheckoutStartError("Could not save checkout. Please try again.", 500);
  if (data && data.length > 0) return true;

  const { data: current } = await db.from("payments").select("stripe_checkout_session_id, status").eq("id", payment.id).maybeSingle();
  return Boolean(current && current.stripe_checkout_session_id === sessionId && (current.status === "pending" || current.status === "sent"));
}

/**
 * paid — recorded as paid in ShootPortal (webhook or verified reconcile).
 * processing — bank debit authorized; clears in a few business days.
 * confirming — Stripe finished the session but the record has not caught up yet.
 * open — not paid yet (declined, closed, or still in progress).
 * expired / failed — this checkout can no longer be paid.
 */
export type CheckoutOutcomeState = "paid" | "processing" | "confirming" | "open" | "expired" | "failed";

export type CheckoutOutcome = {
  state: CheckoutOutcomeState;
  amountCents: number;
  feeCents: number;
  paidAt: string | null;
  receiptUrl: string | null;
  methodLabel: string | null;
  /** Server-computed: the client can download full-resolution media for this project now. */
  downloadsUnlocked: boolean;
};

async function loadPaymentRow(paymentId: string, businessId: string): Promise<Payment | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  return (data as Payment | null) ?? null;
}

async function downloadsUnlockedFor(payment: Payment, businessId: string): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const { data: project } = await db.from("projects").select("*").eq("id", payment.project_id).maybeSingle();
  if (!project) return false;
  const settings = await getAppSettings(businessId);
  const requireDelivered = effectiveRequireDeliveredForDownloads(
    settings.payments.requireDeliveredForDownloads,
    (project as { client_download_access?: unknown }).client_download_access
  );
  return resolveProjectDownloadAllowed({
    projectStatus: String((project as { status?: string }).status ?? ""),
    isAdmin: false,
    requireDeliveredForDownloads: requireDelivered,
  });
}

/**
 * Verify a checkout result with Stripe and the payment record. The browser's own "success"
 * is never trusted: this reads the session from the business's Stripe account, confirms it
 * belongs to this payment, runs the same idempotent reconcile the project page uses (which
 * calls the webhook's success handler), and reports what the payment row now says.
 */
export async function verifyCheckoutOutcome(args: {
  payment: Payment;
  businessId: string;
  sessionId?: string | null;
  /** Also search Stripe for this row's PaymentIntents (one Search call). For the final poll / "Check again". */
  thorough?: boolean;
}): Promise<CheckoutOutcome> {
  let payment = args.payment;
  const sessionId = args.sessionId || payment.stripe_checkout_session_id;
  let session: Stripe.Checkout.Session | null = null;

  if (sessionId && !(payment.status === "paid" || payment.status === "cancelled")) {
    const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
    try {
      session = requestOptions
        ? await stripe.checkout.sessions.retrieve(sessionId, {}, requestOptions)
        : await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      session = null;
    }
    if (session && parsePaymentIdFromMetadata(session.metadata) !== payment.id) {
      throw new CheckoutStartError("Checkout not found", 404);
    }
    if (session?.status === "complete") {
      await reconcilePaymentFromStripe(payment, "embedded_checkout_status");
      payment = (await loadPaymentRow(payment.id, args.businessId)) ?? payment;
    }
  }

  let inFlight: Awaited<ReturnType<typeof findInFlightStripePayment>> = null;
  if (args.thorough && (payment.status === "pending" || payment.status === "sent")) {
    const result = await reconcilePaymentFromStripe(payment, "embedded_checkout_status_thorough", { searchByMetadata: true });
    if (result.repaired) payment = (await loadPaymentRow(payment.id, args.businessId)) ?? payment;
    if (payment.status === "pending" || payment.status === "sent") inFlight = await findInFlightStripePayment(payment);
  }

  const base = {
    amountCents: payment.amount,
    feeCents: payment.client_fee_cents ?? (session ? parseClientFeeFromMetadata(session.metadata) : 0),
    paidAt: payment.paid_at,
    receiptUrl: payment.stripe_receipt_url,
    methodLabel: paymentMethodLabel(payment),
  };

  if (payment.status === "paid") {
    return { ...base, state: "paid", downloadsUnlocked: await downloadsUnlockedFor(payment, args.businessId) };
  }
  if (payment.status === "processing") return { ...base, state: "processing", downloadsUnlocked: false };
  if (payment.status === "cancelled") return { ...base, state: "failed", downloadsUnlocked: false };
  // Stripe has (or may have) taken money that isn't on the record yet — never report "unpaid".
  if (session?.status === "complete" || inFlight) return { ...base, state: "confirming", downloadsUnlocked: false };
  if (session?.status === "expired") return { ...base, state: "expired", downloadsUnlocked: false };
  return { ...base, state: "open", downloadsUnlocked: false };
}
