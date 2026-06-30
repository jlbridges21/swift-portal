import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import {
  findPaymentFromStripe,
  handleCheckoutExpired,
  handlePaymentFailed,
  handlePaymentSuccess,
  resolvePaymentFromCharge,
  resolvePaymentFromCheckoutSession,
  resolvePaymentFromPaymentIntent,
} from "@/lib/stripe-payments";
import { sanitizeMetadataForLog } from "@/lib/stripe-metadata";
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

  logWebhook("payment resolved", {
    eventType,
    paymentId: payment.id,
    paymentStatus: payment.status,
    metadata: sanitizeMetadataForLog(options.metadata),
  });

  try {
    const result = await handlePaymentSuccess({
      payment,
      checkoutSessionId: options.checkoutSessionId,
      paymentIntentId: options.paymentIntentId,
      receiptUrl: options.receiptUrl,
      source: eventType,
    });

    logWebhook("payment update complete", {
      eventType,
      paymentId: result.paymentId,
      alreadyPaid: result.alreadyPaid,
      updated: result.updated,
    });
  } catch (err) {
    logWebhook("payment update failed", {
      eventType,
      paymentId: payment.id,
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
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe-webhook] Signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logWebhook("event received", { eventType: event.type, eventId: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
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
        const receiptUrl =
          (session as { receipt_url?: string | null }).receipt_url ||
          (typeof session.invoice === "object" && session.invoice
            ? (session.invoice as Stripe.Invoice).hosted_invoice_url
            : null);

        await processPaymentSuccess(event.type, payment, {
          checkoutSessionId: session.id,
          paymentIntentId,
          receiptUrl,
          metadata: session.metadata,
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await resolvePaymentFromCheckoutSession(session);
        if (payment && payment.status === "pending") {
          await handleCheckoutExpired(payment);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        await processPaymentSuccess(event.type, payment, {
          paymentIntentId: intent.id,
          metadata: intent.metadata,
        });
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        const payment = await resolvePaymentFromCharge(charge);
        await processPaymentSuccess(event.type, payment, {
          paymentIntentId,
          receiptUrl: charge.receipt_url ?? null,
          metadata: charge.metadata,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await resolvePaymentFromPaymentIntent(intent);
        if (payment) {
          await handlePaymentFailed(
            payment,
            intent.last_payment_error?.message || "Payment failed"
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const payment = await findPaymentFromStripe({
          metadata: invoice.metadata,
        });
        await processPaymentSuccess(event.type, payment, {
          receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
          metadata: invoice.metadata,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const payment = await findPaymentFromStripe({
          metadata: invoice.metadata,
        });
        if (payment) {
          await handlePaymentFailed(payment, "Invoice payment failed");
        }
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

  return NextResponse.json({ received: true });
}
