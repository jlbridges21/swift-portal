import { cache } from "react";
import { getAppSettings } from "@/lib/app-settings";
import { getStripe } from "@/lib/stripe";
import { isPlatformStripeBusiness, loadBusinessStripeIntegration, retrieveConnectedAccount } from "@/lib/stripe-connect";

export type W9CountryDecision = {
  us: boolean;
  /** Address when the business has one; otherwise the Stripe account country. */
  source: "address" | "stripe" | "unknown";
  country: string;
};

const US = new Set(["us", "usa", "united states", "united states of america"]);

export function isUnitedStatesCountry(value: string): boolean {
  return US.has(value.trim().toLowerCase().replace(/\./g, ""));
}

/**
 * The business address country is the address that would be printed on the
 * W-9, so it wins when it is filled in. When it is blank, the Stripe account
 * country is the country collected at account creation (the connected account,
 * or the platform account for the legacy Swift business). If neither is known,
 * the section stays hidden.
 */
export const w9CountryDecision = cache(async (businessId: string): Promise<W9CountryDecision> => {
  const settings = await getAppSettings(businessId);
  const addressCountry = settings.business.country?.trim() ?? "";
  if (addressCountry) {
    return { us: isUnitedStatesCountry(addressCountry), source: "address", country: addressCountry };
  }

  try {
    const country = await stripeAccountCountry(businessId);
    if (!country) return { us: false, source: "unknown", country: "" };
    return { us: isUnitedStatesCountry(country), source: "stripe", country };
  } catch {
    return { us: false, source: "unknown", country: "" };
  }
});

async function stripeAccountCountry(businessId: string): Promise<string | null> {
  if (isPlatformStripeBusiness(businessId)) {
    const { stripe } = getStripe();
    const account = await stripe.accounts.retrieveCurrent();
    return account.country ?? null;
  }
  const integration = await loadBusinessStripeIntegration(businessId);
  if (!integration?.stripe_account_id) return null;
  const account = await retrieveConnectedAccount(integration.stripe_account_id);
  return account.country ?? null;
}
