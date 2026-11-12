import type Stripe from "stripe";
import { CARD_FEE_LINE_NAME } from "@/lib/card-fee";
import type { Payment } from "@/lib/types";

/**
 * Stripe Checkout Session parameters for a client payment. Pure, so the exact shape the app
 * sends to Stripe is covered by the test-mode end-to-end check.
 *
 * - bank: ACH Direct Debit only, verified instantly through the client's bank login
 *   (Financial Connections) with microdeposits as the fallback.
 * - card: everything the business offers in Stripe except bank debit. With the card fee on,
 *   cards only, so the "Card processing fee" label stays true.
 */
export function buildPaymentCheckoutParams(args: {
  payment: Pick<Payment, "id" | "amount" | "description" | "project_id">;
  method: "card" | "bank";
  feeCents: number;
  metadata: Stripe.MetadataParam;
  appUrl: string;
  /**
   * "marketing" returns the client to the project's Marketing Kit instead of Payments.
   * `{ path }` returns to another same-origin page (the public /pay/{token} page).
   */
  returnTo?: CheckoutReturnTarget;
  /**
   * "hosted" (default) redirects to checkout.stripe.com. "elements" renders the Payment Element
   * inside ShootPortal (Checkout Sessions + `ui_mode: "elements"`); Stripe only sends the client
   * to `return_url` when a payment method needs a redirect (some bank or wallet flows).
   */
  uiMode?: "hosted" | "elements";
  /** Prefills the receipt email for embedded checkout (Stripe requires one before confirming). */
  customerEmail?: string | null;
}): Stripe.Checkout.SessionCreateParams {
  const { payment, method, feeCents, metadata, appUrl } = args;
  const back = checkoutReturnLocation(payment.project_id, args.returnTo);
  const fee = method === "card" ? Math.max(0, Math.round(feeCents)) : 0;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: payment.description.slice(0, 250) },
        unit_amount: payment.amount,
      },
      quantity: 1,
    },
  ];
  if (fee > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: CARD_FEE_LINE_NAME, description: "Pay by bank transfer to avoid this fee." },
        unit_amount: fee,
      },
      quantity: 1,
    });
  }

  const methodParams: Pick<Stripe.Checkout.SessionCreateParams, "payment_method_types" | "payment_method_options" | "excluded_payment_method_types"> =
    method === "bank"
      ? {
          payment_method_types: ["us_bank_account"],
          payment_method_options: {
            us_bank_account: {
              verification_method: "automatic",
              financial_connections: { permissions: ["payment_method"] },
            },
          },
        }
      : fee > 0
        ? { payment_method_types: ["card"] }
        : { excluded_payment_method_types: ["us_bank_account"] };

  const common: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    ...methodParams,
    metadata,
    payment_intent_data: { metadata },
    client_reference_id: payment.id,
  };

  if (args.uiMode === "elements") {
    const email = args.customerEmail?.trim();
    const sep = back.path.includes("?") ? "&" : "?";
    return {
      ...common,
      ui_mode: "elements",
      ...(email && SIMPLE_EMAIL_RE.test(email) ? { customer_email: email } : {}),
      // {CHECKOUT_SESSION_ID} is filled in by Stripe; the page verifies the session server-side.
      return_url: `${appUrl}${back.path}${sep}payment=returned&payment_id=${payment.id}&session_id={CHECKOUT_SESSION_ID}${back.hash}`,
    };
  }

  return {
    ...common,
    success_url: `${appUrl}${back.path}?payment=${method === "bank" ? "bank_started" : "success"}${back.hash}`,
    cancel_url: `${appUrl}${back.path}?payment=cancelled${back.hash}`,
  };
}

export type CheckoutReturnTarget = "payments" | "marketing" | { path: string };

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkoutReturnLocation(projectId: string, target: CheckoutReturnTarget | undefined): { path: string; hash: string } {
  if (target && typeof target === "object") {
    // Same-origin paths only — never an absolute URL from a caller.
    const path = target.path.startsWith("/") && !target.path.startsWith("//") ? target.path : `/dashboard/projects/${projectId}`;
    return { path, hash: "" };
  }
  return target === "marketing"
    ? { path: `/dashboard/projects/${projectId}/marketing`, hash: "" }
    : { path: `/dashboard/projects/${projectId}`, hash: "#payments" };
}
