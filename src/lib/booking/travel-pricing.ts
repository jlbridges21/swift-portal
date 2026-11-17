/**
 * Travel fee pricing from Google Routes driving distance. Pure: no network, no database.
 * Replaces the ZIP-centroid model (travel-fee.ts / zip-distance.ts are no longer used for
 * new estimates; historical quotes keep the travel lines they were saved with).
 *
 * Miles in are ONE-WAY driving miles from the pricing origin to the property.
 */

import { formatCurrency } from "@/lib/utils";
import type { BookingSettings, TravelFeeTier, TravelPricingSettings } from "@/lib/booking/settings";

export const TRAVEL_FEE_LINE_PREFIX = "Travel Fee";

export type TravelQuote =
  | { outcome: "fee"; feeCents: number; oneWayMiles: number; label: string }
  | { outcome: "no_fee"; feeCents: 0; oneWayMiles: number; label: "" }
  | { outcome: "over_cap"; feeCents: 0; oneWayMiles: number; computedCents: number; label: "" }
  | { outcome: "disabled"; feeCents: 0; oneWayMiles: number | null; label: "" };

function tierFee(miles: number, tiers: TravelFeeTier[]): number {
  for (const tier of tiers) {
    const upper = tier.toMiles ?? Number.POSITIVE_INFINITY;
    if (miles >= tier.fromMiles && miles < upper) return tier.feeCents;
  }
  return tiers[tiers.length - 1]?.feeCents ?? 0;
}

export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "0";
  return miles >= 10 ? String(Math.round(miles)) : String(Math.round(miles * 10) / 10);
}

export function travelLineLabel(oneWayMiles: number): string {
  return `${TRAVEL_FEE_LINE_PREFIX} (${formatMiles(oneWayMiles)} miles)`;
}

export function isRoutesTravelLine(description: string): boolean {
  return description.trim().startsWith(`${TRAVEL_FEE_LINE_PREFIX} (`);
}

/** Price travel for one-way driving miles. */
export function priceTravel(oneWayMiles: number | null, pricing: TravelPricingSettings): TravelQuote {
  if (pricing.model === "none" || oneWayMiles == null || !Number.isFinite(oneWayMiles) || oneWayMiles < 0) {
    return { outcome: "disabled", feeCents: 0, oneWayMiles, label: "" };
  }
  let cents = 0;
  if (pricing.model === "per_mile") {
    const billable = Math.max(0, oneWayMiles - pricing.freeMiles) * (pricing.roundTrip ? 2 : 1);
    cents = Math.round(billable * pricing.perMileCents);
  } else {
    cents = tierFee(oneWayMiles, pricing.tiers);
  }
  if (cents <= 0) return { outcome: "no_fee", feeCents: 0, oneWayMiles, label: "" };
  if (pricing.maxFeeCents > 0 && cents > pricing.maxFeeCents) {
    return { outcome: "over_cap", feeCents: 0, oneWayMiles, computedCents: cents, label: "" };
  }
  return { outcome: "fee", feeCents: cents, oneWayMiles, label: travelLineLabel(oneWayMiles) };
}

export function travelPricingExample(pricing: TravelPricingSettings, miles = 40): string {
  if (pricing.model === "none") return "Clients are never charged a travel fee.";
  const q = priceTravel(miles, pricing);
  if (q.outcome === "fee") return `A property ${miles} miles away adds ${formatCurrency(q.feeCents)}.`;
  if (q.outcome === "over_cap") return `A property ${miles} miles away is over your maximum, so the fee is left for you to quote.`;
  return `A property ${miles} miles away has no travel fee.`;
}

export type ServiceAreaDecision =
  | { inside: true }
  | { inside: false; behavior: BookingSettings["outsideAreaBehavior"]; requiresQuote: boolean; radiusMiles: number };

/**
 * Service radius check. `servicesRequireQuote` = any selected service is marked
 * "Requires custom quote outside service radius".
 */
export function decideServiceArea(input: {
  oneWayMiles: number | null;
  settings: Pick<BookingSettings, "serviceRadiusEnabled" | "serviceRadiusMiles" | "outsideAreaBehavior">;
  servicesRequireQuote: boolean;
}): ServiceAreaDecision {
  const { settings } = input;
  if (!settings.serviceRadiusEnabled || input.oneWayMiles == null) return { inside: true };
  if (input.oneWayMiles <= settings.serviceRadiusMiles) return { inside: true };
  const requiresQuote = settings.outsideAreaBehavior === "custom_quote" || input.servicesRequireQuote;
  return {
    inside: false,
    behavior: requiresQuote ? "custom_quote" : settings.outsideAreaBehavior,
    requiresQuote,
    radiusMiles: settings.serviceRadiusMiles,
  };
}
