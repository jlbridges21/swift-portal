/**
 * Pure pricing math for the free tools (/tools). No React, no I/O, fully unit-tested in
 * scripts/verify-tools.ts. Every number a user sees is derived here from inputs they can edit;
 * there are no built-in market rates.
 */

export type ProfitMode = "margin" | "markup";

/** Coerce user input to a finite number within [min, max]. Empty/NaN → fallback. */
export function clampNumber(value: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,%\s]/g, "")) : NaN;
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fallback));
  return Math.min(max, Math.max(min, n));
}

/**
 * Round to cents, half away from zero. The tiny nudge absorbs binary floating-point error
 * (34.995 is stored as 34.99499999…; without it, a $34.995 discount would round down to $34.99).
 */
export function cents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return (Math.sign(n) * Math.round((Math.abs(n) + 1e-9) * 100)) / 100;
}

/** Highest margin we allow: 95%. A margin of 100% would mean an infinite price. */
export const MAX_MARGIN_PCT = 95;
export const MAX_MARKUP_PCT = 1000;

/**
 * Price from cost.
 * - margin: profit as a share of the PRICE → price = cost / (1 − m). 30% margin on $100 cost = $142.86.
 * - markup: profit as a share of the COST  → price = cost × (1 + m). 30% markup on $100 cost = $130.
 */
export function priceFromCost(cost: number, pct: number, mode: ProfitMode): number {
  const c = Math.max(0, cost);
  if (mode === "margin") {
    const m = clampNumber(pct, 0, MAX_MARGIN_PCT) / 100;
    return c / (1 - m);
  }
  const k = clampNumber(pct, 0, MAX_MARKUP_PCT) / 100;
  return c * (1 + k);
}

/** Profit as a share of price (0–1). Zero price → 0. */
export function marginOf(price: number, cost: number): number {
  return price > 0 ? (price - cost) / price : 0;
}

/** Profit as a share of cost (0–∞). Zero cost → null (undefined markup). */
export function markupOf(price: number, cost: number): number | null {
  return cost > 0 ? (price - cost) / cost : null;
}

/** Convert between the two: a margin m equals a markup of m / (1 − m). */
export function marginToMarkup(marginPct: number): number {
  const m = clampNumber(marginPct, 0, MAX_MARGIN_PCT) / 100;
  return (m / (1 - m)) * 100;
}

/** Round UP to the nearest step so rounding never eats into the target profit. step ≤ 0 → cents. */
export function roundUpTo(price: number, step: number): number {
  if (!(step > 0)) return cents(price);
  return Math.ceil(cents(price) / step - 1e-9) * step;
}

export const ROUNDING_STEPS = [0, 1, 5, 10, 25] as const;

// ---------------------------------------------------------------- drone

export type DroneExtra = { id: string; label: string; enabled: boolean; hours: number; cost: number };

export type DroneInputs = {
  planningHours: number; // airspace checks, site research, client calls, permits
  flightHours: number; // on-site time including setup and pre-flight checks
  editingHours: number;
  travelHours: number; // round trip
  travelMiles: number; // round trip
  hourlyRate: number; // what you pay yourself per hour of work
  mileageRate: number; // your vehicle cost per mile
  jobCosts: number; // permits, assistant/visual observer, rentals, licensed music, etc.
  annualOverhead: number; // insurance, software, equipment replacement, training, phone…
  jobsPerYear: number;
  profitPct: number;
  profitMode: ProfitMode;
  rushPct: number; // surcharge applied to the final price
  depositPct: number;
  roundTo: number;
  extras: DroneExtra[];
};

export type PriceBreakdown = {
  hours: number;
  laborCost: number;
  travelCost: number;
  overheadCost: number;
  directCosts: number;
  totalCost: number;
  /** Price before rounding (includes rush surcharge). */
  rawPrice: number;
  price: number;
  profit: number;
  marginPct: number;
  markupPct: number | null;
  effectiveHourly: number | null;
  deposit: number;
  balance: number;
  rushAmount: number;
};

export function sanitizeDrone(i: DroneInputs): DroneInputs {
  return {
    planningHours: clampNumber(i.planningHours, 0, 200),
    flightHours: clampNumber(i.flightHours, 0, 200),
    editingHours: clampNumber(i.editingHours, 0, 500),
    travelHours: clampNumber(i.travelHours, 0, 100),
    travelMiles: clampNumber(i.travelMiles, 0, 10000),
    hourlyRate: clampNumber(i.hourlyRate, 0, 10000),
    mileageRate: clampNumber(i.mileageRate, 0, 50),
    jobCosts: clampNumber(i.jobCosts, 0, 1_000_000),
    annualOverhead: clampNumber(i.annualOverhead, 0, 10_000_000),
    jobsPerYear: clampNumber(i.jobsPerYear, 0, 100_000),
    profitPct: clampNumber(i.profitPct, 0, i.profitMode === "margin" ? MAX_MARGIN_PCT : MAX_MARKUP_PCT),
    profitMode: i.profitMode === "markup" ? "markup" : "margin",
    rushPct: clampNumber(i.rushPct, 0, 500),
    depositPct: clampNumber(i.depositPct, 0, 100),
    roundTo: ROUNDING_STEPS.includes(i.roundTo as (typeof ROUNDING_STEPS)[number]) ? i.roundTo : 0,
    extras: (i.extras ?? []).slice(0, 20).map((e) => ({
      id: String(e.id).slice(0, 40),
      label: String(e.label ?? "").slice(0, 80),
      enabled: Boolean(e.enabled),
      hours: clampNumber(e.hours, 0, 200),
      cost: clampNumber(e.cost, 0, 1_000_000),
    })),
  };
}

/** Overhead share for one job. With 0 jobs per year there is nothing to spread it over → 0. */
export function overheadPerJob(annualOverhead: number, jobsPerYear: number): number {
  return jobsPerYear > 0 ? Math.max(0, annualOverhead) / jobsPerYear : 0;
}

function finish(hours: number, laborCost: number, travelCost: number, overheadCost: number, directCosts: number, profitPct: number, mode: ProfitMode, rushPct: number, depositPct: number, roundTo: number): PriceBreakdown {
  const totalCost = laborCost + travelCost + overheadCost + directCosts;
  const base = priceFromCost(totalCost, profitPct, mode);
  const rushAmount = base * (Math.max(0, rushPct) / 100);
  const rawPrice = base + rushAmount;
  const price = roundUpTo(rawPrice, roundTo);
  const profit = price - totalCost;
  const deposit = cents(price * (Math.min(100, Math.max(0, depositPct)) / 100));
  return {
    hours,
    laborCost: cents(laborCost),
    travelCost: cents(travelCost),
    overheadCost: cents(overheadCost),
    directCosts: cents(directCosts),
    totalCost: cents(totalCost),
    rawPrice: cents(rawPrice),
    price: cents(price),
    profit: cents(profit),
    marginPct: marginOf(price, totalCost) * 100,
    markupPct: markupOf(price, totalCost) === null ? null : (markupOf(price, totalCost) as number) * 100,
    effectiveHourly: hours > 0 ? price / hours : null,
    deposit,
    balance: cents(price - deposit),
    rushAmount: cents(rushAmount),
  };
}

export function calculateDrone(input: DroneInputs): PriceBreakdown {
  const i = sanitizeDrone(input);
  const extras = i.extras.filter((e) => e.enabled);
  const hours = i.planningHours + i.flightHours + i.editingHours + i.travelHours + extras.reduce((n, e) => n + e.hours, 0);
  return finish(
    hours,
    hours * i.hourlyRate,
    i.travelMiles * i.mileageRate,
    overheadPerJob(i.annualOverhead, i.jobsPerYear),
    i.jobCosts + extras.reduce((n, e) => n + e.cost, 0),
    i.profitPct,
    i.profitMode,
    i.rushPct,
    i.depositPct,
    i.roundTo
  );
}

// ---------------------------------------------------------------- real estate

export type RealEstateAddOn = {
  id: string;
  label: string;
  enabled: boolean;
  onSiteMinutes: number;
  editMinutes: number;
  /** Money you pay out for this add-on (outsourced edit, floor plan vendor, tour hosting…). */
  cost: number;
};

export type RealEstateInputs = {
  squareFeet: number;
  photoCount: number;
  baseShootMinutes: number; // setup + exteriors for any property
  shootMinutesPer1000: number; // additional on-site minutes per 1,000 sq ft
  editMode: "inhouse" | "outsourced";
  editMinutesPerPhoto: number;
  outsourcedCostPerPhoto: number;
  adminMinutes: number; // scheduling, uploads, delivery, invoicing
  travelMinutes: number; // round trip
  travelMiles: number; // round trip
  hourlyRate: number;
  mileageRate: number;
  annualOverhead: number;
  jobsPerYear: number;
  profitPct: number;
  profitMode: ProfitMode;
  roundTo: number;
  addOns: RealEstateAddOn[];
};

export type RealEstateResult = {
  base: PriceBreakdown;
  /** Each add-on priced on its own with the same profit rule (rounded the same way). */
  addOns: { id: string; label: string; enabled: boolean; cost: number; price: number; minutes: number }[];
  /** Base package + enabled add-ons. */
  total: number;
  totalCost: number;
  shootMinutes: number;
  editMinutes: number;
};

export function sanitizeRealEstate(i: RealEstateInputs): RealEstateInputs {
  return {
    squareFeet: clampNumber(i.squareFeet, 0, 100_000),
    photoCount: Math.round(clampNumber(i.photoCount, 0, 500)),
    baseShootMinutes: clampNumber(i.baseShootMinutes, 0, 1440),
    shootMinutesPer1000: clampNumber(i.shootMinutesPer1000, 0, 600),
    editMode: i.editMode === "outsourced" ? "outsourced" : "inhouse",
    editMinutesPerPhoto: clampNumber(i.editMinutesPerPhoto, 0, 240),
    outsourcedCostPerPhoto: clampNumber(i.outsourcedCostPerPhoto, 0, 1000),
    adminMinutes: clampNumber(i.adminMinutes, 0, 1440),
    travelMinutes: clampNumber(i.travelMinutes, 0, 1440),
    travelMiles: clampNumber(i.travelMiles, 0, 10000),
    hourlyRate: clampNumber(i.hourlyRate, 0, 10000),
    mileageRate: clampNumber(i.mileageRate, 0, 50),
    annualOverhead: clampNumber(i.annualOverhead, 0, 10_000_000),
    jobsPerYear: clampNumber(i.jobsPerYear, 0, 100_000),
    profitPct: clampNumber(i.profitPct, 0, i.profitMode === "markup" ? MAX_MARKUP_PCT : MAX_MARGIN_PCT),
    profitMode: i.profitMode === "markup" ? "markup" : "margin",
    roundTo: ROUNDING_STEPS.includes(i.roundTo as (typeof ROUNDING_STEPS)[number]) ? i.roundTo : 0,
    addOns: (i.addOns ?? []).slice(0, 20).map((a) => ({
      id: String(a.id).slice(0, 40),
      label: String(a.label ?? "").slice(0, 80),
      enabled: Boolean(a.enabled),
      onSiteMinutes: clampNumber(a.onSiteMinutes, 0, 1440),
      editMinutes: clampNumber(a.editMinutes, 0, 1440),
      cost: clampNumber(a.cost, 0, 100_000),
    })),
  };
}

/** Base package only (no add-ons) for a given square footage. Used for the tier price list too. */
function realEstateBase(i: RealEstateInputs, squareFeet: number, photoCount: number) {
  const shootMinutes = i.baseShootMinutes + (squareFeet / 1000) * i.shootMinutesPer1000;
  const editMinutes = i.editMode === "inhouse" ? photoCount * i.editMinutesPerPhoto : 0;
  const editCost = i.editMode === "outsourced" ? photoCount * i.outsourcedCostPerPhoto : 0;
  const minutes = shootMinutes + editMinutes + i.adminMinutes + i.travelMinutes;
  const hours = minutes / 60;
  const breakdown = finish(
    hours,
    hours * i.hourlyRate,
    i.travelMiles * i.mileageRate,
    overheadPerJob(i.annualOverhead, i.jobsPerYear),
    editCost,
    i.profitPct,
    i.profitMode,
    0,
    0,
    i.roundTo
  );
  return { breakdown, shootMinutes, editMinutes };
}

export function calculateRealEstate(input: RealEstateInputs): RealEstateResult {
  const i = sanitizeRealEstate(input);
  const { breakdown, shootMinutes, editMinutes } = realEstateBase(i, i.squareFeet, i.photoCount);
  const addOns = i.addOns.map((a) => {
    const minutes = a.onSiteMinutes + a.editMinutes;
    const cost = (minutes / 60) * i.hourlyRate + a.cost;
    const price = roundUpTo(priceFromCost(cost, i.profitPct, i.profitMode), i.roundTo);
    return { id: a.id, label: a.label, enabled: a.enabled, cost: cents(cost), price: cents(price), minutes };
  });
  const enabled = addOns.filter((a) => a.enabled);
  return {
    base: breakdown,
    addOns,
    total: cents(breakdown.price + enabled.reduce((n, a) => n + a.price, 0)),
    totalCost: cents(breakdown.totalCost + enabled.reduce((n, a) => n + a.cost, 0)),
    shootMinutes,
    editMinutes,
  };
}

/** Square-footage tiers for a printable price list. Photo count scales with the user's photos-per-sq-ft ratio. */
export const DEFAULT_TIERS = [1500, 2500, 3500, 5000] as const;

export function realEstateTiers(input: RealEstateInputs, tiers: readonly number[] = DEFAULT_TIERS) {
  const i = sanitizeRealEstate(input);
  const photosPerSqft = i.squareFeet > 0 ? i.photoCount / i.squareFeet : 0;
  return tiers.map((upTo, idx) => {
    const photos = Math.max(1, Math.round(upTo * photosPerSqft));
    const { breakdown } = realEstateBase(i, upTo, photos);
    return { from: idx === 0 ? 0 : tiers[idx - 1] + 1, upTo, photos, price: breakdown.price };
  });
}

// ---------------------------------------------------------------- quote totals

export type QuoteLine = { id: string; description: string; detail?: string; quantity: number; unitPrice: number; optional?: boolean };

export type QuoteTotalsInput = {
  lines: QuoteLine[];
  discountType: "none" | "percent" | "amount";
  discountValue: number;
  taxPct: number;
  depositType: "none" | "percent" | "amount";
  depositValue: number;
};

export type QuoteTotals = {
  lineTotals: Record<string, number>;
  subtotal: number;
  optionalTotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  deposit: number;
  balance: number;
};

/** Optional lines are shown to the client but not included in the total. */
export function quoteTotals(q: QuoteTotalsInput): QuoteTotals {
  const lineTotals: Record<string, number> = {};
  let subtotal = 0;
  let optionalTotal = 0;
  for (const l of q.lines.slice(0, 100)) {
    const qty = clampNumber(l.quantity, 0, 100_000);
    const unit = clampNumber(l.unitPrice, 0, 10_000_000);
    const t = cents(qty * unit);
    lineTotals[l.id] = t;
    if (l.optional) optionalTotal += t;
    else subtotal += t;
  }
  subtotal = cents(subtotal);
  let discount = 0;
  if (q.discountType === "percent") discount = subtotal * (clampNumber(q.discountValue, 0, 100) / 100);
  else if (q.discountType === "amount") discount = clampNumber(q.discountValue, 0, subtotal);
  discount = cents(Math.min(discount, subtotal));
  const taxable = cents(subtotal - discount);
  const tax = cents(taxable * (clampNumber(q.taxPct, 0, 100) / 100));
  const total = cents(taxable + tax);
  let deposit = 0;
  if (q.depositType === "percent") deposit = total * (clampNumber(q.depositValue, 0, 100) / 100);
  else if (q.depositType === "amount") deposit = clampNumber(q.depositValue, 0, total);
  deposit = cents(Math.min(deposit, total));
  return { lineTotals, subtotal, optionalTotal: cents(optionalTotal), discount, taxable, tax, total, deposit, balance: cents(total - deposit) };
}

// ---------------------------------------------------------------- formatting

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** $1,234.50 — or $1,235 when whole is true and the amount has no cents. */
export function formatMoney(n: number, opts: { whole?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "—";
  return opts.whole && Math.abs(n - Math.round(n)) < 0.005 ? usd0.format(n) : usd.format(n);
}

export function formatPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 60) return `${whole + 1} h`;
  return mins ? `${whole} h ${mins} min` : `${whole} h`;
}
