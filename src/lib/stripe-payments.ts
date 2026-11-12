import { grantPurchasesForPayment, isMarketingAddonPayment } from "@/lib/marketing/purchases";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { setProjectStatus } from "@/lib/status-automation";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { sendPaymentReceiptEmails } from "@/lib/stripe-receipt-email";
import { getAppSettings } from "@/lib/app-settings";
import { shouldSendClientPaymentReceipt } from "@/lib/workflow-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { getStripeForStoredAccount } from "@/lib/stripe-connect";
import { parseBusinessIdFromMetadata, parsePaymentIdFromMetadata } from "@/lib/stripe-metadata";
import { isPaymentComplete, isPaymentCovered } from "@/lib/payment-status";
import { closeOpenCheckoutsForPayment, wasClosedEarly } from "@/lib/checkout-closure";
import type { Payment, PaymentMethodType } from "@/lib/types";
import type Stripe from "stripe";

interface PaymentSuccessOptions {
  payment: Payment;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  receiptUrl?: string | null;
  cardLast4?: string | null;
  source: string;
  metadata?: Stripe.Metadata | null;
  /** How the client paid, when known (from the Stripe charge). */
  paymentMethodType?: PaymentMethodType | null;
  /** Card fee the client paid on top of amount. */
  clientFeeCents?: number;
}

export interface PaymentLookupOptions {
  metadata?: Stripe.Metadata | null;
  paymentLinkId?: string;
  paymentIntentId?: string;
  checkoutSessionId?: string;
  clientReferenceId?: string;
}

export type StripeBusinessCheck =
  | { ok: true; businessId: string }
  | { ok: false; reason: "missing_payment_business" | "metadata_mismatch"; paymentBusinessId: string | null; metadataBusinessId: string | null };

/**
 * After a payment is found by Stripe ID (global lookup), attribute it to a
 * business. Metadata is optional today (legacy events); when present it must
 * match the payment row. Never treat a mismatch as Swift.
 */
export function checkPaymentBusinessAttribution(
  payment: Payment,
  metadata?: Stripe.Metadata | null
): StripeBusinessCheck {
  const paymentBusinessId = payment.business_id ?? null;
  const metadataBusinessId = parseBusinessIdFromMetadata(metadata) ?? null;

  if (!paymentBusinessId) {
    return {
      ok: false,
      reason: "missing_payment_business",
      paymentBusinessId: null,
      metadataBusinessId,
    };
  }

  if (metadataBusinessId && metadataBusinessId !== paymentBusinessId) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      paymentBusinessId,
      metadataBusinessId,
    };
  }

  return { ok: true, businessId: paymentBusinessId };
}

/** Idempotent payment success — safe to call from multiple webhook events. */
export async function handlePaymentSuccess(options: PaymentSuccessOptions) {
  const { payment, checkoutSessionId, paymentIntentId, receiptUrl, cardLast4, source } = options;
  // A bank payment that was processing already moved the project and told the client.
  const wasProcessing = payment.status === "processing";

  const attribution = checkPaymentBusinessAttribution(payment, options.metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] refusing payment success — cannot attribute business", {
      paymentId: payment.id,
      reason: attribution.reason,
      paymentBusinessId: attribution.paymentBusinessId,
      metadataBusinessId: attribution.metadataBusinessId,
      source,
    });
    throw new Error("Payment business attribution failed");
  }
  const businessId = attribution.businessId;

  const appSettings = await getAppSettings(businessId);
  const { payments: payWorkflow } = appSettings.workflow;

  if (isPaymentComplete(payment.status)) {
    await flagUnexpectedStripePayment(businessId, payment, paymentIntentId, source);
    // Marketing Kit add-on: re-run the (idempotent) grant in case an earlier attempt failed.
    if (await isMarketingAddonPayment(businessId, payment.id)) {
      await grantPurchasesForPayment(businessId, payment.id);
    }
    const receiptPatch: { stripe_receipt_url?: string; card_last4?: string } = {};
    if (receiptUrl && !payment.stripe_receipt_url) receiptPatch.stripe_receipt_url = receiptUrl;
    if (cardLast4 && !payment.card_last4) receiptPatch.card_last4 = cardLast4;
    if (Object.keys(receiptPatch).length) {
      const db = await createTenantServiceClient(businessId);
      await db.from("payments").update(receiptPatch).eq("id", payment.id);
    }
    return { alreadyPaid: true, paymentId: payment.id, updated: false, businessId };
  }

  const db = await createTenantServiceClient(businessId);
  const paidAt = new Date().toISOString();
  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;
  const activityDescription =
    source === "manual_admin"
      ? `Payment marked as paid manually: ${amountStr}`
      : wasProcessing
        ? `Bank payment cleared: ${amountStr}`
        : `Payment received: ${amountStr}`;
  const methodType: PaymentMethodType | null =
    source === "manual_admin"
      ? "manual"
      : options.paymentMethodType ?? payment.payment_method_type ?? (cardLast4 ? "card" : null);

  const paidColumns = {
    status: "paid" as const,
    paid_at: paidAt,
    stripe_checkout_session_id: checkoutSessionId ?? payment.stripe_checkout_session_id,
    stripe_payment_intent_id: paymentIntentId ?? payment.stripe_payment_intent_id,
    stripe_receipt_url: receiptUrl ?? payment.stripe_receipt_url,
    card_last4: cardLast4 ?? payment.card_last4 ?? null,
  };
  const markPaid = (columns: Record<string, unknown>) =>
    db.from("payments").update(columns).eq("id", payment.id).in("status", ["pending", "sent", "processing"]).select().single();
  let { data: updated, error: updateError } = await markPaid({ ...paidColumns, ...paymentMethodColumns(methodType, options.clientFeeCents) });
  // Before migration v106 the method/fee columns don't exist: record the payment without them.
  if (isMissingV106Column(updateError)) {
    ({ data: updated, error: updateError } = await markPaid(paidColumns));
  }

  if (updateError && updateError.code !== "PGRST116") {
    throw new Error(`Failed to update payment ${payment.id}: ${updateError.message}`);
  }

  if (!updated) {
    // Lost a race with another writer, or the row is no longer payable (cancelled/refunded).
    const { data: current } = await db.from("payments").select("*").eq("id", payment.id).maybeSingle();
    if (current) await flagUnexpectedStripePayment(businessId, current as Payment, paymentIntentId, source);
    return { alreadyPaid: true, paymentId: payment.id, updated: false, businessId };
  }

  // Settled: no other checkout for this row may still take money (open in-app session after a
  // manual "mark paid", a Payment Link session in another tab, ...).
  await closeOpenCheckoutsForPayment(payment, { exceptSessionId: checkoutSessionId ?? null });

  if (payment.stripe_payment_link_id) {
    try {
      const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
      if (requestOptions) {
        await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false }, requestOptions);
      } else {
        await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false });
      }
    } catch (err) {
      console.error(
        `[stripe-webhook] Failed to deactivate payment link for payment ${payment.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Marketing Kit add-on (Property Website / Social Media Kit): grant access and skip project
  // status automation. An add-on payment must never move the project to Delivered or unlock
  // downloads that the main invoice controls.
  const isMarketingAddon = await isMarketingAddonPayment(businessId, payment.id);
  // A deposit (or any quote payment that leaves a balance) must not deliver the project: that
  // would unlock downloads gated on Delivered before the balance is paid.
  const remainingQuoteCents = isMarketingAddon ? 0 : await remainingQuoteBalanceCents(db, payment);
  const leavesBalance = remainingQuoteCents > 0;
  if (isMarketingAddon) {
    await grantPurchasesForPayment(businessId, payment.id);
    await logProjectActivity("payment_received", activityDescription, {
      businessId,
      projectId: payment.project_id,
      idempotencyKey: `payment:${payment.id}:received`,
      metadata: { paymentId: payment.id, source, marketing: true },
    });
  } else if (wasProcessing) {
    await logProjectActivity("payment_received", activityDescription, {
      businessId,
      projectId: payment.project_id,
      idempotencyKey: `payment:${payment.id}:received`,
      metadata: { paymentId: payment.id, source },
    });
  } else if (leavesBalance) {
    await logProjectActivity("payment_received", activityDescription + " (" + formatCents(remainingQuoteCents) + " balance remaining)", {
      businessId,
      projectId: payment.project_id,
      idempotencyKey: "payment:" + payment.id + ":received",
      metadata: { paymentId: payment.id, source, remainingQuoteCents },
    });
  } else if (payWorkflow.autoMoveOnStripePaid) {
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
      businessId,
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

  if (payWorkflow.autoUnlockDownloads && !wasProcessing && !isMarketingAddon && !leavesBalance) {
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
      portal_link: await portalLink(`/dashboard/projects/${payment.project_id}#payments`, businessId),
    },
    "Payment confirmed — all deliverables are now available to download. Thank you!"
  );

  const completedBody = await resolveProjectMessageTemplate(
    appSettings.workflow,
    "project_completed",
    payment.project_id,
    {
      portal_link: await portalLink(`/dashboard/projects/${payment.project_id}`, businessId),
    },
    clientBody
  );

  const { data: project } = await db
    .from("projects")
    .select("project_name")
    .eq("id", payment.project_id)
    .maybeSingle();

  const projectLabel = project?.project_name || payment.description;

  const paidPayment = { ...payment, ...updated, paid_at: paidAt } as Payment;
  const cardLast4Saved = cardLast4 ?? payment.card_last4 ?? null;
  const receiptSaved = receiptUrl ?? payment.stripe_receipt_url ?? null;

  await notifyAdmins({
    businessId,
    type: "payment_received",
    eventKey: "payment_received",
    title: wasProcessing ? "Bank payment cleared" : "Payment receipt",
    body: wasProcessing ? `${amountStr} bank payment for ${projectLabel} has cleared.` : `${amountStr} paid for ${projectLabel}.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
    sendEmail: false,
  });

  if (payWorkflow.autoSendReceipt) {
    await notifyProjectClients({
      businessId,
      type: "payment_confirmed",
      eventKey: "project_delivered",
      title: wasProcessing ? "Bank payment cleared" : "Payment receipt",
      body: isMarketingAddon
        ? `Your ${amountStr} payment for ${payment.description} is confirmed. It's ready in your Marketing Kit.`
        : wasProcessing
          ? `Your ${amountStr} bank payment has cleared. Thank you!`
          : leavesBalance
            ? `Your ${amountStr} payment is confirmed. Thank you! The remaining ${formatCents(remainingQuoteCents)} is due later.`
            : completedBody,
      link: isMarketingAddon
        ? `/dashboard/projects/${payment.project_id}/marketing`
        : `/dashboard/projects/${payment.project_id}#payments`,
      projectId: payment.project_id,
      paymentId: payment.id,
      sendEmail: false,
    });
  }

  await sendPaymentReceiptEmails({
    businessId,
    payment: paidPayment,
    amountLabel: amountStr,
    projectLabel,
    receiptUrl: receiptSaved,
    cardLast4: cardLast4Saved,
    sendClient: shouldSendClientPaymentReceipt(appSettings.workflow),
  });

  return { alreadyPaid: false, paymentId: payment.id, updated: true, businessId };
}

/** True when a write failed only because migration v106 (bank payments) hasn't run yet. */
function isMissingV106Column(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message && /payment_method_type|client_fee_cents|processing_started_at/.test(error.message));
}

/** Method/fee columns (v106). Only written when known so older rows stay untouched. */
function paymentMethodColumns(methodType: PaymentMethodType | null | undefined, clientFeeCents?: number) {
  const cols: { payment_method_type?: PaymentMethodType; client_fee_cents?: number } = {};
  if (methodType) cols.payment_method_type = methodType;
  if (clientFeeCents && clientFeeCents > 0) cols.client_fee_cents = Math.round(clientFeeCents);
  return cols;
}

interface PaymentProcessingOptions {
  payment: Payment;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  source: string;
  metadata?: Stripe.Metadata | null;
}

/**
 * A bank (ACH) payment was authorized and Stripe is collecting it (clears in a few business
 * days). Idempotent. The payment counts as covered: the project moves to Delivered (when
 * Payment Automation allows) so the client can download now, both sides are told it's
 * processing, and the row becomes `paid` later via handlePaymentSuccess.
 */
export async function handlePaymentProcessing(options: PaymentProcessingOptions) {
  const { payment, checkoutSessionId, paymentIntentId, source } = options;
  const attribution = checkPaymentBusinessAttribution(payment, options.metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] refusing payment processing — cannot attribute business", {
      paymentId: payment.id,
      reason: attribution.reason,
      source,
    });
    throw new Error("Payment business attribution failed");
  }
  const businessId = attribution.businessId;
  if (isPaymentCovered(payment.status)) {
    return { updated: false, paymentId: payment.id, businessId };
  }

  const db = await createTenantServiceClient(businessId);
  const { data: updated, error } = await db
    .from("payments")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      payment_method_type: "us_bank_account",
      stripe_checkout_session_id: checkoutSessionId ?? payment.stripe_checkout_session_id,
      stripe_payment_intent_id: paymentIntentId ?? payment.stripe_payment_intent_id,
    })
    .eq("id", payment.id)
    .in("status", ["pending", "sent"])
    .select()
    .maybeSingle();
  if (error) {
    // Before migration v106 there is no processing status: skip it. The payment is recorded as
    // paid when the bank debit clears (payment_intent.succeeded / async_payment_succeeded).
    if (isMissingV106Column(error) || /enum payment_status/.test(error.message)) {
      console.warn("[stripe-webhook] processing status unavailable until migration v106; will record on settlement", { paymentId: payment.id });
      return { updated: false, paymentId: payment.id, businessId };
    }
    throw new Error(`Failed to mark payment ${payment.id} processing: ${error.message}`);
  }
  if (!updated) return { updated: false, paymentId: payment.id, businessId };

  await closeOpenCheckoutsForPayment(payment, { exceptSessionId: checkoutSessionId ?? null });

  // Stop the emailed link from being paid a second time while this one clears.
  if (payment.stripe_payment_link_id) {
    try {
      const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
      if (requestOptions) await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false }, requestOptions);
      else await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: false });
    } catch (err) {
      console.error(`[stripe-webhook] Failed to deactivate payment link for processing payment ${payment.id}:`, err instanceof Error ? err.message : err);
    }
  }

  const appSettings = await getAppSettings(businessId);
  const payWorkflow = appSettings.workflow.payments;
  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;
  const activityDescription = `Bank payment started: ${amountStr} (processing, usually clears in a few business days)`;
  // Marketing Kit add-on: access is granted when the bank payment clears (handlePaymentSuccess),
  // and an add-on never changes project status.
  const isMarketingAddon = await isMarketingAddonPayment(businessId, payment.id);
  const leavesBalance = !isMarketingAddon && (await remainingQuoteBalanceCents(db, payment)) > 0;

  if (payWorkflow.autoMoveOnStripePaid && !isMarketingAddon && !leavesBalance) {
    await setProjectStatus({
      projectId: payment.project_id,
      status: "delivered",
      activityType: "payment_received",
      activityDescription,
      notifyClient: false,
      skipIfSame: true,
      idempotencyKey: `payment:${payment.id}:processing`,
    });
    await logWorkflowAudit(payment.project_id, "Workflow automatically moved project to Delivered when the bank payment started processing.", {
      idempotencyKey: `workflow:payment-delivered:${payment.id}`,
    });
  } else {
    await logProjectActivity("payment_received", activityDescription, {
      businessId,
      projectId: payment.project_id,
      idempotencyKey: `payment:${payment.id}:processing`,
      metadata: { paymentId: payment.id, source },
    });
  }

  const { data: project } = await db.from("projects").select("project_name").eq("id", payment.project_id).maybeSingle();
  const projectLabel = project?.project_name || payment.description;

  await notifyAdmins({
    businessId,
    type: "payment_received",
    eventKey: "payment_received",
    title: "Bank payment processing",
    body: `${amountStr} bank (ACH) payment for ${projectLabel} is processing. It usually clears in a few business days; we'll let you know when it does.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
    sendEmail: false,
  });

  if (payWorkflow.autoSendReceipt) {
    await notifyProjectClients({
      businessId,
      type: "payment_confirmed",
      eventKey: "project_delivered",
      title: "Payment processing",
      body: isMarketingAddon
        ? `Your ${amountStr} bank payment is processing and usually clears in a few business days. Your Marketing Kit unlocks as soon as it does.`
        : payWorkflow.autoMoveOnStripePaid && !leavesBalance
        ? `Your ${amountStr} bank payment is processing and usually clears in a few business days. Your files are ready to download now.`
        : `Your ${amountStr} bank payment is processing and usually clears in a few business days.`,
      link: `/dashboard/projects/${payment.project_id}#payments`,
      projectId: payment.project_id,
      paymentId: payment.id,
      sendEmail: false,
    });
  }

  return { updated: true, paymentId: payment.id, businessId };
}

/**
 * The bank rejected an ACH debit that was processing (insufficient funds, closed account…).
 * Per the business's choice the project stays delivered; the payment returns to pending so
 * the client can pay again, and both sides are told. Idempotent: only acts on `processing`.
 */
export async function handleBankPaymentFailed(payment: Payment, reason: string, metadata?: Stripe.Metadata | null) {
  const attribution = checkPaymentBusinessAttribution(payment, metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] refusing bank payment failure write — cannot attribute business", {
      paymentId: payment.id,
      reason: attribution.reason,
    });
    return { updated: false };
  }
  const businessId = attribution.businessId;
  if (payment.status !== "processing") {
    await handlePaymentFailed(payment, reason, metadata);
    return { updated: false };
  }

  const db = await createTenantServiceClient(businessId);
  const { data: updated, error } = await db
    .from("payments")
    .update({
      status: "pending",
      processing_started_at: null,
      payment_method_type: null,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
    })
    .eq("id", payment.id)
    .eq("status", "processing")
    .select()
    .maybeSingle();
  if (error) throw new Error(`Failed to reopen payment ${payment.id}: ${error.message}`);
  if (!updated) return { updated: false };

  if (payment.stripe_payment_link_id) {
    try {
      const { stripe, requestOptions } = getStripeForStoredAccount(payment.stripe_account_id);
      if (requestOptions) await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: true }, requestOptions);
      else await stripe.paymentLinks.update(payment.stripe_payment_link_id, { active: true });
    } catch (err) {
      console.error(`[stripe-webhook] Failed to reactivate payment link for ${payment.id}:`, err instanceof Error ? err.message : err);
    }
  }

  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;
  const failedAttempt = payment.stripe_payment_intent_id ?? payment.processing_started_at ?? "attempt";
  await logProjectActivity("payment_requested", `Bank payment failed: ${amountStr} (${reason}). The project stays delivered; the payment is due again.`, {
    businessId,
    projectId: payment.project_id,
    idempotencyKey: `payment:${payment.id}:bank-failed:${failedAttempt}`,
    metadata: { paymentId: payment.id, reason },
  });

  const { data: project } = await db.from("projects").select("project_name").eq("id", payment.project_id).maybeSingle();
  const projectLabel = project?.project_name || payment.description;

  // Always tell the business: files may already have been downloaded.
  await notifyAdmins({
    businessId,
    type: "payment_received",
    eventKey: "payment_failed",
    title: "Bank payment failed",
    body: `The ${amountStr} bank payment for ${projectLabel} did not go through (${reason}). The client has been asked to pay again.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
  });

  await notifyProjectClients({
    businessId,
    type: "invoice_available",
    eventKey: "payment_link_sent",
    title: "Bank payment didn't go through",
    body: `Your ${amountStr} bank payment for ${projectLabel} didn't go through. Please pay again from your project.`,
    link: `/dashboard/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
  });

  return { updated: true };
}

/**
 * Global lookup by Stripe IDs / payment UUID. The webhook has no tenant
 * context; these indexes are unique. Callers MUST run
 * checkPaymentBusinessAttribution before writing.
 */
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
  session: Stripe.Checkout.Session,
  stripeAccountId?: string | null
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
      const { stripe, requestOptions } = getStripeForStoredAccount(stripeAccountId);
      const intent = requestOptions
        ? await stripe.paymentIntents.retrieve(paymentIntentId, {}, requestOptions)
        : await stripe.paymentIntents.retrieve(paymentIntentId);
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

export async function resolvePaymentFromCharge(
  charge: Stripe.Charge,
  stripeAccountId?: string | null
): Promise<Payment | null> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  let metadata = charge.metadata ?? {};

  if (!parsePaymentIdFromMetadata(metadata) && paymentIntentId) {
    try {
      const { stripe, requestOptions } = getStripeForStoredAccount(stripeAccountId);
      const intent = requestOptions
        ? await stripe.paymentIntents.retrieve(paymentIntentId, {}, requestOptions)
        : await stripe.paymentIntents.retrieve(paymentIntentId);
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

export async function handlePaymentFailed(payment: Payment, reason: string, metadata?: Stripe.Metadata | null) {
  const attribution = checkPaymentBusinessAttribution(payment, metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] refusing payment failure write — cannot attribute business", {
      paymentId: payment.id,
      reason: attribution.reason,
      paymentBusinessId: attribution.paymentBusinessId,
      metadataBusinessId: attribution.metadataBusinessId,
    });
    return;
  }
  const businessId = attribution.businessId;
  const appSettings = await getAppSettings(businessId);

  await logProjectActivity("payment_requested", `Payment attempt failed: ${reason}`, {
    businessId,
    projectId: payment.project_id,
    metadata: { paymentId: payment.id, reason },
  });

  if (appSettings.workflow.payments.notifyAdminOnFailure) {
    await notifyAdmins({
      businessId,
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

export async function handleCheckoutExpired(
  payment: Payment,
  metadata?: Stripe.Metadata | null,
  context?: { session: Pick<Stripe.Checkout.Session, "id" | "ui_mode" | "expires_at" | "payment_link">; eventCreated: number }
) {
  if (context) {
    const { session, eventCreated } = context;
    // In-app checkouts restart on their own, and sessions ShootPortal closed (replaced, settled,
    // cancelled) or that the row no longer uses need no admin follow-up.
    // Webhook payloads render at the endpoint's API version: older versions call in-app
    // ("elements") sessions "custom".
    if ((session.ui_mode as string | null) === "elements" || (session.ui_mode as string | null) === "custom") return;
    if (wasClosedEarly(session, eventCreated)) return;
    if (!session.payment_link && session.id !== payment.stripe_checkout_session_id) return;
  }
  const attribution = checkPaymentBusinessAttribution(payment, metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] refusing checkout-expired write — cannot attribute business", {
      paymentId: payment.id,
      reason: attribution.reason,
      paymentBusinessId: attribution.paymentBusinessId,
      metadataBusinessId: attribution.metadataBusinessId,
    });
    return;
  }
  const businessId = attribution.businessId;

  await logProjectActivity("payment_requested", "Checkout session expired — payment link still active", {
    businessId,
    projectId: payment.project_id,
    metadata: { paymentId: payment.id },
  });

  await notifyAdmins({
    businessId,
    type: "invoice_available",
    eventKey: "payment_link_sent",
    title: "Checkout session expired",
    body: `Client checkout expired for ${payment.description}. Resend the payment link if needed.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * For a payment tied to a proposal/quote: what the client still owes on that quote once this
 * payment counts (paid + processing). 0 for payments not tied to a quote, so standalone
 * invoices keep their existing "payment → Delivered" automation.
 */
async function remainingQuoteBalanceCents(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>,
  payment: Pick<Payment, "id" | "quote_id" | "amount">
): Promise<number> {
  if (!payment.quote_id) return 0;
  const { data: quote } = await db.from("project_quotes").select("total_cents").eq("id", payment.quote_id).maybeSingle();
  const total = (quote as { total_cents?: number } | null)?.total_cents ?? 0;
  if (total <= 0) return 0;
  const { data: rows } = await db.from("payments").select("id, amount, status").eq("quote_id", payment.quote_id);
  return quoteBalanceAfterPaymentCents(total, rows ?? [], payment);
}

/** Pure: quote balance once `payment` counts, alongside the other paid/processing rows. */
export function quoteBalanceAfterPaymentCents(
  quoteTotalCents: number,
  rows: { id: string; amount: number; status: string }[],
  payment: { id: string; amount: number }
): number {
  let covered = payment.amount;
  for (const row of rows) {
    if (row.id !== payment.id && isPaymentCovered(row.status)) covered += row.amount;
  }
  return Math.max(0, quoteTotalCents - covered);
}

/** Pure: does an incoming Stripe payment look like a second charge for this row? */
export function classifyUnexpectedStripePayment(
  payment: Pick<Payment, "status" | "stripe_payment_intent_id" | "payment_method_type">,
  paymentIntentId: string | undefined,
  source: string
): "duplicate" | "not_payable" | null {
  if (!paymentIntentId || source === "manual_admin") return null;
  if (paymentIntentId === payment.stripe_payment_intent_id) return null;
  if (payment.status === "cancelled" || payment.status === "failed" || payment.status === "expired") return "not_payable";
  if (payment.status === "processing") return "duplicate";
  if (payment.status === "paid" && (Boolean(payment.stripe_payment_intent_id) || payment.payment_method_type === "manual")) return "duplicate";
  return null;
}

/**
 * Stripe reports money for a row that is already settled with a different PaymentIntent, or
 * that is no longer payable (cancelled / refunded). The client may have been charged twice:
 * never ignore it silently. Logged on the project (excluded from revenue) and the business is
 * told to review and refund in Stripe. Idempotent per PaymentIntent.
 */
async function flagUnexpectedStripePayment(
  businessId: string,
  payment: Payment,
  paymentIntentId: string | undefined,
  source: string
): Promise<void> {
  const kind = classifyUnexpectedStripePayment(payment, paymentIntentId, source);
  if (!kind || !paymentIntentId) return;
  const notPayable = kind === "not_payable";

  const amountStr = formatCents(payment.amount);
  const reason = notPayable
    ? `a ${payment.status} payment request`
    : payment.payment_method_type === "manual"
      ? "a payment you already marked as paid"
      : "a payment that was already paid";
  console.error("[stripe-payments] unexpected Stripe payment for settled/closed row", {
    paymentId: payment.id,
    status: payment.status,
    storedPaymentIntentId: payment.stripe_payment_intent_id,
    incomingPaymentIntentId: paymentIntentId,
    source,
  });
  const key = `payment:unexpected-charge:${payment.id}:${paymentIntentId}`;
  await logProjectActivity(
    "payment_requested",
    `Possible duplicate charge: Stripe payment ${paymentIntentId} received for ${reason} (${amountStr}) — not counted as revenue`,
    {
      businessId,
      projectId: payment.project_id,
      idempotencyKey: key,
      metadata: { paymentId: payment.id, stripePaymentIntentId: paymentIntentId, status: payment.status, excludedFromRevenue: true, source },
    }
  );
  await notifyAdmins({
    businessId,
    type: "payment_received",
    eventKey: "payment_received",
    title: "Review possible duplicate payment",
    body: `Stripe received another ${amountStr} payment for ${reason} (${payment.description}). Check Stripe and refund the extra charge if it wasn't intended.`,
    link: `/admin/projects/${payment.project_id}#payments`,
    projectId: payment.project_id,
    paymentId: payment.id,
    idempotencyKey: key,
  });
}
