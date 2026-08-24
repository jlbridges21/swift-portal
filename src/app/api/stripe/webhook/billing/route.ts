import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { isStripeEventProcessed, markStripeEventProcessed } from "@/lib/stripe-webhook-events";
import {
  isShootPortalBillingMetadata,
  resolveBillingBusinessAttribution,
  syncFromStripeSubscription,
  invoiceSubscriptionId,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

function logBilling(message: string, data: Record<string, unknown>) {
  console.info(`[stripe-billing-webhook] ${message}`, JSON.stringify(data));
}

async function handleSubscriptionObject(
  subscription: Stripe.Subscription,
  source: string
): Promise<void> {
  const result = await syncFromStripeSubscription(subscription, source);
  logBilling("subscription sync", {
    source,
    subscriptionId: subscription.id,
    status: subscription.status,
    applied: result.applied,
    reason: result.reason,
  });

  try {
    const { maybeApplyPendingReferralDiscountFromSubscription } = await import(
      "@/lib/partner-referral-discount"
    );
    const discount = await maybeApplyPendingReferralDiscountFromSubscription(
      subscription,
      source
    );
    if (discount.applied || discount.reason !== "not_pending") {
      logBilling("referral discount apply", {
        source,
        subscriptionId: subscription.id,
        ...discount,
      });
    }
  } catch (err) {
    console.error("[stripe-billing-webhook] referral discount apply FAILED (non-fatal)", {
      source,
      subscriptionId: subscription.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logBilling("missing signature", {});
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-billing-webhook] STRIPE_BILLING_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe-billing-webhook] Signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logBilling("event received", { eventType: event.type, eventId: event.id });

  if (await isStripeEventProcessed(event.id)) {
    logBilling("duplicate event skipped", { eventType: event.type, eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  let recordEvent = false;
  let recordBusinessId: string | null = null;

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (!isShootPortalBillingMetadata(subscription.metadata)) {
          logBilling("rejected — not shootportal billing subscription", {
            eventType: event.type,
            subscriptionId: subscription.id,
          });
          // Do not mark processed — might be misrouted; allow retry after config fix.
          break;
        }
        await handleSubscriptionObject(subscription, event.type);
        recordEvent = true;
        recordBusinessId = subscription.metadata.business_id ?? null;
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          logBilling("rejected — not subscription checkout (tenant→client must use payments webhook)", {
            eventType: event.type,
            sessionId: session.id,
            mode: session.mode,
          });
          break;
        }
        if (!isShootPortalBillingMetadata(session.metadata)) {
          logBilling("rejected — missing shootportal_billing marker", {
            eventType: event.type,
            sessionId: session.id,
          });
          break;
        }

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const attribution = await resolveBillingBusinessAttribution({
          metadata: session.metadata,
          customerId,
          source: event.type,
        });
        if (!attribution.ok) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (!subscriptionId) {
          logBilling("checkout completed without subscription id", {
            sessionId: session.id,
            businessId: attribution.business.id,
          });
          recordEvent = true;
          recordBusinessId = attribution.business.id;
          break;
        }

        const { stripe } = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await handleSubscriptionObject(subscription, event.type);
        recordEvent = true;
        recordBusinessId = attribution.business.id;
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) {
          logBilling("invoice ignored — no subscription (not ShootPortal billing)", {
            eventType: event.type,
            invoiceId: invoice.id,
          });
          break;
        }

        const { stripe } = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subId);
        if (!isShootPortalBillingMetadata(subscription.metadata)) {
          logBilling("invoice rejected — subscription not shootportal billing", {
            eventType: event.type,
            invoiceId: invoice.id,
            subscriptionId: subId,
          });
          break;
        }

        await handleSubscriptionObject(subscription, event.type);
        if (event.type === "invoice.paid") {
          const businessId = subscription.metadata.business_id ?? null;
          if (businessId) {
            const { recordPlatformSubscriptionPayment } = await import("@/lib/platform-revenue");
            const recorded = await recordPlatformSubscriptionPayment(invoice, businessId, {
              stripeEventId: event.id,
            });
            logBilling("subscription payment ledger", {
              invoiceId: invoice.id,
              businessId,
              ...recorded,
            });
          }
        }
        recordEvent = true;
        recordBusinessId = subscription.metadata.business_id ?? null;
        break;
      }

      case "charge.refunded": {
        // Subscription refunds: Charge → PaymentIntent → invoicePayments → invoice.
        // charge.invoice is often absent on API 2025-03-31.basil+.
        // Chargebacks (charge.dispute.*) intentionally NOT handled in V1 — disputes
        // are provisional; lost disputes usually surface as refunds. Avoid double
        // accounting until payout clawback exists (phase 5).
        const charge = event.data.object as Stripe.Charge;
        try {
          const { handleChargeRefundedCommission } = await import("@/lib/partner-commissions");
          const result = await handleChargeRefundedCommission(charge, event.id);
          logBilling("partner commission refund reversal", {
            chargeId: charge.id,
            ...result,
          });
        } catch (err) {
          console.error("[stripe-billing-webhook] partner refund reversal FAILED (returning 200)", {
            chargeId: charge.id,
            eventId: event.id,
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        recordEvent = true;
        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.id) break;
        try {
          const { maybeReverseCommissionForVoid } = await import("@/lib/partner-commissions");
          const result = await maybeReverseCommissionForVoid({
            stripeInvoiceId: invoice.id,
            stripeEventId: event.id,
          });
          logBilling("partner commission void reversal", {
            invoiceId: invoice.id,
            ...result,
          });
        } catch (err) {
          console.error("[stripe-billing-webhook] partner void reversal FAILED (returning 200)", {
            invoiceId: invoice.id,
            eventId: event.id,
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        recordEvent = true;
        break;
      }

      default:
        logBilling("event ignored", { eventType: event.type });
        break;
    }
  } catch (err) {
    console.error(`[stripe-billing-webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  if (recordEvent) {
    await markStripeEventProcessed(event.id, event.type, recordBusinessId);
  }

  return NextResponse.json({ received: true });
}
