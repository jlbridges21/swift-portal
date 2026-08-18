import Stripe from "stripe";

const stripeClients = new Map<string, Stripe>();

/** Optional per-business secret for Stripe Connect (prompt 16). Same key/version today. */
export function getStripe(config?: { secretKey?: string }): Stripe {
  const secretKey = config?.secretKey ?? process.env.STRIPE_SECRET_KEY!;
  const existing = stripeClients.get(secretKey);
  if (existing) return existing;

  const instance = new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  stripeClients.set(secretKey, instance);
  return instance;
}
