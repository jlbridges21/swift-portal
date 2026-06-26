import { createServiceClient } from "@/lib/supabase/server";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
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

  if (payment.status === "paid") {
    return { alreadyPaid: true };
  }

  const supabase = await createServiceClient();
  const paidAt = new Date().toISOString();

  await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId ?? payment.stripe_checkout_session_id,
      stripe_receipt_url: receiptUrl ?? payment.stripe_receipt_url,
    })
    .eq("id", payment.id);

  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;

  await logProjectActivity("payment_received", `Payment received: ${amountStr}`, {
    projectId: payment.project_id,
    metadata: { paymentId: payment.id, source },
  });

  await setProjectStatus({
    projectId: payment.project_id,
    status: "delivered",
    activityType: "payment_received",
    activityDescription: `Payment received: ${amountStr}`,
    notifyClient: false,
    skipIfSame: true,
  });

  await notifyAdmins({
    type: "payment_received",
    eventKey: "payment_received",
    title: "Payment Received",
    body: `${amountStr} received for ${payment.description}. Downloads are unlocked.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
  });

  await notifyProjectClients({
    type: "payment_confirmed",
    eventKey: "project_delivered",
    title: "Project Complete",
    body: "Payment confirmed — all deliverables are now available to download. Thank you for choosing Swift Aerial Media!",
    link: `/dashboard/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
  });

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
  const supabase = await createServiceClient();

  await logProjectActivity("payment_requested", `Payment attempt failed: ${reason}`, {
    projectId: payment.project_id,
    metadata: { paymentId: payment.id, reason },
  });

  await notifyAdmins({
    type: "payment_received",
    eventKey: "payment_failed",
    title: "Payment Failed",
    body: `Payment failed for ${payment.description}: ${reason}`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
  });
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
