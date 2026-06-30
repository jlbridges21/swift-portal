import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { getStripe } from "@/lib/stripe";
import { parsePaymentIdFromMetadata } from "@/lib/stripe-metadata";
import { isPaymentComplete } from "@/lib/payment-status";
import type { Payment } from "@/lib/types";
import type Stripe from "stripe";

interface PaymentSuccessOptions {
  payment: Payment;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  receiptUrl?: string | null;
  source: string;
}

export interface PaymentLookupOptions {
  metadata?: Stripe.Metadata | null;
  paymentLinkId?: string;
  paymentIntentId?: string;
  checkoutSessionId?: string;
  clientReferenceId?: string;
}

/** Idempotent payment success — safe to call from multiple webhook events. */
export async function handlePaymentSuccess(options: PaymentSuccessOptions) {
  const { payment, checkoutSessionId, paymentIntentId, receiptUrl, source } = options;
  const appSettings = await getAppSettings();
  const { payments: payWorkflow } = appSettings.workflow;

  if (isPaymentComplete(payment.status)) {
    return { alreadyPaid: true, paymentId: payment.id, updated: false };
  }

  const supabase = await createServiceClient();
  const paidAt = new Date().toISOString();
  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;
  const activityDescription =
    source === "manual_admin"
      ? `Payment marked as paid manually: ${amountStr}`
      : `Payment received: ${amountStr}`;

  const { data: updated, error: updateError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId ?? payment.stripe_checkout_session_id,
      stripe_payment_intent_id: paymentIntentId ?? payment.stripe_payment_intent_id,
      stripe_receipt_url: receiptUrl ?? payment.stripe_receipt_url,
    })
    .eq("id", payment.id)
    .in("status", ["pending", "sent"])
    .select()
    .single();

  if (updateError && updateError.code !== "PGRST116") {
    throw new Error(`Failed to update payment ${payment.id}: ${updateError.message}`);
  }

  if (!updated) {
    return { alreadyPaid: true, paymentId: payment.id, updated: false };
  }

  if (payment.stripe_payment_link_id) {
    try {
      await getStripe().paymentLinks.update(payment.stripe_payment_link_id, { active: false });
    } catch (err) {
      console.error(
        `[stripe-webhook] Failed to deactivate payment link for payment ${payment.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (payWorkflow.autoMoveOnStripePaid) {
    await setProjectStatus({
      projectId: payment.project_id,
      status: "delivered",
      activityType: "payment_received",
      activityDescription,
      notifyClient: false,
      skipIfSame: true,
      idempotencyKey: `payment:${payment.id}:received`,
    });
    await logWorkflowAudit(payment.project_id, `Workflow automatically moved project to Delivered after payment.`, {
      idempotencyKey: `workflow:payment-delivered:${payment.id}`,
    });
  } else {
    await logProjectActivity("payment_received", activityDescription, {
      projectId: payment.project_id,
      idempotencyKey: `payment:${payment.id}:received`,
      metadata: { paymentId: payment.id, source },
    });
    await logWorkflowSkipped(
      payment.project_id,
      "Automatic move to Delivered skipped — disabled in Payment Automation settings.",
      `workflow:payment-delivered-skipped:${payment.id}`
    );
  }

  if (payWorkflow.autoUnlockDownloads) {
    await logWorkflowAudit(payment.project_id, "Downloads automatically unlocked after payment.", {
      idempotencyKey: `workflow:downloads-unlocked:${payment.id}`,
    });
  }

  const clientBody = await resolveProjectMessageTemplate(
    appSettings.workflow,
    "payment_received",
    payment.project_id,
    {
      payment_amount: amountStr,
      portal_link: portalLink(`/dashboard/projects/${payment.project_id}#payments`),
    },
    "Payment confirmed — all deliverables are now available to download. Thank you for choosing Swift Aerial Media!"
  );

  const completedBody = await resolveProjectMessageTemplate(
    appSettings.workflow,
    "project_completed",
    payment.project_id,
    {
      portal_link: portalLink(`/dashboard/projects/${payment.project_id}`),
    },
    clientBody
  );

  const { data: project } = await supabase
    .from("projects")
    .select("project_name")
    .eq("id", payment.project_id)
    .maybeSingle();

  const projectLabel = project?.project_name || payment.description;

  await notifyAdmins({
    type: "payment_received",
    eventKey: "payment_received",
    title: "Payment Received",
    body: `${amountStr} received for ${projectLabel}. Downloads are unlocked.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
  });

  if (payWorkflow.autoSendReceipt) {
    await notifyProjectClients({
      type: "payment_confirmed",
      eventKey: "project_delivered",
      title: "Project Complete",
      body: completedBody,
      link: `/dashboard/projects/${payment.project_id}#payments`,
      projectId: payment.project_id,
    });
  }

  return { alreadyPaid: false, paymentId: payment.id, updated: true };
}

export async function findPaymentFromStripe(
  options: PaymentLookupOptions
): Promise<Payment | null> {
  const supabase = await createServiceClient();

  const paymentId =
    parsePaymentIdFromMetadata(options.metadata) ||
    (options.clientReferenceId && /^[0-9a-f-]{36}$/i.test(options.clientReferenceId)
      ? options.clientReferenceId
      : undefined);

  if (paymentId) {
    const { data } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (data) return data as Payment;
  }

  if (options.paymentIntentId) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("stripe_payment_intent_id", options.paymentIntentId)
      .maybeSingle();
    if (data) return data as Payment;
  }

  if (options.checkoutSessionId) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("stripe_checkout_session_id", options.checkoutSessionId)
      .maybeSingle();
    if (data) return data as Payment;
  }

  if (options.paymentLinkId) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("stripe_payment_link_id", options.paymentLinkId)
      .maybeSingle();
    if (data) return data as Payment;
  }

  return null;
}

/** @deprecated Use findPaymentFromStripe */
export async function findPaymentFromSession(metadata: {
  payment_id?: string;
  payment_link?: string;
}): Promise<Payment | null> {
  return findPaymentFromStripe({
    metadata: metadata.payment_id ? { payment_id: metadata.payment_id } : undefined,
    paymentLinkId: metadata.payment_link,
  });
}

export async function resolvePaymentFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<Payment | null> {
  const paymentLinkId =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  let metadata = session.metadata ?? {};

  if (!parsePaymentIdFromMetadata(metadata) && paymentIntentId) {
    try {
      const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
      metadata = { ...metadata, ...intent.metadata };
    } catch (err) {
      console.error(
        "[stripe-webhook] Failed to retrieve payment intent for session lookup:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return findPaymentFromStripe({
    metadata,
    paymentLinkId,
    paymentIntentId,
    checkoutSessionId: session.id,
    clientReferenceId: session.client_reference_id ?? undefined,
  });
}

export async function resolvePaymentFromCharge(charge: Stripe.Charge): Promise<Payment | null> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  let metadata = charge.metadata ?? {};

  if (!parsePaymentIdFromMetadata(metadata) && paymentIntentId) {
    try {
      const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
      metadata = { ...metadata, ...intent.metadata };
    } catch (err) {
      console.error(
        "[stripe-webhook] Failed to retrieve payment intent for charge lookup:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return findPaymentFromStripe({
    metadata,
    paymentIntentId,
  });
}

export async function resolvePaymentFromPaymentIntent(
  intent: Stripe.PaymentIntent
): Promise<Payment | null> {
  return findPaymentFromStripe({
    metadata: intent.metadata,
    paymentIntentId: intent.id,
  });
}

export async function handlePaymentFailed(payment: Payment, reason: string) {
  const appSettings = await getAppSettings();

  await logProjectActivity("payment_requested", `Payment attempt failed: ${reason}`, {
    projectId: payment.project_id,
    metadata: { paymentId: payment.id, reason },
  });

  if (appSettings.workflow.payments.notifyAdminOnFailure) {
    await notifyAdmins({
      type: "payment_received",
      eventKey: "payment_failed",
      title: "Payment Failed",
      body: `Payment failed for ${payment.description}: ${reason}`,
      link: `/admin/projects/${payment.project_id}#payments`,
      projectId: payment.project_id,
    });
  } else {
    await logWorkflowSkipped(
      payment.project_id,
      "Admin payment failure notification skipped — disabled in Payment Automation settings.",
      `workflow:payment-failed-skipped:${payment.id}`
    );
  }
}

export async function handleCheckoutExpired(payment: Payment) {
  await logProjectActivity("payment_requested", "Checkout session expired — payment link still active", {
    projectId: payment.project_id,
    metadata: { paymentId: payment.id },
  });

  await notifyAdmins({
    type: "invoice_available",
    eventKey: "payment_link_sent",
    title: "Checkout session expired",
    body: `Client checkout expired for ${payment.description}. Resend the payment link if needed.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
  });
}
