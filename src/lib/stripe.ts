import Stripe from "stripe";

const stripeClients = new Map<string, Stripe>();

/** Per-request Connect options. Omit entirely for the platform account (Swift). */
export type StripeConnectRequestOptions = { stripeAccount: string };

export type StripeClientContext = {
  stripe: Stripe;
  /**
   * Present only when charging a connected account. `undefined` means no
   * Stripe-Account header — byte-identical to a single-argument SDK call.
   */
  requestOptions: StripeConnectRequestOptions | undefined;
};

/**
 * Cached Stripe client keyed by secret (prompt 7 Map). Request options include
 * `{ stripeAccount }` only when a connected account id is provided.
 *
 * Do not set `stripeAccount` on the Stripe constructor — the Map is shared
 * across businesses that all use the platform secret.
 */
export function getStripe(config?: {
  secretKey?: string;
  stripeAccount?: string | null;
}): StripeClientContext {
  const secretKey = config?.secretKey ?? process.env.STRIPE_SECRET_KEY!;
  let instance = stripeClients.get(secretKey);
  if (!instance) {
    instance = new Stripe(secretKey, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
    stripeClients.set(secretKey, instance);
  }

  const account = config?.stripeAccount?.trim() || null;
  return {
    stripe: instance,
    requestOptions: account ? { stripeAccount: account } : undefined,
  };
}
