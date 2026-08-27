import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { connectEventAccountId } from "@/lib/stripe-connect";
import {
  applyPartnerStripeAccountSnapshot,
  loadPartnerByStripeConnectAccountId,
  markPartnerConnectDisabled,
} from "@/lib/partner-stripe-connect";
import { isStripeEventProcessed, markStripeEventProcessed } from "@/lib/stripe-webhook-events";
import type Stripe from "stripe";

export const runtime = "nodejs";

/**
 * FLOW C webhook — partner Express account.updated only.
 *
 * THIRD Stripe webhook concern (separate from billing + business Connect charges).
 * Uses STRIPE_PARTNER_CONNECT_WEBHOOK_SECRET.
 * Looks up partners.stripe_connect_account_id ONLY — never business_integrations.
 */

function logPartnerConnect(message: string, data: Record<string, unknown>) {
  console.info(`[stripe-partner-connect-webhook] ${message}`, JSON.stringify(data));
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_PARTNER_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[stripe-partner-connect-webhook] STRIPE_PARTNER_CONNECT_WEBHOOK_SECRET is not configured"
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe-partner-connect-webhook] Signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const connectedAccountId = connectEventAccountId(event);
  if (!connectedAccountId) {
    // account.updated on Connect often includes event.account; object.id is the fallback.
    const obj = event.data.object as { id?: string };
    if (typeof obj?.id === "string" && obj.id.startsWith("acct_")) {
      // use object id below
    } else {
      logPartnerConnect("ignored — no connected account id", {
        eventType: event.type,
        eventId: event.id,
      });
      return NextResponse.json({ received: true, ignored: true });
    }
  }

  const accountId =
    connectedAccountId ??
    ((event.data.object as { id?: string }).id?.startsWith("acct_")
      ? (event.data.object as { id: string }).id
      : null);

  if (!accountId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const partnerHit = await loadPartnerByStripeConnectAccountId(accountId);
  if (!partnerHit) {
    // Not a partner Express account — leave for the business Connect webhook.
    logPartnerConnect("unknown partner Connect account — writing nothing", {
      eventType: event.type,
      eventId: event.id,
      stripeAccount: accountId,
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  logPartnerConnect("event received", {
    eventType: event.type,
    eventId: event.id,
    partnerId: partnerHit.partnerId,
    stripeAccount: accountId,
  });

  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  let recordEvent = false;

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await applyPartnerStripeAccountSnapshot(partnerHit.partnerId, account);
        recordEvent = true;
        break;
      }
      case "account.application.deauthorized": {
        await markPartnerConnectDisabled(partnerHit.partnerId);
        recordEvent = true;
        break;
      }
      default:
        logPartnerConnect("event ignored", { eventType: event.type });
        break;
    }
  } catch (err) {
    console.error(`[stripe-partner-connect-webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  if (recordEvent) {
    // Platform-scoped partner events: no business_id — use null.
    await markStripeEventProcessed(event.id, event.type, null);
  }

  return NextResponse.json({ received: true });
}
