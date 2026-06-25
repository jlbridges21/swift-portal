import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import {
  findPaymentFromSession,
  handleCheckoutExpired,
  handlePaymentFailed,
  handlePaymentSuccess,
} from "@/lib/stripe-payments";
import Stripe from "stripe";

export const runtime = "nodejs";

async function resolvePayment(session: Stripe.Checkout.Session): Promise<import("@/lib/types").Payment | null> {
  const meta = session.metadata ?? {};
  return findPaymentFromSession({
    payment_id: meta.payment_id,
    payment_link: (session.payment_link as string) || undefined,
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          break;
        }
        const payment = await resolvePayment(session);
        if (payment) {
          const receiptUrl =
            (session as { receipt_url?: string | null }).receipt_url ||
            (typeof session.invoice === "object" && session.invoice
              ? (session.invoice as Stripe.Invoice).hosted_invoice_url
              : null);
          await handlePaymentSuccess({
            payment,
            checkoutSessionId: session.id,
            receiptUrl,
            source: event.type,
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await resolvePayment(session);
        if (payment && payment.status === "pending") {
          await handleCheckoutExpired(payment);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await findPaymentFromSession({
          payment_id: intent.metadata?.payment_id,
        });
        if (payment) {
          await handlePaymentSuccess({
            payment,
            receiptUrl: null,
            source: event.type,
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await findPaymentFromSession({
          payment_id: intent.metadata?.payment_id,
        });
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
        const payment = await findPaymentFromSession({
          payment_id: invoice.metadata?.payment_id,
        });
        if (payment) {
          await handlePaymentSuccess({
            payment,
            receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
            source: event.type,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const payment = await findPaymentFromSession({
          payment_id: invoice.metadata?.payment_id,
        });
        if (payment) {
          await handlePaymentFailed(payment, "Invoice payment failed");
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
