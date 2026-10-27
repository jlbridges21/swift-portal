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
}): Stripe.Checkout.SessionCreateParams {
  const { payment, method, feeCents, metadata, appUrl } = args;
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

  return {
    mode: "payment",
    line_items: lineItems,
    ...methodParams,
    metadata,
    payment_intent_data: { metadata },
    client_reference_id: payment.id,
    success_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=${method === "bank" ? "bank_started" : "success"}#payments`,
    cancel_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=cancelled#payments`,
  };
}
