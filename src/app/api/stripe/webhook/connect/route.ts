import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import {
  applyStripeAccountSnapshot,
  connectEventAccountId,
  loadIntegrationByStripeAccount,
  markStripeAccountDisabled,
} from "@/lib/stripe-connect";
import { loadPartnerByStripeConnectAccountId } from "@/lib/partner-stripe-connect";
import {
  checkPaymentBusinessAttribution,
  findPaymentFromStripe,
  handleBankPaymentFailed,
  handleCheckoutExpired,
  handlePaymentFailed,
  handlePaymentProcessing,
  handlePaymentSuccess,
  resolvePaymentFromCheckoutSession,
  resolvePaymentFromPaymentIntent,
} from "@/lib/stripe-payments";
import { parseClientFeeFromMetadata, sanitizeMetadataForLog } from "@/lib/stripe-metadata";
import { sessionIsProcessingBankPayment } from "@/lib/stripe-async-payments";
import { isStripeEventProcessed, markStripeEventProcessed } from "@/lib/stripe-webhook-events";
import { loadStripeReceipt, stripeIdsFromInvoice } from "@/lib/stripe-receipt";
import type { Payment } from "@/lib/types";
import Stripe from "stripe";

export const runtime = "nodejs";

function logConnect(message: string, data: Record<string, unknown>) {
  console.info(`[stripe-connect-webhook] ${message}`, JSON.stringify(data));
}

/** The payment exists and belongs to the business that owns this connected account. */
function connectPaymentMatches(
  eventType: string,
  connectBusinessId: string,
  payment: Payment | null,
  options: { checkoutSessionId?: string; paymentIntentId?: string; metadata?: Stripe.Metadata | null }
): payment is Payment {
  if (!payment) {
    logConnect("payment not found", {
      eventType,
      connectBusinessId,
      metadata: sanitizeMetadataForLog(options.metadata),
      checkoutSessionId: options.checkoutSessionId,
      paymentIntentId: options.paymentIntentId,
    });
    return false;
  }
  const attribution = checkPaymentBusinessAttribution(payment, options.metadata);
  if (!attribution.ok || attribution.businessId !== connectBusinessId) {
    console.error("[stripe-connect-webhook] payment business mismatch — writing nothing", {
      eventType,
      paymentId: payment.id,
      reason: attribution.ok ? "connected_account_mismatch" : attribution.reason,
      connectBusinessId,
    });
    return false;
  }
  return true;
}

async function processConnectPaymentProcessing(
  eventType: string,
  connectBusinessId: string,
  payment: Payment | null,
  options: { checkoutSessionId?: string; paymentIntentId?: string; metadata?: Stripe.Metadata | null }
) {
  if (!connectPaymentMatches(eventType, connectBusinessId, payment, options)) return;
  await handlePaymentProcessing({
    payment,
    checkoutSessionId: options.checkoutSessionId,
    paymentIntentId: options.paymentIntentId,
    source: eventType,
    metadata: options.metadata,
  });
}

async function processConnectPaymentSuccess(
  eventType: string,
  connectBusinessId: string,
  payment: Payment | null,
  options: {
    checkoutSessionId?: string;
    paymentIntentId?: string;
    receiptUrl?: string | null;
    cardLast4?: string | null;
    methodType?: "card" | "us_bank_account" | null;
    metadata?: Stripe.Metadata | null;
  }
) {
  if (!connectPaymentMatches(eventType, connectBusinessId, payment, options)) return;

  await handlePaymentSuccess({
    payment,
    checkoutSessionId: options.checkoutSessionId,
    paymentIntentId: options.paymentIntentId,
    receiptUrl: options.receiptUrl,
    cardLast4: options.cardLast4,
    source: eventType,
    metadata: options.metadata,
    paymentMethodType: options.methodType ?? null,
    clientFeeCents: parseClientFeeFromMetadata(options.metadata),
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logConnect("missing signature", {});
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe-connect-webhook] Signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const connectedAccountId = connectEventAccountId(event);
  if (!connectedAccountId) {
    logConnect("ignored — no event.account", { eventType: event.type, eventId: event.id });
    return NextResponse.json({ received: true, ignored: true });
  }

  const integration = await loadIntegrationByStripeAccount(connectedAccountId);
  if (!integration) {
    // Partner Express accounts are FLOW C — handled by /api/stripe/webhook/partner-connect.
    const partnerHit = await loadPartnerByStripeConnectAccountId(connectedAccountId);
    if (partnerHit) {
      logConnect("partner Express account — ignored here (flow C webhook owns it)", {
        eventType: event.type,
        eventId: event.id,
        stripeAccount: connectedAccountId,
        partnerId: partnerHit.partnerId,
      });
      return NextResponse.json({ received: true, ignored: true, flow: "partner_payouts" });
    }
    logConnect("unknown connected account — writing nothing", {
      eventType: event.type,
      eventId: event.id,
      stripeAccount: connectedAccountId,
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  const connectBusinessId = integration.business_id;
  logConnect("event received", {
    eventType: event.type,
    eventId: event.id,
    connectBusinessId,
    stripeAccount: connectedAccountId,
  });

  if (await isStripeEventProcessed(event.id)) {
    logConnect("duplicate event skipped", { eventType: event.type, eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  let recordEvent = false;

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await applyStripeAccountSnapshot(connectBusinessId, account);
        recordEvent = true;
        break;
      }

      case "account.application.deauthorized": {
        await markStripeAccountDisabled(connectBusinessId);
        recordEvent = true;
        break;
      }

      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          // Bank (ACH) debit authorized but not yet collected: mark it processing.
          if (await sessionIsProcessingBankPayment(session, connectedAccountId)) {
            const payment = await resolvePaymentFromCheckoutSession(session, connectedAccountId);
            await processConnectPaymentProcessing(event.type, connectBusinessId, payment, {
              checkoutSessionId: session.id,
              paymentIntentId,
              metadata: session.metadata,
            });
          }
          recordEvent = true;
          break;
        }
        const payment = await resolvePaymentFromCheckoutSession(session, connectedAccountId);
        const receipt = await loadStripeReceipt({
          paymentIntentId,
          stripeAccountId: connectedAccountId,
        });
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          checkoutSessionId: session.id,
          paymentIntentId,
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          methodType: receipt.methodType,
          metadata: session.metadata,
        });
        recordEvent = true;
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await resolvePaymentFromCheckoutSession(session, connectedAccountId);
        if (connectPaymentMatches(event.type, connectBusinessId, payment, { checkoutSessionId: session.id, metadata: session.metadata })) {
          await handleBankPaymentFailed(payment, "The bank declined the payment", session.metadata);
        }
        recordEvent = true;
        break;
      }

      case "payment_intent.processing": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.payment_method_types?.includes("us_bank_account")) {
          const payment = await resolvePaymentFromPaymentIntent(intent);
          await processConnectPaymentProcessing(event.type, connectBusinessId, payment, {
            paymentIntentId: intent.id,
            metadata: intent.metadata,
          });
        }
        recordEvent = true;
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await resolvePaymentFromCheckoutSession(session, connectedAccountId);
        if (payment) {
          const attribution = checkPaymentBusinessAttribution(payment, session.metadata);
          if (
            attribution.ok &&
            attribution.businessId === connectBusinessId &&
            payment.status === "pending"
          ) {
            await handleCheckoutExpired(payment, session.metadata);
          } else if (!attribution.ok || attribution.businessId !== connectBusinessId) {
            console.error("[stripe-connect-webhook] checkout.expired rejected — business mismatch", {
              paymentId: payment.id,
              paymentBusinessId: attribution.ok ? attribution.businessId : attribution.paymentBusinessId,
              connectBusinessId,
            });
          }
        }
        recordEvent = true;
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        if (!payment) {
          recordEvent = true;
          break;
        }
        // Checkout rows are recorded by checkout.session.* events — except a processing bank
        // payment, where this event is the backstop if async_payment_succeeded is not subscribed.
        if (payment.stripe_checkout_session_id && payment.status !== "processing") {
          recordEvent = true;
          break;
        }
        const receipt = await loadStripeReceipt({
          paymentIntentId: intent.id,
          stripeAccountId: connectedAccountId,
        });
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          paymentIntentId: intent.id,
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          methodType: receipt.methodType,
          metadata: intent.metadata,
        });
        recordEvent = true;
        break;
      }

      case "charge.succeeded": {
        recordEvent = true;
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        if (payment) {
          const attribution = checkPaymentBusinessAttribution(payment, intent.metadata);
          if (attribution.ok && attribution.businessId === connectBusinessId) {
            const reason = intent.last_payment_error?.message || "Payment failed";
            if (payment.status === "processing") await handleBankPaymentFailed(payment, reason, intent.metadata);
            else await handlePaymentFailed(payment, reason, intent.metadata);
          } else {
            console.error("[stripe-connect-webhook] payment_failed rejected — business mismatch", {
              paymentId: payment.id,
              paymentBusinessId: attribution.ok ? attribution.businessId : attribution.paymentBusinessId,
              connectBusinessId,
            });
          }
        }
        recordEvent = true;
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const payment = await findPaymentFromStripe({ metadata: invoice.metadata });
        const invoiceIds = stripeIdsFromInvoice(invoice);
        const receipt = await loadStripeReceipt({
          paymentIntentId: invoiceIds.paymentIntentId,
          chargeId: invoiceIds.chargeId,
          stripeAccountId: connectedAccountId,
        });
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          receiptUrl: receipt.receiptUrl,
          cardLast4: receipt.cardLast4,
          metadata: invoice.metadata,
        });
        recordEvent = true;
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const payment = await findPaymentFromStripe({ metadata: invoice.metadata });
        if (payment) {
          const attribution = checkPaymentBusinessAttribution(payment, invoice.metadata);
          if (attribution.ok && attribution.businessId === connectBusinessId) {
            await handlePaymentFailed(payment, "Invoice payment failed", invoice.metadata);
          } else {
            console.error("[stripe-connect-webhook] invoice.payment_failed rejected — business mismatch", {
              paymentId: payment.id,
              paymentBusinessId: attribution.ok ? attribution.businessId : attribution.paymentBusinessId,
              connectBusinessId,
            });
          }
        }
        recordEvent = true;
        break;
      }

      default:
        logConnect("event ignored", { eventType: event.type });
        break;
    }
  } catch (err) {
    console.error(`[stripe-connect-webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  if (recordEvent) {
    await markStripeEventProcessed(event.id, event.type, connectBusinessId);
  }

  return NextResponse.json({ received: true });
}
