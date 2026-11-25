/**
 * Team pay — a one-person pay statement as a PDF (pdf-lib, standard fonts).
 * Shows exactly what the statement shows; it is a record of pay, not a tax document.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDateKey, formatPeriod } from "./periods";
import { formatCents, formatHours, formatMilesShort, formatMinutes, type PayStatement } from "./types";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.53);
const LINE = rgb(0.89, 0.91, 0.94);
const BAND = rgb(0.96, 0.97, 0.98);

/** Standard fonts only cover WinAnsi: anything else becomes "?" instead of crashing the PDF. */
function safe(font: PDFFont, value: string): string {
  let out = "";
  for (const ch of value.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function fit(font: PDFFont, value: string, size: number, maxWidth: number): string {
  let t = safe(font, value);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

export async function buildPayStubPdf(input: {
  businessName: string;
  personName: string;
  workerType: "contractor" | "employee";
  planSummary: string;
  statement: PayStatement;
}): Promise<Uint8Array> {
  const { statement } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Pay statement ${formatPeriod(statement.period)} - ${input.personName}`);
  doc.setAuthor(input.businessName || "Pay statement");
  doc.setProducer(input.businessName || "Pay statement");
  doc.setCreator(input.businessName || "Pay statement");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  const right = PAGE_W - M;
  let y = PAGE_H - M;

  const text = (t: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(safe(f, t), { x, y: yy, size, font: f, color });
  const textRight = (t: string, xr: number, yy: number, size: number, f: PDFFont = font, color = INK) => {
    const s = safe(f, t);
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: right, y: yy }, thickness: 0.75, color: LINE });

  // Columns: date · item · on site · driving · amount
  const col = { date: M, item: M + 62, onsite: 372, drive: 470, amount: right };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 18, width: right - M, height: 20, color: BAND });
    text("DATE", col.date + 6, y - 12, 7.5, bold, MUTED);
    text("SHOOT", col.item, y - 12, 7.5, bold, MUTED);
    textRight("ON SITE", col.onsite, y - 12, 7.5, bold, MUTED);
    textRight("DRIVING", col.drive, y - 12, 7.5, bold, MUTED);
    textRight("PAY", col.amount - 6, y - 12, 7.5, bold, MUTED);
    y -= 30;
  };
  const ensure = (needed: number) => {
    if (y - needed < M + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
      header();
    }
  };

  // Header
  text(fit(bold, input.businessName || "Pay statement", 15, 300), M, y - 14, 15, bold);
  textRight("Pay statement", right, y - 16, 18, bold);
  textRight(formatPeriod(statement.period), right, y - 32, 10, font, MUTED);
  y -= 58;
  rule(y);
  y -= 22;

  text("PAID TO", M, y, 7.5, bold, MUTED);
  text("STATUS", 330, y, 7.5, bold, MUTED);
  y -= 15;
  text(fit(bold, input.personName, 12, 250), M, y, 12, bold);
  const status =
    statement.status === "paid"
      ? `Paid ${statement.paid ? formatDateKey(statement.paid.at.slice(0, 10), { year: true }) : ""}${statement.paid?.method ? ` by ${statement.paid.method}` : ""}`
      : statement.status === "approved"
        ? "Approved, not yet paid"
        : "Not approved yet (numbers can still change)";
  text(fit(font, status, 10.5, right - 330), 330, y, 10.5);
  y -= 14;
  text(input.workerType === "employee" ? "Employee" : "Contractor", M, y, 9.5, font, MUTED);
  if (statement.paid?.reference) text(fit(font, `Reference: ${statement.paid.reference}`, 9.5, right - 330), 330, y, 9.5, font, MUTED);
  y -= 13;
  if (input.planSummary) text(fit(font, input.planSummary, 9.5, right - M), M, y, 9.5, font, MUTED);
  y -= 26;

  header();
  const lines = statement.lines.filter((l) => !l.upcoming);
  if (!lines.length) {
    text("No shoots in this pay period.", col.item, y, 10, font, MUTED);
    y -= 20;
  }
  for (const line of lines) {
    const sub =
      line.kind === "adjustment"
        ? line.detail ?? ""
        : line.kind === "late_cancel"
          ? `Late cancellation${line.detail ? ` - ${line.detail}` : ""}`
          : line.detail ?? "";
    const how = line.amountEdited ? "Amount set by hand" : line.parts.map((p) => p.label).join("  |  ");
    ensure(sub || how ? 40 : 24);
    text(formatDateKey(line.dateKey), col.date + 6, y, 9.5);
    text(fit(bold, line.title, 10, col.onsite - col.item - 70), col.item, y, 10, bold);
    if (line.kind === "shoot") {
      textRight(formatMinutes(line.onsiteMinutes), col.onsite, y, 9.5);
      textRight(line.driveMinutes || line.miles ? `${formatMinutes(line.driveMinutes)} / ${formatMilesShort(line.miles)}` : "-", col.drive, y, 9.5);
    }
    textRight(formatCents(line.amountCents), col.amount - 6, y, 10, bold);
    y -= 12;
    if (sub) {
      text(fit(font, sub, 8.5, col.drive - col.item), col.item, y, 8.5, font, MUTED);
      y -= 11;
    }
    if (how && line.kind === "shoot") {
      text(fit(font, how, 8, right - col.item - 6), col.item, y, 8, font, MUTED);
      y -= 11;
    }
    if (line.note) {
      ensure(14);
      text(fit(font, `Note: ${line.note}`, 8.5, right - col.item - 6), col.item, y, 8.5, font, MUTED);
      y -= 11;
    }
    y -= 4;
    rule(y);
    y -= 14;
  }

  // Totals
  ensure(90);
  const t = statement.totals;
  y -= 6;
  page.drawRectangle({ x: 330, y: y - 62, width: right - 330, height: 74, color: BAND });
  text(`${t.shoots} shoot${t.shoots === 1 ? "" : "s"}`, M, y - 4, 10);
  text(`${formatHours(t.onsiteMinutes)} on site`, M, y - 20, 10);
  text(`${formatHours(t.driveMinutes)} driving, ${formatMilesShort(t.miles)}`, M, y - 36, 10);
  text("Adjustments", 342, y - 6, 9.5, font, MUTED);
  textRight(formatCents(t.adjustmentsCents), right - 12, y - 6, 9.5);
  text("Total pay", 342, y - 36, 11, bold);
  textRight(formatCents(t.amountCents), right - 12, y - 40, 18, bold);
  y -= 92;

  ensure(20);
  text("A record of pay for shoots. Not a tax form: taxes and withholding are handled by your payroll or accountant.", M, y, 8, font, MUTED);

  return doc.save();
}
