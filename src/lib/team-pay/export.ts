/**
 * Team pay — exports (pure). CSV text for spreadsheets and payroll tools.
 *
 * The QuickBooks and Gusto files are laid out for those tools' CSV imports (bills per
 * contractor, hours per employee); ShootPortal never files taxes or moves money.
 */
import { formatPeriod } from "./periods";
import type { PayLine, PayPeriod, PayStatement, TeamPayPerson } from "./types";

export type ExportFormat = "summary" | "detail" | "quickbooks_bills" | "quickbooks_time" | "gusto_hours";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "summary", label: "Summary", hint: "One row per person" },
  { id: "detail", label: "Every shoot", hint: "One row per shoot and adjustment" },
  { id: "quickbooks_bills", label: "QuickBooks bills", hint: "Contractors, one bill each" },
  { id: "quickbooks_time", label: "QuickBooks time", hint: "Employees' hours by day" },
  { id: "gusto_hours", label: "Gusto hours", hint: "Employees' hours and extra pay" },
];

type Entry = { person: TeamPayPerson; statement: PayStatement };

/** Quotes a cell; values that could run as a spreadsheet formula get a leading apostrophe. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
const hours = (minutes: number) => (minutes / 60).toFixed(2);
const usDate = (key: string) => `${key.slice(5, 7)}/${key.slice(8, 10)}/${key.slice(0, 4)}`;
const counted = (lines: PayLine[]) => lines.filter((l) => !l.upcoming);
const workerLabel = (p: TeamPayPerson) => (p.workerType === "employee" ? "Employee (W-2)" : "Contractor (1099)");

function statusLabel(statement: PayStatement): string {
  if (statement.status === "paid") return "Paid";
  if (statement.status === "approved") return "Approved";
  if (statement.status === "to_review") return "To review";
  return statement.status === "ready" ? "Ready to approve" : "In progress";
}

export function summaryCsv(period: PayPeriod, entries: Entry[]): string {
  const rows: (string | number | null)[][] = [
    ["Pay period", "Team member", "Email", "Type", "Pay plan", "Shoots", "Hours on site", "Hours driving", "Miles", "Adjustments", "Total", "Status", "Paid on", "Paid by", "Reference"],
  ];
  for (const { person, statement } of entries) {
    const t = statement.totals;
    rows.push([
      formatPeriod(period),
      person.name,
      person.email,
      workerLabel(person),
      person.plan?.name ?? "",
      t.shoots,
      hours(t.onsiteMinutes),
      hours(t.driveMinutes),
      t.miles.toFixed(1),
      dollars(t.adjustmentsCents),
      dollars(t.amountCents),
      statusLabel(statement),
      statement.paid ? usDate(statement.paid.at.slice(0, 10)) : "",
      statement.paid?.method ?? "",
      statement.paid?.reference ?? "",
    ]);
  }
  return toCsv(rows);
}

export function detailCsv(period: PayPeriod, entries: Entry[]): string {
  const rows: (string | number | null)[][] = [
    ["Pay period", "Team member", "Date", "Type", "Item", "Address", "Services", "Hours on site", "Hours driving", "Miles", "How it was worked out", "Amount", "Note"],
  ];
  for (const { person, statement } of entries) {
    for (const line of counted(statement.lines)) {
      rows.push([
        formatPeriod(period),
        person.name,
        usDate(line.dateKey),
        line.kind === "shoot" ? "Shoot" : line.kind === "late_cancel" ? "Late cancellation" : line.detail ?? "Adjustment",
        line.title,
        line.kind === "adjustment" ? "" : line.detail ?? "",
        line.services.join("; "),
        line.kind === "shoot" ? hours(line.onsiteMinutes) : "",
        line.kind === "shoot" ? hours(line.driveMinutes) : "",
        line.kind === "shoot" ? line.miles.toFixed(1) : "",
        line.amountEdited ? "Amount set by hand" : line.parts.map((p) => `${p.label}: ${dollars(p.cents)}`).join("; "),
        dollars(line.amountCents),
        line.note ?? "",
      ]);
    }
  }
  return toCsv(rows);
}

/** One bill per contractor for the period, a line per shoot (QuickBooks Online bill import). */
export function quickBooksBillsCsv(period: PayPeriod, entries: Entry[]): string {
  const rows: (string | number | null)[][] = [["Bill No", "Vendor", "Bill Date", "Due Date", "Account", "Line Description", "Line Amount", "Memo"]];
  for (const { person, statement } of entries) {
    if (person.workerType !== "contractor") continue;
    const billNo = `PAY-${period.end.replace(/-/g, "")}-${person.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "TEAM"}`;
    for (const line of counted(statement.lines)) {
      if (!line.amountCents) continue;
      rows.push([
        billNo,
        person.name,
        usDate(period.end),
        usDate(period.end),
        "Contract labor",
        `${usDate(line.dateKey)} ${line.title}${line.kind === "late_cancel" ? " (late cancellation)" : ""}`,
        dollars(line.amountCents),
        `Pay period ${formatPeriod(period)}`,
      ]);
    }
  }
  return toCsv(rows);
}

function employeeDays(statement: PayStatement): { dateKey: string; minutes: number }[] {
  const byDay = new Map<string, number>();
  for (const line of counted(statement.lines)) {
    if (line.kind !== "shoot") continue;
    byDay.set(line.dateKey, (byDay.get(line.dateKey) ?? 0) + line.onsiteMinutes + line.driveMinutes);
  }
  return [...byDay.entries()].map(([dateKey, minutes]) => ({ dateKey, minutes })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Hours per employee per day (QuickBooks time import). */
export function quickBooksTimeCsv(period: PayPeriod, entries: Entry[]): string {
  const rows: (string | number | null)[][] = [["Employee", "Date", "Hours", "Service Item", "Billable", "Notes"]];
  for (const { person, statement } of entries) {
    if (person.workerType !== "employee") continue;
    for (const day of employeeDays(statement)) {
      rows.push([person.name, usDate(day.dateKey), hours(day.minutes), "Photography", "N", `Pay period ${formatPeriod(period)}`]);
    }
  }
  return toCsv(rows);
}

/** Period totals per employee: hours, plus pay that isn't hourly, as extra earnings. */
export function gustoHoursCsv(period: PayPeriod, entries: Entry[]): string {
  const rows: (string | number | null)[][] = [["Employee", "Email", "Regular Hours", "Reimbursement", "Bonus", "Total Pay (reference)", "Pay Period"]];
  for (const { person, statement } of entries) {
    if (person.workerType !== "employee") continue;
    const lines = counted(statement.lines);
    const sum = (kind: string) => lines.filter((l) => l.adjustmentKind === kind).reduce((s, l) => s + l.amountCents, 0);
    rows.push([
      person.name,
      person.email,
      hours(statement.totals.onsiteMinutes + statement.totals.driveMinutes),
      dollars(sum("reimbursement")),
      dollars(sum("bonus")),
      dollars(statement.totals.amountCents),
      formatPeriod(period),
    ]);
  }
  return toCsv(rows);
}

export function buildExport(format: ExportFormat, period: PayPeriod, entries: Entry[]): { filename: string; csv: string } {
  const stamp = `${period.start}_to_${period.end}`;
  if (format === "detail") return { filename: `team-pay-shoots_${stamp}.csv`, csv: detailCsv(period, entries) };
  if (format === "quickbooks_bills") return { filename: `quickbooks-bills_${stamp}.csv`, csv: quickBooksBillsCsv(period, entries) };
  if (format === "quickbooks_time") return { filename: `quickbooks-time_${stamp}.csv`, csv: quickBooksTimeCsv(period, entries) };
  if (format === "gusto_hours") return { filename: `gusto-hours_${stamp}.csv`, csv: gustoHoursCsv(period, entries) };
  return { filename: `team-pay-summary_${stamp}.csv`, csv: summaryCsv(period, entries) };
}
