import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import {
  applyStripeAccountSnapshot,
  connectEventAccountId,
  loadIntegrationByStripeAccount,
  markStripeAccountDisabled,
} from "@/lib/stripe-connect";
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
import type { Payment } from "@/lib/types";
import Stripe from "stripe";

export const runtime = "nodejs";

function logConnect(message: string, data: Record<string, unknown>) {
  console.info(`[stripe-connect-webhook] ${message}`, JSON.stringify(data));
}

async function processConnectPaymentSuccess(
  eventType: string,
  connectBusinessId: string,
  payment: Payment | null,
  options: {
    checkoutSessionId?: string;
    paymentIntentId?: string;
    receiptUrl?: string | null;
    metadata?: Stripe.Metadata | null;
  }
) {
  if (!payment) {
    logConnect("payment not found", {
      eventType,
      connectBusinessId,
      metadata: sanitizeMetadataForLog(options.metadata),
      checkoutSessionId: options.checkoutSessionId,
      paymentIntentId: options.paymentIntentId,
    });
    return;
  }

  const attribution = checkPaymentBusinessAttribution(payment, options.metadata);
  if (!attribution.ok) {
    console.error("[stripe-connect-webhook] business attribution failed — writing nothing", {
      eventType,
      paymentId: payment.id,
      reason: attribution.reason,
      paymentBusinessId: attribution.paymentBusinessId,
      metadataBusinessId: attribution.metadataBusinessId,
      connectBusinessId,
    });
    return;
  }

  if (attribution.businessId !== connectBusinessId) {
    console.error("[stripe-connect-webhook] payment business does not match connected account — writing nothing", {
      eventType,
      paymentId: payment.id,
      paymentBusinessId: attribution.businessId,
      connectBusinessId,
    });
    return;
  }

  await handlePaymentSuccess({
    payment,
    checkoutSessionId: options.checkoutSessionId,
    paymentIntentId: options.paymentIntentId,
    receiptUrl: options.receiptUrl,
    source: eventType,
    metadata: options.metadata,
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

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          recordEvent = true;
          break;
        }
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const payment = await resolvePaymentFromCheckoutSession(session, connectedAccountId);
        const receiptUrl =
          (session as { receipt_url?: string | null }).receipt_url ||
          (typeof session.invoice === "object" && session.invoice
            ? (session.invoice as Stripe.Invoice).hosted_invoice_url
            : null);
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          checkoutSessionId: session.id,
          paymentIntentId,
          receiptUrl,
          metadata: session.metadata,
        });
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
        if (payment.stripe_checkout_session_id) {
          recordEvent = true;
          break;
        }
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          paymentIntentId: intent.id,
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
            await handlePaymentFailed(
              payment,
              intent.last_payment_error?.message || "Payment failed",
              intent.metadata
            );
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
        await processConnectPaymentSuccess(event.type, connectBusinessId, payment, {
          receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
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
