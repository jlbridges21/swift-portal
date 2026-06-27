import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveMessageTemplate } from "@/lib/workflow";
import type { Payment } from "@/lib/types";

interface PaymentSuccessOptions {
  payment: Payment;
  checkoutSessionId?: string;
  receiptUrl?: string | null;
  source: string;
}

/** Idempotent payment success — safe to call from multiple webhook events. */
export async function handlePaymentSuccess(options: PaymentSuccessOptions) {
  const { payment, checkoutSessionId, receiptUrl, source } = options;
  const appSettings = await getAppSettings();
  const { payments: payWorkflow } = appSettings.workflow;

  if (payment.status === "paid") {
    return { alreadyPaid: true };
  }

  const supabase = await createServiceClient();
  const paidAt = new Date().toISOString();
  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;

  await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId ?? payment.stripe_checkout_session_id,
      stripe_receipt_url: receiptUrl ?? payment.stripe_receipt_url,
    })
    .eq("id", payment.id);

  await logProjectActivity("payment_received", `Payment received: ${amountStr}`, {
    projectId: payment.project_id,
    idempotencyKey: `payment:${payment.id}:received`,
    metadata: { paymentId: payment.id, source },
  });

  if (payWorkflow.autoMoveOnStripePaid) {
    await setProjectStatus({
      projectId: payment.project_id,
      status: "delivered",
      activityType: "payment_received",
      activityDescription: `Payment received: ${amountStr}`,
      notifyClient: false,
      skipIfSame: true,
      idempotencyKey: `payment:${payment.id}:delivered`,
    });
    await logWorkflowAudit(payment.project_id, `Workflow automatically moved project to Delivered after payment.`, {
      idempotencyKey: `workflow:payment-delivered:${payment.id}`,
    });
  } else {
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

  const clientBody = resolveMessageTemplate(
    appSettings.workflow,
    "payment_received",
    {
      payment_amount: amountStr,
      portal_link: portalLink(`/dashboard/projects/${payment.project_id}#payments`),
    },
    "Payment confirmed — all deliverables are now available to download. Thank you for choosing Swift Aerial Media!"
  );

  const completedBody = resolveMessageTemplate(
    appSettings.workflow,
    "project_completed",
    {
      portal_link: portalLink(`/dashboard/projects/${payment.project_id}`),
    },
    clientBody
  );

  await notifyAdmins({
    type: "payment_received",
    eventKey: "payment_received",
    title: "Payment Received",
    body: `${amountStr} received for ${payment.description}. Downloads are unlocked.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
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

  return { alreadyPaid: false };
}

export async function findPaymentFromSession(metadata: {
  payment_id?: string;
  payment_link?: string;
}): Promise<Payment | null> {
  const supabase = await createServiceClient();

  if (metadata.payment_id) {
    const { data } = await supabase.from("payments").select("*").eq("id", metadata.payment_id).single();
    if (data) return data as Payment;
  }

  if (metadata.payment_link) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("stripe_payment_link_id", metadata.payment_link)
      .single();
    if (data) return data as Payment;
  }

  return null;
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
