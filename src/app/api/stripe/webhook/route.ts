import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import {
  checkPaymentBusinessAttribution,
  findPaymentFromStripe,
  handleCheckoutExpired,
  handlePaymentFailed,
  handlePaymentSuccess,
  resolvePaymentFromCheckoutSession,
  resolvePaymentFromPaymentIntent,
} from "@/lib/stripe-payments";
import { sanitizeMetadataForLog } from "@/lib/stripe-metadata";
import { isStripeEventProcessed, markStripeEventProcessed } from "@/lib/stripe-webhook-events";
import { shouldSkipInvoiceAsShootPortalBilling } from "@/lib/stripe-billing";
import { loadStripeReceipt, stripeIdsFromInvoice } from "@/lib/stripe-receipt";
import Stripe from "stripe";

export const runtime = "nodejs";

function logWebhook(message: string, data: Record<string, unknown>) {
  console.info(`[stripe-webhook] ${message}`, JSON.stringify(data));
}

async function processPaymentSuccess(
  eventType: string,
  payment: Awaited<ReturnType<typeof resolvePaymentFromCheckoutSession>>,
  options: {
    checkoutSessionId?: string;
    paymentIntentId?: string;
    receiptUrl?: string | null;
    cardLast4?: string | null;
    metadata?: Stripe.Metadata | null;
  }
) {
  if (!payment) {
    logWebhook("payment not found", {
      eventType,
      metadata: sanitizeMetadataForLog(options.metadata),
      checkoutSessionId: options.checkoutSessionId,
      paymentIntentId: options.paymentIntentId,
    });
    return;
  }

  const attribution = checkPaymentBusinessAttribution(payment, options.metadata);
  if (!attribution.ok) {
    console.error("[stripe-webhook] business attribution failed — writing nothing", {
      eventType,
      paymentId: payment.id,
      reason: attribution.reason,
      paymentBusinessId: attribution.paymentBusinessId,
      metadataBusinessId: attribution.metadataBusinessId,
    });
    return;
  }

  logWebhook("payment resolved", {
    eventType,
    paymentId: payment.id,
    paymentStatus: payment.status,
    businessId: attribution.businessId,
    metadata: sanitizeMetadataForLog(options.metadata),
  });

  try {
    const result = await handlePaymentSuccess({
      payment,
      checkoutSessionId: options.checkoutSessionId,
      paymentIntentId: options.paymentIntentId,
      receiptUrl: options.receiptUrl,
      cardLast4: options.cardLast4,
      source: eventType,
      metadata: options.metadata,
    });

    logWebhook("payment update complete", {
      eventType,
      paymentId: result.paymentId,
      businessId: result.businessId,
      alreadyPaid: result.alreadyPaid,
      updated: result.updated,
    });
  } catch (err) {
    logWebhook("payment update failed", {
      eventType,
      paymentId: payment.id,
      businessId: payment.business_id,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logWebhook("missing signature", {});
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe-webhook] Signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logWebhook("event received", { eventType: event.type, eventId: event.id });

  if (await isStripeEventProcessed(event.id)) {
    logWebhook("duplicate event skipped", { eventType: event.type, eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  let recordEvent = false;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Flow A (ShootPortal SaaS) must never touch payment records — billing webhook owns it.
        if (session.mode === "subscription") {
          logWebhook("checkout session skipped — ShootPortal subscription (billing webhook)", {
            eventType: event.type,
            sessionId: session.id,
            mode: session.mode,
            metadata: sanitizeMetadataForLog(session.metadata),
          });
          // Do NOT mark processed — billing endpoint may share this evt_ id.
          break;
        }

        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          logWebhook("checkout session skipped — unpaid", {
            eventType: event.type,
            sessionId: session.id,
            paymentStatus: session.payment_status,
          });
          break;
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        const payment = await resolvePaymentFromCheckoutSession(session);
        const receipt = await loadStripeReceipt({
          paymentIntentId,
          stripeAccountId: payment?.stripe_account_id,
        });

        await processPaymentSuccess(event.type, payment, {
          checkoutSessionId: session.id,
          paymentIntentId,
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          metadata: session.metadata,
        });
        recordEvent = true;
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await resolvePaymentFromCheckoutSession(session);
        if (payment && payment.status === "pending") {
          logWebhook("checkout session expired", {
            eventType: event.type,
            paymentId: payment.id,
            businessId: payment.business_id,
          });
          await handleCheckoutExpired(payment, session.metadata);
        }
        recordEvent = true;
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        if (!payment) {
          logWebhook("payment_intent skipped — no matching payment", {
            eventType: event.type,
            paymentIntentId: intent.id,
            metadata: sanitizeMetadataForLog(intent.metadata),
          });
          break;
        }

        if (payment.stripe_checkout_session_id) {
          logWebhook("payment_intent skipped — handled by checkout.session.completed", {
            eventType: event.type,
            paymentId: payment.id,
            businessId: payment.business_id,
            checkoutSessionId: payment.stripe_checkout_session_id,
          });
          recordEvent = true;
          break;
        }

        const receipt = await loadStripeReceipt({
          paymentIntentId: intent.id,
          stripeAccountId: payment.stripe_account_id,
        });
        await processPaymentSuccess(event.type, payment, {
          paymentIntentId: intent.id,
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          metadata: intent.metadata,
        });
        recordEvent = true;
        break;
      }

      case "charge.succeeded": {
        logWebhook("charge.succeeded ignored — checkout.session.completed is authoritative", {
          eventType: event.type,
          chargeId: (event.data.object as Stripe.Charge).id,
        });
        recordEvent = true;
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        if (payment) {
          logWebhook("payment failed", {
            eventType: event.type,
            paymentId: payment.id,
            businessId: payment.business_id,
          });
          await handlePaymentFailed(
            payment,
            intent.last_payment_error?.message || "Payment failed",
            intent.metadata
          );
        }
        recordEvent = true;
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const skip = await shouldSkipInvoiceAsShootPortalBilling(invoice);
        if (skip.skip) {
          logWebhook("invoice.paid skipped — ShootPortal subscription billing", {
            eventType: event.type,
            invoiceId: invoice.id,
            reason: skip.reason,
          });
          // Do NOT mark processed — billing webhook owns this event.
          break;
        }

        const payment = await findPaymentFromStripe({
          metadata: invoice.metadata,
        });
        const invoiceIds = stripeIdsFromInvoice(invoice);
        const receipt = await loadStripeReceipt({
          paymentIntentId: invoiceIds.paymentIntentId,
          chargeId: invoiceIds.chargeId,
          stripeAccountId: payment?.stripe_account_id,
        });
        await processPaymentSuccess(event.type, payment, {
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          metadata: invoice.metadata,
        });
        recordEvent = true;
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const skip = await shouldSkipInvoiceAsShootPortalBilling(invoice);
        if (skip.skip) {
          logWebhook("invoice.payment_failed skipped — ShootPortal subscription billing", {
            eventType: event.type,
            invoiceId: invoice.id,
            reason: skip.reason,
          });
          break;
        }

        const payment = await findPaymentFromStripe({
          metadata: invoice.metadata,
        });
        if (payment) {
          logWebhook("invoice payment failed", {
            eventType: event.type,
            paymentId: payment.id,
            businessId: payment.business_id,
          });
          await handlePaymentFailed(payment, "Invoice payment failed", invoice.metadata);
        }
        recordEvent = true;
        break;
      }

      default:
        logWebhook("event ignored", { eventType: event.type });
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  if (recordEvent) {
    await markStripeEventProcessed(event.id, event.type);
  }

  return NextResponse.json({ received: true });
}
