/**
 * Team pay — shared types and defaults (pure; safe for client and server).
 *
 * Money is integer cents everywhere. A pay period is a pair of civil dates (YYYY-MM-DD, both
 * inclusive) in the business time zone.
 */

export type PeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type BaseType = "hourly" | "per_shoot" | "per_service" | "percent";
export type DriveType = "none" | "hour" | "mile" | "both" | "travel_fee";
export type WorkerType = "contractor" | "employee";

export type TeamPaySettings = {
  enabled: boolean;
  periodType: PeriodType;
  /** First day of any one period; weekly and biweekly periods count from it. */
  periodAnchor: string;
  lateCancelEnabled: boolean;
  lateCancelHours: number;
  lateCancelFeeCents: number;
  allowTimeRequests: boolean;
  allowCheckIn: boolean;
  reviewOverMinutes: number;
};

export const DEFAULT_TEAM_PAY_SETTINGS: TeamPaySettings = {
  enabled: false,
  periodType: "biweekly",
  periodAnchor: "2026-01-04",
  lateCancelEnabled: false,
  lateCancelHours: 24,
  lateCancelFeeCents: 0,
  allowTimeRequests: true,
  allowCheckIn: false,
  reviewOverMinutes: 30,
};

export type PayPlan = {
  id: string;
  name: string;
  baseType: BaseType;
  /** Per hour (hourly) or per shoot (per_shoot). */
  baseRateCents: number;
  /** Share of the shoot's price, 0–100 (percent). */
  percent: number;
  /** Service id → cents (per_service). */
  serviceRates: Record<string, number>;
  driveType: DriveType;
  driveHourCents: number;
  /** Cents per mile; may carry decimals (72.5). */
  mileCents: number;
  payFirstDrive: boolean;
  payDriveHome: boolean;
  minPerShootCents: number;
  archived: boolean;
};

export const NEW_PLAN: Omit<PayPlan, "id"> = {
  name: "",
  baseType: "hourly",
  baseRateCents: 3000,
  percent: 40,
  serviceRates: {},
  driveType: "none",
  driveHourCents: 2000,
  mileCents: 70,
  payFirstDrive: true,
  payDriveHome: true,
  minPerShootCents: 0,
  archived: false,
};

export type PayMember = {
  userId: string;
  planId: string | null;
  workerType: WorkerType;
  /** Replaces the plan's main rate: cents (hourly / per shoot) or percent × 100 (percent). */
  rateOverride: number | null;
};

export type PayPeriod = { start: string; end: string };

/** Planned driving around one shoot (one-way legs). */
export type DriveFacts = {
  inMinutes: number;
  inMiles: number;
  from: "home" | "previous";
  /** Drive home after the day's last shoot; 0 when it isn't the last. */
  outMinutes: number;
  outMiles: number;
};

export type ShootEdit = {
  onsiteMinutes: number | null;
  driveMinutes: number | null;
  miles: number | null;
  amountCents: number | null;
  note: string | null;
  arrivedAt: string | null;
  doneAt: string | null;
};

export type ShootFacts = {
  proposalId: string;
  projectId: string;
  userId: string;
  startIso: string;
  /** Civil date in the business time zone. */
  dateKey: string;
  plannedMinutes: number;
  title: string;
  address: string | null;
  services: { id: string | null; name: string }[];
  /** Client price without travel lines; null when the project has no estimate. */
  priceCents: number | null;
  travelFeeCents: number;
  /** null: the route couldn't be worked out (missing address, maps unavailable). */
  drive: DriveFacts | null;
  edit: ShootEdit | null;
  pendingRequest: { id: string; onsiteMinutes: number; note: string | null } | null;
  /** Hasn't happened yet: shown, never counted. */
  upcoming: boolean;
};

export type PayFlagCode = "over_time" | "time_request" | "no_rate" | "no_drive" | "no_price";
export type PayFlag = { code: PayFlagCode; message: string; minutes?: number };

export type PayLineKind = "shoot" | "late_cancel" | "adjustment";
export type AdjustmentKind = "bonus" | "reimbursement" | "deduction" | "other";

export type PayLine = {
  id: string;
  kind: PayLineKind;
  proposalId: string | null;
  projectId: string | null;
  dateKey: string;
  startIso: string | null;
  title: string;
  detail: string | null;
  services: string[];
  plannedMinutes: number;
  onsiteMinutes: number;
  onsiteSource: "booked" | "checked_in" | "edited";
  driveMinutes: number;
  miles: number;
  driveFrom: "home" | "previous" | null;
  includesDriveHome: boolean;
  /** Each part of the pay, so the statement can show how the amount was reached. */
  parts: { label: string; cents: number }[];
  amountCents: number;
  amountEdited: boolean;
  note: string | null;
  upcoming: boolean;
  flags: PayFlag[];
  adjustmentKind: AdjustmentKind | null;
  request: { id: string; onsiteMinutes: number; note: string | null } | null;
  checkIn: { arrivedAt: string | null; doneAt: string | null } | null;
};

export type StatementStatus = "in_progress" | "to_review" | "ready" | "approved" | "paid";

export type StatementTotals = {
  amountCents: number;
  shoots: number;
  onsiteMinutes: number;
  driveMinutes: number;
  miles: number;
  adjustmentsCents: number;
  /** Shoots in the period that haven't happened yet. */
  upcomingShoots: number;
  upcomingCents: number;
};

export type PayStatement = {
  userId: string;
  period: PayPeriod;
  status: StatementStatus;
  lines: PayLine[];
  totals: StatementTotals;
  /** Lines waiting on the owner (time requests, long check-ins, missing rates). */
  reviewCount: number;
  /** Employees only: weeks (Sunday start) over 40 hours of paid time. */
  overtimeWeeks: { weekStart: string; minutes: number }[];
  approvedAt: string | null;
  paid: { at: string; method: string | null; reference: string | null } | null;
};

export type TeamPayPerson = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "staff";
  workerType: WorkerType;
  plan: PayPlan | null;
  rateOverride: number | null;
};

export type AdjustmentRow = {
  id: string;
  userId: string;
  dateKey: string;
  kind: AdjustmentKind;
  label: string;
  amountCents: number;
};

export const BASE_TYPE_LABEL: Record<BaseType, string> = {
  hourly: "Hourly",
  per_shoot: "Per shoot",
  per_service: "Per service",
  percent: "% of the shoot",
};

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Every month",
};

export const ADJUSTMENT_LABEL: Record<AdjustmentKind, string> = {
  bonus: "Bonus",
  reimbursement: "Reimbursement",
  deduction: "Deduction",
  other: "Other",
};

export const PAID_METHODS = ["QuickBooks", "Gusto", "Direct deposit", "Zelle", "Venmo", "Check", "Cash", "Other"] as const;

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

/** "$30" when whole dollars, "$30.50" otherwise. */
export function formatCentsShort(cents: number): string {
  return Math.round(cents) % 100 === 0 ? formatCents(cents).replace(/\.00$/, "") : formatCents(cents);
}

/** "2 hr 30 min", "45 min", "3 hr". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h && rest) return `${h} hr ${rest} min`;
  if (h) return `${h} hr`;
  return `${rest} min`;
}

/** "17.5 hr" for totals. */
export function formatHours(minutes: number): string {
  const hours = Math.round((Math.max(0, minutes) / 60) * 10) / 10;
  return `${hours.toLocaleString("en-US", { maximumFractionDigits: 1 })} hr`;
}

export function formatMilesShort(miles: number): string {
  const v = Math.round(Math.max(0, miles) * 10) / 10;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })} mi`;
}

/** Cents per mile as dollars: 70 → "$0.70", 72.5 → "$0.725". */
export function formatMileRate(mileCents: number): string {
  const dollars = mileCents / 100;
  return `$${Number.isInteger(mileCents) ? dollars.toFixed(2) : dollars.toFixed(3).replace(/0$/, "")}`;
}

/** One line that says how a plan pays, e.g. "$30/hr on site · $20/hr driving · $0.70/mi". */
export function describePlan(plan: PayPlan, rateOverride: number | null = null): string {
  const bits: string[] = [];
  const rate = rateOverride ?? plan.baseRateCents;
  if (plan.baseType === "hourly") bits.push(`${formatCentsShort(rate)}/hr on site`);
  else if (plan.baseType === "per_shoot") bits.push(`${formatCentsShort(rate)} per shoot`);
  else if (plan.baseType === "per_service") bits.push("Paid per service");
  else bits.push(`${rateOverride !== null ? rateOverride / 100 : plan.percent}% of the shoot`);
  if (plan.driveType === "hour" || plan.driveType === "both") bits.push(`${formatCentsShort(plan.driveHourCents)}/hr driving`);
  if (plan.driveType === "mile" || plan.driveType === "both") bits.push(`${formatMileRate(plan.mileCents)}/mi`);
  if (plan.driveType === "travel_fee") bits.push("client's travel fee");
  return bits.join(" · ");
}
