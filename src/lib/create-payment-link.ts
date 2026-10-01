import { setProjectStatus } from "@/lib/status-automation";
import { getAppSettings } from "@/lib/app-settings";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getStripeForBusiness } from "@/lib/stripe-connect";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { logProjectActivity } from "@/lib/activity";
import { buildStripePaymentMetadata } from "@/lib/stripe-metadata";
import { idempotencyKey } from "@/lib/idempotency";
import {
  isOpenPaymentStatus,
  paidCentsForQuote,
  quoteOutstandingBalanceCents,
} from "@/lib/payment-quote";
import { formatCurrency } from "@/lib/utils";
import type { Payment, ProjectQuote } from "@/lib/types";

export class PaymentLinkError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PaymentLinkError";
    this.status = status;
  }
}

export type CreatePaymentLinkInput = {
  businessId: string;
  projectId: string;
  clientId: string;
  amount: number;
  description: string;
  productDescription?: string;
  quoteId?: string | null;
  actorUserId?: string | null;
  /**
   * approval — one payment per quote until that row is cancelled.
   * manual — an open row is returned; a later balance row is allowed after it is paid.
   */
  origin: "approval" | "manual";
  /** Approval copy acknowledges the proposal. Manual payments keep the existing request. */
  followUpToApproval?: boolean;
  quoteTotalCents?: number;
  isDeposit?: boolean;
};

export type CreatePaymentLinkResult = {
  payment: Payment;
  created: boolean;
};

function approvalNotice(input: CreatePaymentLinkInput, payUrl: string): { title: string; body: string } {
  const due = formatCurrency(input.amount);
  const total = formatCurrency(input.quoteTotalCents ?? input.amount);
  if (input.isDeposit) {
    return {
      title: "Proposal approved — deposit ready",
      body: `You approved the proposal. A ${due} deposit is due now. The full project total is ${total}. Pay here: ${payUrl}`,
    };
  }
  return {
    title: "Proposal approved — payment ready",
    body: `You approved the proposal. ${due} is ready to pay. Pay here: ${payUrl}`,
  };
}

/**
 * Create a Stripe payment link and the portal payment row.
 * Callers enforce their own permission gates. This function only writes
 * rows for the given business.
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
  if (!input.projectId || !input.clientId || !input.amount || !input.description) {
    throw new PaymentLinkError("Missing required fields", 400);
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new PaymentLinkError("Payment amount must be a positive number of cents.", 400);
  }

  const db = await createTenantServiceClient(input.businessId);
  const { data: project } = await db
    .from("projects")
    .select("id, project_name, client_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) throw new PaymentLinkError("Not found", 404);

  let amount = input.amount;
  if (input.quoteId) {
    const { data: quote } = await db
      .from("project_quotes")
      .select("id, project_id, total_cents")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (!quote || quote.project_id !== input.projectId) {
      throw new PaymentLinkError("Not found", 404);
    }

    const { data: existingRows, error: existingError } = await db
      .from("payments")
      .select("*")
      .eq("quote_id", input.quoteId)
      .order("created_at", { ascending: true });
    if (existingError) throw new PaymentLinkError(existingError.message, 500);

    const existing = (existingRows ?? []) as Payment[];
    const open = existing.filter((p) => isOpenPaymentStatus(p.status));
    if (input.origin === "approval") {
      const live = existing.filter((p) => p.status !== "cancelled");
      if (live.length) return { payment: live[0], created: false };
    } else if (open.length) {
      return { payment: open[0], created: false };
    }

    const remaining = quoteOutstandingBalanceCents(quote as Pick<ProjectQuote, "id" | "total_cents">, existing);
    if (remaining <= 0) {
      throw new PaymentLinkError("This quote is already paid in full.", 400);
    }
    if (amount > remaining) {
      console.warn("[payment] amount above quote balance, charging the remaining balance", {
        businessId: input.businessId,
        quoteId: input.quoteId,
        requested: amount,
        remaining,
      });
      amount = remaining;
    }
    if (paidCentsForQuote(existing, input.quoteId) === 0 && amount > quote.total_cents) {
      amount = quote.total_cents;
    }
  }

  const appSettings = await getAppSettings(input.businessId);
  const due = new Date();
  due.setDate(due.getDate() + appSettings.workflow.businessDefaults.defaultPaymentDueDays);
  const dueDate = due.toISOString().split("T")[0];

  const { stripe, requestOptions, stripeAccountId } = await getStripeForBusiness(input.businessId);

  const { data: paymentRow, error: insertError } = await db
    .from("payments")
    .insert({
      project_id: input.projectId,
      client_id: input.clientId,
      quote_id: input.quoteId || null,
      amount,
      description: input.description,
      due_date: dueDate,
      status: "pending",
      stripe_account_id: stripeAccountId,
    })
    .select()
    .single();

  if (insertError || !paymentRow) {
    throw new PaymentLinkError(insertError?.message || "Failed to create payment", 500);
  }

  const productDescription = input.productDescription?.trim().slice(0, 500) || undefined;
  const stripeMetadata = buildStripePaymentMetadata({
    paymentId: paymentRow.id,
    businessId: input.businessId,
    projectId: input.projectId,
    clientId: input.clientId,
  });
  const tenantOrigin = await resolvePortalOrigin(input.businessId);
  const paymentLinkParams = {
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: input.description.slice(0, 250),
            ...(productDescription ? { description: productDescription } : {}),
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      ...stripeMetadata,
      project_name: project.project_name || "",
      ...(input.quoteId ? { quote_id: input.quoteId } : {}),
    },
    payment_intent_data: {
      metadata: stripeMetadata,
    },
    after_completion: {
      type: "redirect" as const,
      redirect: {
        url: `${tenantOrigin}/dashboard/projects/${input.projectId}?payment=success#payments`,
      },
    },
  };

  let paymentLink;
  try {
    paymentLink = requestOptions
      ? await stripe.paymentLinks.create(paymentLinkParams, requestOptions)
      : await stripe.paymentLinks.create(paymentLinkParams);
  } catch (err) {
    await db.from("payments").delete().eq("id", paymentRow.id);
    throw err;
  }

  const { data: payment, error } = await db
    .from("payments")
    .update({
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
      payment_link_url: paymentLink.url,
      status: "sent",
    })
    .eq("id", paymentRow.id)
    .select()
    .single();

  if (error || !payment) {
    await db.from("payments").delete().eq("id", paymentRow.id);
    throw new PaymentLinkError(error?.message || "Failed to save payment link", 500);
  }

  const amountStr = formatCurrency(amount);
  const payWorkflow = appSettings.workflow.payments;
  const payUrl = paymentLink.url;

  if (payWorkflow.autoMoveOnPaymentLink) {
    const clientBody = input.followUpToApproval
      ? approvalNotice({ ...input, amount }, payUrl).body
      : await resolveProjectMessageTemplate(
          appSettings.workflow,
          "payment_request",
          input.projectId,
          {
            payment_amount: amountStr,
            portal_link: await portalLink(`/dashboard/projects/${input.projectId}#payments`, input.businessId),
          },
          `Complete your ${amountStr} payment to unlock your final downloads.`
        );
    const clientTitle = input.followUpToApproval
      ? approvalNotice({ ...input, amount }, payUrl).title
      : "Final Payment";

    await setProjectStatus({
      projectId: input.projectId,
      status: "awaiting_payment",
      activityType: "invoice_sent",
      activityDescription: input.followUpToApproval
        ? `Payment link created after proposal approval for ${amountStr}`
        : `Invoice sent for ${amountStr}`,
      skipIfSame: true,
      skipWorkflowAudit: Boolean(input.followUpToApproval),
      notifyClient: true,
      clientEventKey: input.followUpToApproval ? undefined : "payment_link_sent",
      clientTitle,
      clientBody,
      link: `/dashboard/projects/${input.projectId}#payments`,
      idempotencyKey: `payment:link:${paymentRow.id}`,
    });
    if (!input.followUpToApproval) {
      await logWorkflowAudit(
        input.projectId,
        "Workflow automatically moved project to Approved – Awaiting Payment when payment link was created.",
        { idempotencyKey: `workflow:payment-link:${paymentRow.id}` }
      );
    }
  } else {
    await logWorkflowSkipped(
      input.projectId,
      "Automatic move to Awaiting Payment skipped — disabled in Payment Automation settings.",
      `workflow:payment-link-skipped:${paymentRow.id}`
    );
  }

  if (!input.followUpToApproval) {
    await logProjectActivity("invoice_sent", `Payment link created for ${amountStr}`, {
      businessId: input.businessId,
      projectId: input.projectId,
      userId: input.actorUserId ?? null,
      idempotencyKey: idempotencyKey("payment", "link", paymentRow.id),
      metadata: { paymentId: paymentRow.id, amount, origin: input.origin },
    });
  }

  return { payment: payment as Payment, created: true };
}

async function resolvePortalOrigin(businessId: string): Promise<string> {
  const { getBusinessPortalOriginById } = await import("@/lib/portal-url");
  return getBusinessPortalOriginById(businessId);
}
