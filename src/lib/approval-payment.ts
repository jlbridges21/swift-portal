import { createPaymentLink, PaymentLinkError } from "@/lib/create-payment-link";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { logWorkflowAudit, logWorkflowSkipped } from "@/lib/workflow";
import { idempotencyKey } from "@/lib/idempotency";
import { isPaymentCovered } from "@/lib/payment-status";
import {
  depositPaymentDescription,
  existingApprovalPaymentState,
  isOpenPaymentStatus,
  paymentLinkTitle,
  quoteCollectsPaymentOnApproval,
  resolveDepositCharge,
  resolveQuoteDepositTerms,
} from "@/lib/payment-quote";
import type { AppSettings } from "@/lib/app-settings";
import type { Payment, ProjectQuote } from "@/lib/types";

/**
 * What approving a proposal did about payment. Returned to the client with the approved
 * proposal, so the portal can open checkout at once instead of waiting for a reload.
 *  ready        — an open invoice the client can pay now (new, or the one already made)
 *  covered      — the approval invoice is already paid or processing
 *  not_required — the terms bill nothing on approval ("invoice later", $0, or automation off)
 *  unavailable  — payment is expected but could not be made available (message is client-safe)
 */
export type ApprovalPaymentResult =
  | { status: "ready"; payment: Payment; created: boolean }
  | { status: "covered" }
  | { status: "not_required" }
  | { status: "unavailable"; reason: "stripe_not_ready" | "no_client" | "failed"; message: string };

const UNAVAILABLE_MESSAGE = "Your payment isn't ready yet. We've let the business know — try Pay Now again shortly.";

/**
 * Make sure an approved proposal has its approval invoice, creating it at most once.
 * Safe to call on every approve click, refresh or "Pay Now" retry: an existing invoice
 * for the proposal is returned as-is (createPaymentLink also guards concurrent requests).
 * `fresh` is true only for the request that actually approved the proposal; it alone logs
 * the deposit fallback note.
 */
export async function ensureApprovalPayment(input: {
  businessId: string;
  quote: ProjectQuote;
  appSettings: AppSettings;
  actorUserId: string | null;
  fresh: boolean;
}): Promise<ApprovalPaymentResult> {
  const { businessId, quote, appSettings } = input;
  const payWorkflow = appSettings.workflow.payments;
  if (quote.status !== "approved") return { status: "not_required" };

  const db = await createTenantServiceClient(businessId);
  const { data: rows } = await db
    .from("payments")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });
  // Any invoice already made for this proposal (approval or manual) wins. Never a second one.
  const existing = existingApprovalPaymentState((rows ?? []) as Payment[]);
  if (existing) return existing.status === "ready" ? { ...existing, created: false } : existing;

  if (
    !quoteCollectsPaymentOnApproval(quote, {
      autoCreateOnApproval: payWorkflow.autoCreatePaymentLinkOnApproval,
      business: payWorkflow,
    })
  ) {
    return { status: "not_required" };
  }

  const { data: project } = await db
    .from("projects")
    .select("id, client_id, property_address, service_type")
    .eq("id", quote.project_id)
    .maybeSingle();
  if (!project?.client_id) {
    await logWorkflowSkipped(
      quote.project_id,
      "Invoice was not created after approval because the project has no client.",
      idempotencyKey("workflow", "approval-payment-skipped", quote.id)
    );
    return { status: "unavailable", reason: "no_client", message: UNAVAILABLE_MESSAGE };
  }

  const charge = resolveDepositCharge(quote.total_cents, resolveQuoteDepositTerms(quote, payWorkflow));
  if (charge.fallback && input.fresh) {
    console.warn("[payment] deposit fell back to the full quote total", {
      businessId,
      quoteId: quote.id,
      reason: charge.fallback,
    });
    await logWorkflowAudit(quote.project_id, charge.fallback, {
      userId: input.actorUserId,
      idempotencyKey: idempotencyKey("workflow", "deposit-fallback", quote.id),
    });
  }

  const { data: client } = await db.from("clients").select("name").eq("id", project.client_id).maybeSingle();
  const title = paymentLinkTitle(
    client?.name || "Client",
    project.property_address || "",
    project.service_type || "Service"
  );

  try {
    const { payment, created } = await createPaymentLink({
      businessId,
      projectId: quote.project_id,
      clientId: project.client_id,
      quoteId: quote.id,
      amount: charge.amountCents,
      description: charge.isDeposit ? depositPaymentDescription(charge.amountCents, quote.total_cents) : title,
      actorUserId: input.actorUserId,
      origin: "approval",
      followUpToApproval: true,
      quoteTotalCents: quote.total_cents,
      isDeposit: charge.isDeposit,
    });
    if (isOpenPaymentStatus(payment.status)) return { status: "ready", payment, created };
    if (isPaymentCovered(payment.status)) return { status: "covered" };
    return { status: "not_required" };
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) {
      await logWorkflowSkipped(
        quote.project_id,
        "Invoice was not created after approval because Stripe is not connected. Connect Stripe to let clients pay immediately when they approve.",
        idempotencyKey("workflow", "approval-payment-stripe", quote.id)
      );
      return { status: "unavailable", reason: "stripe_not_ready", message: UNAVAILABLE_MESSAGE };
    }
    if (err instanceof PaymentLinkError && /paid in full/i.test(err.message)) return { status: "covered" };
    console.error("[payment] approval invoice failed", { businessId, quoteId: quote.id, err });
    await logWorkflowSkipped(
      quote.project_id,
      "Invoice was not created after approval. The proposal is still approved; the client can retry Pay Now, or create the invoice from the Payments tab.",
      idempotencyKey("workflow", "approval-payment-failed", quote.id)
    );
    return { status: "unavailable", reason: "failed", message: UNAVAILABLE_MESSAGE };
  }
}
