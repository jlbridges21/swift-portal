/**
 * Decide whether a preliminary estimate gets a travel line.
 * Does not write, notify, or log. Callers fail open around this result.
 */

import { computeTravelFee, type TravelSettings } from "@/lib/travel-fee";
import { oneWayMilesBetweenZips, zipDistanceFailureMessage, type ZipDistanceResult, type ZipQuery } from "@/lib/zip-distance";

export type PreliminaryTravelDecision = {
  /** False when travel fees are off. Callers should not write a distance column. */
  active: boolean;
  lineItem: { description: string; amount_cents: number } | null;
  /** Resolved one-way miles, when a lookup succeeded. */
  oneWayMiles: number | null;
  /** Set when the business should be told the fee was skipped. */
  notifyReason: string | null;
};

export async function decidePreliminaryTravel(input: {
  settings: TravelSettings;
  businessPostalCode: string;
  businessCountry: string;
  propertyAddress: string | null;
  hidePricing: boolean;
  db: ZipQuery;
}): Promise<PreliminaryTravelDecision> {
  if (!input.settings.enabled) {
    return { active: false, lineItem: null, oneWayMiles: null, notifyReason: null };
  }

  if (input.hidePricing) {
    return {
      active: true,
      lineItem: null,
      oneWayMiles: null,
      notifyReason:
        "Travel fee was not added because this service hides pricing. A travel line on a custom proposal would not have a price to attach to.",
    };
  }

  if (input.settings.distanceMode === "manual") {
    return { active: true, lineItem: null, oneWayMiles: null, notifyReason: null };
  }

  const distance: ZipDistanceResult = await oneWayMilesBetweenZips(input.db, {
    businessPostalCode: input.businessPostalCode,
    businessCountry: input.businessCountry,
    propertyAddress: input.propertyAddress,
  });

  if (!distance.ok) {
    return {
      active: true,
      lineItem: null,
      oneWayMiles: null,
      notifyReason: zipDistanceFailureMessage(distance),
    };
  }

  const priced = computeTravelFee({ oneWayMiles: distance.oneWayMiles, settings: input.settings });
  if (priced.outcome === "over_cap") {
    return {
      active: true,
      lineItem: null,
      oneWayMiles: distance.oneWayMiles,
      notifyReason: "Travel fee was not added because the computed fee is over the maximum for this business.",
    };
  }
  if (priced.outcome === "invalid_distance") {
    return {
      active: true,
      lineItem: null,
      oneWayMiles: null,
      notifyReason: "Travel fee was not added because the distance could not be calculated.",
    };
  }
  if (priced.outcome !== "fee") {
    return { active: true, lineItem: null, oneWayMiles: distance.oneWayMiles, notifyReason: null };
  }

  return {
    active: true,
    lineItem: { description: priced.label, amount_cents: priced.feeCents },
    oneWayMiles: distance.oneWayMiles,
    notifyReason: null,
  };
}

