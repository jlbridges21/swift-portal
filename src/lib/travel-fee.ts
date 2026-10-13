/**
 * Travel-fee pricing. No network and no database.
 *
 * Miles in are always ONE-WAY straight-line miles. Round trip is applied in
 * exactly one place: `roundTripMiles = oneWayMiles * 2` inside
 * `computeTravelFee`. Callers must not double before calling.
 *
 * Tiers are chosen from the one-way distance (how far the property is).
 * A job 40 miles away lands in the default 25–50 tier and adds $40.
 * The per-mile model charges the round-trip miles beyond the free radius,
 * so a 32 mile one-way job bills 64 miles before the free radius is removed.
 */

import { formatCurrency } from "@/lib/utils";

export type TravelDistanceMode = "auto" | "manual";
export type TravelPricingModel = "tiers" | "radius_per_mile";

export type TravelTier = {
  fromMiles: number;
  /** Null on the last tier means "and beyond". */
  toMiles: number | null;
  feeCents: number;
};

export type TravelSettings = {
  enabled: boolean;
  distanceMode: TravelDistanceMode;
  pricingModel: TravelPricingModel;
  tiers: TravelTier[];
  freeRadiusMiles: number;
  perMileCents: number;
  maxFeeCents: number;
};

export const DEFAULT_TRAVEL_TIERS: TravelTier[] = [
  { fromMiles: 0, toMiles: 25, feeCents: 0 },
  { fromMiles: 25, toMiles: 50, feeCents: 4000 },
  { fromMiles: 50, toMiles: 75, feeCents: 7500 },
  { fromMiles: 75, toMiles: null, feeCents: 12500 },
];

export const TRAVEL_LINE_PREFIX = "Travel — outside ";

export class TravelSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelSettingsError";
  }
}

export function defaultTravelSettings(): TravelSettings {
  return {
    enabled: false,
    distanceMode: "auto",
    pricingModel: "tiers",
    tiers: DEFAULT_TRAVEL_TIERS.map((tier) => ({ ...tier })),
    freeRadiusMiles: 25,
    perMileCents: 150,
    maxFeeCents: 25000,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Why these tiers cannot be saved. Null when they are ordered, contiguous, and non-overlapping. */
export function travelTierError(tiers: TravelTier[]): string | null {
  if (!tiers.length) return "Add at least one travel tier.";

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (!Number.isFinite(tier.fromMiles) || tier.fromMiles < 0) {
      return `The tier in position ${i + 1} must start at zero or more miles.`;
    }
    if (!Number.isInteger(tier.feeCents) || tier.feeCents < 0) {
      return `The tier starting at ${tier.fromMiles} miles needs a fee of zero or more cents, as a whole number.`;
    }
    if (i === 0 && tier.fromMiles !== 0) {
      return `The first tier must start at 0 miles. It starts at ${tier.fromMiles} miles.`;
    }
    if (tier.toMiles == null) {
      if (i !== tiers.length - 1) {
        return `Only the last tier can have no end mileage. The tier starting at ${tier.fromMiles} miles is open-ended, and another tier follows it.`;
      }
    } else if (!Number.isFinite(tier.toMiles) || tier.toMiles <= tier.fromMiles) {
      return `The tier starting at ${tier.fromMiles} miles ends at ${tier.toMiles} miles, which is not after its start.`;
    }

    if (i === 0) continue;
    const prev = tiers[i - 1];
    if (prev.toMiles == null) {
      return `Only the last tier can have no end mileage. The tier starting at ${prev.fromMiles} miles is open-ended, and another tier follows it.`;
    }
    if (tier.fromMiles < prev.fromMiles) {
      return `Tiers are out of order: the tier starting at ${tier.fromMiles} miles comes after the tier starting at ${prev.fromMiles} miles.`;
    }
    if (tier.fromMiles < prev.toMiles) {
      return `Tiers overlap: the tier starting at ${tier.fromMiles} miles overlaps the previous tier, which runs through ${prev.toMiles} miles.`;
    }
    if (tier.fromMiles > prev.toMiles) {
      return `Tiers have a gap between ${prev.toMiles} miles and ${tier.fromMiles} miles.`;
    }
  }

  return null;
}

function readTiers(raw: unknown): { ok: true; tiers: TravelTier[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Travel tiers must be a list of mileage ranges." };
  const tiers: TravelTier[] = [];
  for (const row of raw) {
    if (!isRecord(row)) return { ok: false, error: "Each travel tier needs a start, an end, and a fee." };
    const fromMiles = finiteNumber(row.fromMiles);
    const feeCents = finiteNumber(row.feeCents);
    const toRaw = row.toMiles;
    const toMiles = toRaw == null || toRaw === "" ? null : finiteNumber(toRaw);
    if (fromMiles == null || feeCents == null || (toRaw != null && toRaw !== "" && toMiles == null)) {
      return { ok: false, error: "Each travel tier needs numeric start, end, and fee values." };
    }
    tiers.push({ fromMiles, toMiles, feeCents: Math.round(feeCents) });
  }
  const error = travelTierError(tiers);
  if (error) return { ok: false, error };
  return { ok: true, tiers };
}

export function travelSettingsError(settings: TravelSettings, postalCode?: string): string | null {
  if (settings.distanceMode !== "auto" && settings.distanceMode !== "manual") {
    return "Distance mode must be automatic or manual.";
  }
  if (settings.pricingModel !== "tiers" && settings.pricingModel !== "radius_per_mile") {
    return "Pricing model must be tiers or a per-mile rate outside a free radius.";
  }
  const tierError = travelTierError(settings.tiers);
  if (tierError) return tierError;
  if (!Number.isFinite(settings.freeRadiusMiles) || settings.freeRadiusMiles < 0) {
    return "The free radius must be zero or more miles.";
  }
  if (!Number.isInteger(settings.perMileCents) || settings.perMileCents < 0) {
    return "The per-mile rate must be zero or more cents, as a whole number.";
  }
  if (!Number.isInteger(settings.maxFeeCents) || settings.maxFeeCents <= 0) {
    return "The maximum travel fee must be a whole number of cents greater than zero.";
  }
  if (postalCode !== undefined && settings.enabled && !postalCode.trim()) {
    return "Add a postal code in business contact settings before turning on travel fees.";
  }
  return null;
}

export function parseTravelSettings(
  raw: unknown
): { ok: true; settings: TravelSettings } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Travel settings must be an object." };
  const distanceMode = raw.distanceMode === "manual" ? "manual" : raw.distanceMode === "auto" || raw.distanceMode == null ? "auto" : null;
  const pricingModel =
    raw.pricingModel === "radius_per_mile"
      ? "radius_per_mile"
      : raw.pricingModel === "tiers" || raw.pricingModel == null
        ? "tiers"
        : null;
  if (!distanceMode) return { ok: false, error: "Distance mode must be automatic or manual." };
  if (!pricingModel) return { ok: false, error: "Pricing model must be tiers or a per-mile rate outside a free radius." };
  if (raw.enabled != null && typeof raw.enabled !== "boolean") {
    return { ok: false, error: "Travel fees enabled must be true or false." };
  }
  const tiers = readTiers(raw.tiers ?? DEFAULT_TRAVEL_TIERS);
  if (!tiers.ok) return tiers;
  const freeRadiusMiles = finiteNumber(raw.freeRadiusMiles ?? 25);
  const perMileCents = finiteNumber(raw.perMileCents ?? 150);
  const maxFeeCents = finiteNumber(raw.maxFeeCents ?? 25000);
  if (freeRadiusMiles == null || perMileCents == null || maxFeeCents == null) {
    return { ok: false, error: "Travel fee numbers must be numeric." };
  }
  const settings: TravelSettings = {
    enabled: raw.enabled === true,
    distanceMode,
    pricingModel,
    tiers: tiers.tiers,
    freeRadiusMiles,
    perMileCents: Math.round(perMileCents),
    maxFeeCents: Math.round(maxFeeCents),
  };
  const error = travelSettingsError(settings);
  if (error) return { ok: false, error };
  return { ok: true, settings };
}

/** Load path. Invalid stored JSON falls back to defaults so a bad row cannot break settings. */
export function mergeTravelSettings(stored: unknown): TravelSettings {
  if (stored == null) return defaultTravelSettings();
  const parsed = parseTravelSettings(stored);
  if (!parsed.ok) return defaultTravelSettings();
  return parsed.settings;
}

export function assertTravelSettings(settings: TravelSettings, postalCode: string): void {
  const error = travelSettingsError(settings, postalCode);
  if (error) throw new TravelSettingsError(error);
}

export function travelServiceAreaMiles(settings: TravelSettings): number {
  if (settings.pricingModel === "radius_per_mile") return settings.freeRadiusMiles;
  let area = 0;
  for (const tier of settings.tiers) {
    if (tier.feeCents !== 0 || tier.toMiles == null) break;
    area = tier.toMiles;
  }
  return area;
}

function formatAreaMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "0";
  if (Number.isInteger(miles)) return String(miles);
  return String(Math.round(miles * 10) / 10);
}

export function travelLineDescription(serviceAreaMiles: number): string {
  return `${TRAVEL_LINE_PREFIX}${formatAreaMiles(serviceAreaMiles)} mile service area`;
}

export function isTravelLineDescription(description: string): boolean {
  return description.trim().startsWith(TRAVEL_LINE_PREFIX);
}

export type TravelFeeResult = {
  /** Straight-line one-way miles that were priced. */
  oneWayMiles: number;
  /**
   * oneWayMiles * 2. This is the only round-trip doubling.
   * A 32 mile one-way lookup bills 64 miles here.
   */
  roundTripMiles: number;
  /** Fee that would be charged before the cap. */
  computedFeeCents: number;
  /** Fee to put on the estimate. Zero when the job is inside the service area or over the cap. */
  feeCents: number;
  /** Client-facing line name. Names the service area, never the job mileage. Empty when no fee is added. */
  label: string;
  serviceAreaMiles: number;
  outcome: "fee" | "within_service_area" | "over_cap" | "invalid_distance";
};

function tierFeeCents(oneWayMiles: number, tiers: TravelTier[]): number {
  for (const tier of tiers) {
    const upper = tier.toMiles == null ? Number.POSITIVE_INFINITY : tier.toMiles;
    if (oneWayMiles >= tier.fromMiles && oneWayMiles < upper) return tier.feeCents;
  }
  const last = tiers[tiers.length - 1];
  return last?.feeCents ?? 0;
}

/**
 * Price a travel fee from one-way miles.
 * Do not pass miles that have already been doubled.
 */
export function computeTravelFee(input: {
  oneWayMiles: number;
  settings: TravelSettings;
}): TravelFeeResult {
  const oneWayMiles = input.oneWayMiles;
  const settings = input.settings;
  const serviceAreaMiles = travelServiceAreaMiles(settings);
  const invalid =
    !Number.isFinite(oneWayMiles) || oneWayMiles < 0
      ? {
          oneWayMiles: 0,
          roundTripMiles: 0,
          computedFeeCents: 0,
          feeCents: 0,
          label: "",
          serviceAreaMiles,
          outcome: "invalid_distance" as const,
        }
      : null;
  if (invalid) return invalid;

  const roundTripMiles = oneWayMiles * 2;
  let computedFeeCents = 0;
  if (settings.pricingModel === "radius_per_mile") {
    const freeRoundTripMiles = settings.freeRadiusMiles * 2;
    const billableMiles = Math.max(0, roundTripMiles - freeRoundTripMiles);
    computedFeeCents = Math.round(billableMiles * settings.perMileCents);
  } else {
    computedFeeCents = tierFeeCents(oneWayMiles, settings.tiers);
  }

  if (computedFeeCents <= 0) {
    return {
      oneWayMiles,
      roundTripMiles,
      computedFeeCents: 0,
      feeCents: 0,
      label: "",
      serviceAreaMiles,
      outcome: "within_service_area",
    };
  }

  if (computedFeeCents > settings.maxFeeCents) {
    return {
      oneWayMiles,
      roundTripMiles,
      computedFeeCents,
      feeCents: 0,
      label: "",
      serviceAreaMiles,
      outcome: "over_cap",
    };
  }

  return {
    oneWayMiles,
    roundTripMiles,
    computedFeeCents,
    feeCents: computedFeeCents,
    label: travelLineDescription(serviceAreaMiles),
    serviceAreaMiles,
    outcome: "fee",
  };
}

export function travelFeeExample(settings: TravelSettings, oneWayMiles = 40): string {
  const result = computeTravelFee({ oneWayMiles, settings });
  const distance = formatAreaMiles(oneWayMiles);
  if (result.outcome === "fee") {
    return `A job ${distance} miles away would add ${formatCurrency(result.feeCents)}.`;
  }
  if (result.outcome === "over_cap") {
    return `A job ${distance} miles away is over the maximum travel fee, so nothing would be added.`;
  }
  return `A job ${distance} miles away would not add a travel fee.`;
}

export function stripTravelLineItems<T extends { description: string; amount_cents: number }>(items: T[]): T[] {
  return items.filter((item) => !isTravelLineDescription(item.description));
}

/** Replace any existing travel line using the same pricing module. Miles are one-way. */
export function withManualTravelLine<T extends { description: string; amount_cents: number }>(
  items: T[],
  oneWayMiles: number | null,
  settings: TravelSettings
): { lineItems: T[]; oneWayMiles: number | null } {
  const kept = stripTravelLineItems(items);
  if (oneWayMiles == null || !Number.isFinite(oneWayMiles) || oneWayMiles < 0) {
    return { lineItems: kept, oneWayMiles: null };
  }
  const priced = computeTravelFee({ oneWayMiles, settings });
  if (priced.outcome !== "fee") {
    return { lineItems: kept, oneWayMiles };
  }
  const line = { description: priced.label, amount_cents: priced.feeCents } as T;
  return { lineItems: [...kept, line], oneWayMiles };
}
