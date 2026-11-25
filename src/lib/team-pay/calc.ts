/**
 * Team pay — the pay calculation (pure: no database, no network).
 *
 * One shoot + one pay plan → one pay line. A statement is the period's lines, totals and what
 * still needs the owner's eye.
 */
import { weekStart } from "./periods";
import {
  ADJUSTMENT_LABEL,
  formatCentsShort,
  formatMileRate,
  formatMilesShort,
  formatMinutes,
  type AdjustmentRow,
  type PayFlag,
  type PayLine,
  type PayMember,
  type PayPeriod,
  type PayPlan,
  type PayStatement,
  type ShootFacts,
  type StatementStatus,
  type StatementTotals,
  type TeamPaySettings,
  type WorkerType,
} from "./types";

const OVERTIME_WEEK_MINUTES = 40 * 60;

function blankLine(): Omit<PayLine, "id" | "kind" | "dateKey" | "title"> {
  return {
    proposalId: null,
    projectId: null,
    startIso: null,
    detail: null,
    services: [],
    plannedMinutes: 0,
    onsiteMinutes: 0,
    onsiteSource: "booked",
    driveMinutes: 0,
    miles: 0,
    driveFrom: null,
    includesDriveHome: false,
    parts: [],
    amountCents: 0,
    amountEdited: false,
    note: null,
    upcoming: false,
    flags: [],
    adjustmentKind: null,
    request: null,
    checkIn: null,
  };
}

/** Minutes between check-in and check-out; null unless both are there and in order. */
export function checkedInMinutes(arrivedAt: string | null | undefined, doneAt: string | null | undefined): number | null {
  if (!arrivedAt || !doneAt) return null;
  const ms = Date.parse(doneAt) - Date.parse(arrivedAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(1440, Math.round(ms / 60_000));
}

/** What one shoot pays on a plan. */
export function computeShootLine(
  facts: ShootFacts,
  plan: PayPlan,
  member: Pick<PayMember, "rateOverride">,
  settings: Pick<TeamPaySettings, "reviewOverMinutes">
): PayLine {
  const flags: PayFlag[] = [];
  const edit = facts.edit;
  const parts: PayLine["parts"] = [];

  // ── Time on site: the owner's correction, else an in-range check-in, else the booked time ──
  let onsiteMinutes = facts.plannedMinutes;
  let onsiteSource: PayLine["onsiteSource"] = "booked";
  const actual = checkedInMinutes(edit?.arrivedAt, edit?.doneAt);
  if (edit?.onsiteMinutes != null) {
    onsiteMinutes = edit.onsiteMinutes;
    onsiteSource = "edited";
  } else if (actual !== null) {
    if (actual - facts.plannedMinutes > settings.reviewOverMinutes) {
      flags.push({
        code: "over_time",
        minutes: actual,
        message: `Checked in for ${formatMinutes(actual)}, booked for ${formatMinutes(facts.plannedMinutes)}`,
      });
    } else {
      onsiteMinutes = actual;
      onsiteSource = "checked_in";
    }
  }
  if (facts.pendingRequest && edit?.onsiteMinutes == null) {
    flags.push({
      code: "time_request",
      minutes: facts.pendingRequest.onsiteMinutes,
      message: `Asked for ${formatMinutes(facts.pendingRequest.onsiteMinutes)} on site`,
    });
  }

  // ── Pay for the shoot itself ──
  const override = member.rateOverride;
  if (plan.baseType === "hourly") {
    const rate = override ?? plan.baseRateCents;
    parts.push({
      label: `On site · ${formatMinutes(onsiteMinutes)} × ${formatCentsShort(rate)}/hr`,
      cents: Math.round((onsiteMinutes / 60) * rate),
    });
  } else if (plan.baseType === "per_shoot") {
    parts.push({ label: "Shoot", cents: override ?? plan.baseRateCents });
  } else if (plan.baseType === "per_service") {
    let any = false;
    for (const service of facts.services) {
      const cents = service.id ? plan.serviceRates[service.id] : undefined;
      if (typeof cents === "number" && cents > 0) {
        parts.push({ label: service.name, cents });
        any = true;
      }
    }
    if (!any) {
      const names = facts.services.map((s) => s.name).filter(Boolean).join(", ");
      flags.push({ code: "no_rate", message: names ? `No pay set for ${names}` : "No service on this shoot to pay for" });
    }
  } else {
    const percent = override !== null ? override / 100 : plan.percent;
    if (facts.priceCents === null) {
      flags.push({ code: "no_price", message: "No estimate on this project to take a share of" });
    } else {
      parts.push({
        label: `${percent}% of ${formatCentsShort(facts.priceCents)}`,
        cents: Math.round((facts.priceCents * percent) / 100),
      });
    }
  }

  // ── Driving ──
  const paysDrive = plan.driveType === "hour" || plan.driveType === "mile" || plan.driveType === "both";
  const drive = facts.drive;
  // Driving that isn't paid by time or distance isn't tracked: hours here are paid hours.
  const countFirst = drive && paysDrive ? drive.from === "previous" || plan.payFirstDrive : false;
  const countHome = drive && paysDrive ? plan.payDriveHome && (drive.outMinutes > 0 || drive.outMiles > 0) : false;
  let driveMinutes = drive ? (countFirst ? drive.inMinutes : 0) + (countHome ? drive.outMinutes : 0) : 0;
  let miles = drive ? (countFirst ? drive.inMiles : 0) + (countHome ? drive.outMiles : 0) : 0;
  if (edit?.driveMinutes != null) driveMinutes = edit.driveMinutes;
  if (edit?.miles != null) miles = Number(edit.miles);
  miles = Math.round(miles * 10) / 10;

  if (paysDrive) {
    if (!drive && edit?.driveMinutes == null && edit?.miles == null) {
      flags.push({ code: "no_drive", message: "Couldn't work out the drive for this address" });
    }
    if (plan.driveType !== "mile" && driveMinutes > 0) {
      parts.push({
        label: `Driving · ${formatMinutes(driveMinutes)} × ${formatCentsShort(plan.driveHourCents)}/hr`,
        cents: Math.round((driveMinutes / 60) * plan.driveHourCents),
      });
    }
    if (plan.driveType !== "hour" && miles > 0) {
      parts.push({
        label: `Mileage · ${formatMilesShort(miles)} × ${formatMileRate(plan.mileCents)}`,
        cents: Math.round(miles * plan.mileCents),
      });
    }
  } else if (plan.driveType === "travel_fee" && facts.travelFeeCents > 0) {
    parts.push({ label: "Client's travel fee", cents: facts.travelFeeCents });
  }

  // ── Minimum, then the owner's own amount if they set one ──
  const subtotal = parts.reduce((sum, p) => sum + p.cents, 0);
  if (plan.minPerShootCents > subtotal && !flags.some((f) => f.code === "no_rate" || f.code === "no_price")) {
    parts.push({ label: `Minimum per shoot (${formatCentsShort(plan.minPerShootCents)})`, cents: plan.minPerShootCents - subtotal });
  }
  const computed = parts.reduce((sum, p) => sum + p.cents, 0);
  const amountEdited = edit?.amountCents != null;

  return {
    ...blankLine(),
    id: facts.proposalId,
    kind: "shoot",
    proposalId: facts.proposalId,
    projectId: facts.projectId,
    dateKey: facts.dateKey,
    startIso: facts.startIso,
    title: facts.title,
    detail: facts.address,
    services: facts.services.map((s) => s.name).filter(Boolean),
    plannedMinutes: facts.plannedMinutes,
    onsiteMinutes,
    onsiteSource,
    driveMinutes,
    miles,
    driveFrom: drive?.from ?? null,
    includesDriveHome: countHome,
    parts,
    amountCents: amountEdited ? (edit!.amountCents as number) : computed,
    amountEdited,
    note: edit?.note ?? null,
    upcoming: facts.upcoming,
    // An amount the owner typed in settles the line: nothing left to review.
    flags: amountEdited ? flags.filter((f) => f.code === "time_request") : flags,
    request: facts.pendingRequest,
    checkIn: edit?.arrivedAt || edit?.doneAt ? { arrivedAt: edit.arrivedAt ?? null, doneAt: edit.doneAt ?? null } : null,
  };
}

/** A shoot cancelled too late to rebook: the flat fee from Settings. */
export function lateCancelLine(
  shoot: { proposalId: string; projectId: string; dateKey: string; startIso: string; title: string; address: string | null },
  feeCents: number,
  hoursBefore: number
): PayLine {
  return {
    ...blankLine(),
    id: `cancel:${shoot.proposalId}`,
    kind: "late_cancel",
    proposalId: shoot.proposalId,
    projectId: shoot.projectId,
    dateKey: shoot.dateKey,
    startIso: shoot.startIso,
    title: shoot.title,
    detail: shoot.address,
    parts: [{ label: `Cancelled ${hoursBefore < 1 ? "under an hour" : `${Math.round(hoursBefore)} hr`} before the shoot`, cents: feeCents }],
    amountCents: feeCents,
  };
}

/** True when a cancellation counts as late under the business's rule. */
export function isLateCancel(startIso: string, cancelledAtIso: string | null, windowHours: number): boolean {
  if (!cancelledAtIso) return false;
  const gap = Date.parse(startIso) - Date.parse(cancelledAtIso);
  return Number.isFinite(gap) && gap <= windowHours * 3_600_000;
}

export function adjustmentLine(row: AdjustmentRow): PayLine {
  return {
    ...blankLine(),
    id: `adj:${row.id}`,
    kind: "adjustment",
    dateKey: row.dateKey,
    title: row.label || ADJUSTMENT_LABEL[row.kind],
    detail: ADJUSTMENT_LABEL[row.kind],
    parts: [{ label: ADJUSTMENT_LABEL[row.kind], cents: row.amountCents }],
    amountCents: row.amountCents,
    adjustmentKind: row.kind,
  };
}

export function totalsOf(lines: PayLine[]): StatementTotals {
  const totals: StatementTotals = {
    amountCents: 0,
    shoots: 0,
    onsiteMinutes: 0,
    driveMinutes: 0,
    miles: 0,
    adjustmentsCents: 0,
    upcomingShoots: 0,
    upcomingCents: 0,
  };
  for (const line of lines) {
    if (line.upcoming) {
      totals.upcomingShoots += 1;
      totals.upcomingCents += line.amountCents;
      continue;
    }
    totals.amountCents += line.amountCents;
    if (line.kind === "shoot") {
      totals.shoots += 1;
      totals.onsiteMinutes += line.onsiteMinutes;
      totals.driveMinutes += line.driveMinutes;
      totals.miles += line.miles;
    } else if (line.kind === "adjustment") {
      totals.adjustmentsCents += line.amountCents;
    }
  }
  totals.miles = Math.round(totals.miles * 10) / 10;
  return totals;
}

/** Weeks (Sunday start) where an employee's paid time passes 40 hours. */
export function overtimeWeeks(lines: PayLine[]): { weekStart: string; minutes: number }[] {
  const byWeek = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "shoot" || line.upcoming) continue;
    const key = weekStart(line.dateKey);
    byWeek.set(key, (byWeek.get(key) ?? 0) + line.onsiteMinutes + line.driveMinutes);
  }
  return [...byWeek.entries()]
    .filter(([, minutes]) => minutes > OVERTIME_WEEK_MINUTES)
    .map(([week, minutes]) => ({ weekStart: week, minutes }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * An open period's statement. `todayKey` decides whether the period is still running
 * ("in_progress") or over and waiting on the owner ("to_review" / "ready").
 */
export function buildStatement(args: {
  userId: string;
  period: PayPeriod;
  lines: PayLine[];
  workerType: WorkerType;
  todayKey: string;
}): PayStatement {
  const lines = [...args.lines].sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || (a.startIso ?? "~").localeCompare(b.startIso ?? "~") || a.id.localeCompare(b.id)
  );
  const reviewCount = lines.filter((l) => !l.upcoming && l.flags.length > 0).length;
  const ended = args.todayKey > args.period.end;
  const status: StatementStatus = reviewCount > 0 ? "to_review" : ended ? "ready" : "in_progress";
  return {
    userId: args.userId,
    period: args.period,
    status,
    lines,
    totals: totalsOf(lines),
    reviewCount,
    overtimeWeeks: args.workerType === "employee" ? overtimeWeeks(lines) : [],
    approvedAt: null,
    paid: null,
  };
}

/** The example in the pay plan builder: a 2-hour shoot, 35 minutes and 24 miles away. */
export const EXAMPLE_SHOOT = { onsiteMinutes: 120, driveMinutes: 35, miles: 24, priceCents: 27500, travelFeeCents: 2500 };

export function exampleLine(plan: PayPlan, exampleServices: { id: string; name: string }[]): PayLine {
  return computeShootLine(
    {
      proposalId: "example",
      projectId: "example",
      userId: "example",
      startIso: "2026-01-05T15:00:00.000Z",
      dateKey: "2026-01-05",
      plannedMinutes: EXAMPLE_SHOOT.onsiteMinutes,
      title: "Example shoot",
      address: null,
      services: exampleServices,
      priceCents: EXAMPLE_SHOOT.priceCents,
      travelFeeCents: EXAMPLE_SHOOT.travelFeeCents,
      // The example is the day's only shoot: half the drive each way.
      drive: {
        inMinutes: EXAMPLE_SHOOT.driveMinutes,
        inMiles: EXAMPLE_SHOOT.miles,
        from: "home",
        outMinutes: EXAMPLE_SHOOT.driveMinutes,
        outMiles: EXAMPLE_SHOOT.miles,
      },
      edit: null,
      pendingRequest: null,
      upcoming: false,
    },
    plan,
    { rateOverride: null },
    { reviewOverMinutes: 30 }
  );
}
