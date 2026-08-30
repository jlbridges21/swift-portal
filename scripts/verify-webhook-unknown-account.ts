/**
 * Simulate unrecognized Connect account events against webhook routes.
 * Usage: npx tsx scripts/verify-webhook-unknown-account.ts [baseUrl]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function signedPayload(secret: string, event: Stripe.Event): { body: string; signature: string } {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
  const body = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return { body, signature };
}

async function postWebhook(
  baseUrl: string,
  path: string,
  secret: string | undefined,
  event: Stripe.Event
): Promise<{ status: number; json: unknown }> {
  if (!secret) {
    return { status: -1, json: { error: "secret not configured in .env.local" } };
  }
  const { body, signature } = signedPayload(secret, event);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  loadEnvLocal();
  const baseUrl = process.argv[2]?.replace(/\/$/, "") || "http://localhost:3000";

  const unknownAccountId = "acct_unknown_simulation_00000001";
  const evtId = `evt_sim_${Date.now()}`;

  const accountUpdated: Stripe.Event = {
    id: evtId,
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "account.updated",
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: unknownAccountId,
        object: "account",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      } as Stripe.Account,
    },
  };
  // Connect events include event.account
  (accountUpdated as Stripe.Event & { account?: string }).account = unknownAccountId;

  console.log("Base URL:", baseUrl);
  console.log("Simulated account:", unknownAccountId);
  console.log("");

  const connect = await postWebhook(
    baseUrl,
    "/api/stripe/webhook/connect",
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    accountUpdated
  );
  console.log("POST /api/stripe/webhook/connect (unknown account)");
  console.log("  status:", connect.status);
  console.log("  body:", JSON.stringify(connect.json));

  const partner = await postWebhook(
    baseUrl,
    "/api/stripe/webhook/partner-connect",
    process.env.STRIPE_PARTNER_CONNECT_WEBHOOK_SECRET,
    accountUpdated
  );
  console.log("");
  console.log("POST /api/stripe/webhook/partner-connect (unknown business account)");
  console.log("  status:", partner.status);
  console.log("  body:", JSON.stringify(partner.json));

  if (connect.status !== 200 || partner.status !== 200) {
    console.error("\nFAIL: expected HTTP 200 for both unrecognized-account simulations");
    process.exit(1);
  }
  console.log("\nOK: both endpoints returned 200 for unrecognized accounts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
