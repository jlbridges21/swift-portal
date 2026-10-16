/**
 * Client-side PDF export for the quote and invoice builders (and the drone calculator's quote).
 * Loaded with dynamic import() only when the visitor clicks Download.
 */
import { rgb } from "pdf-lib";
import { formatMoney } from "@/lib/tools/pricing-math";
import { addDays, formatDate, invoiceAmounts, type Quote } from "@/lib/tools/quote-model";
import { ACCENT, ACCENT_DARK, BODY, M, MUTED, PAGE_W, PdfWriter, RULE, TINT, wrap } from "@/lib/tools/pdf-base";

const TINT_TEXT = rgb(1, 1, 1);

export async function buildQuotePdf(quote: Quote): Promise<Uint8Array> {
  const isInvoice = quote.kind === "invoice";
  const label = isInvoice ? "Invoice" : "Quote";
  const w = await PdfWriter.create(
    `${label}${quote.number ? ` ${quote.number}` : ""}${quote.project.title ? ` – ${quote.project.title}` : ""}`,
    quote.business.name || ""
  );
  const t = invoiceAmounts(quote);
  const until = quote.issued ? addDays(quote.issued, isInvoice ? quote.dueDays : quote.validDays) : "";

  await w.header(quote.business, label, [
    [isInvoice ? "Invoice no." : "Quote no.", quote.number],
    ["Date", formatDate(quote.issued)],
    [isInvoice ? "Due" : "Valid until", isInvoice || quote.validDays > 0 ? formatDate(until) : ""],
  ]);

  w.parties(
    { label: isInvoice ? "Bill to" : "Prepared for", lines: [quote.client.name || "Client name", quote.client.company, quote.client.email].filter(Boolean) },
    {
      label: "Project",
      lines: [quote.project.title || "Project", quote.project.location, quote.project.date ? `${isInvoice ? "Date of service" : "Shoot date"}: ${formatDate(quote.project.date)}` : ""].filter(Boolean),
    }
  );

  // Line items
  const xQty = PAGE_W - M - 190;
  const xRate = PAGE_W - M - 100;
  const xAmt = PAGE_W - M;
  const tableHead = () => {
    w.page.drawRectangle({ x: M, y: w.y - 6, width: PAGE_W - 2 * M, height: 20, color: TINT });
    w.text("Service", M + 8, w.y, 8.5, w.bold, ACCENT_DARK);
    w.right("Qty", xQty, w.y, 8.5, w.bold, ACCENT_DARK);
    w.right("Rate", xRate, w.y, 8.5, w.bold, ACCENT_DARK);
    w.right("Amount", xAmt - 8, w.y, 8.5, w.bold, ACCENT_DARK);
    w.y -= 26;
  };
  tableHead();
  const included = quote.lines.filter((l) => !l.optional && (l.description || l.unitPrice));
  for (const l of included) {
    const desc = wrap(l.description || "Service", w.bold, 10, xQty - M - 50);
    const detail = l.detail ? wrap(l.detail, w.regular, 8.5, xQty - M - 50) : [];
    const h = desc.length * 13 + detail.length * 11.5;
    if (w.y - h < M + 60) {
      w.ensure(h + 60);
      tableHead();
    }
    desc.forEach((d, i) => w.text(d, M + 8, w.y - i * 13, 10, w.bold));
    detail.forEach((d, i) => w.text(d, M + 8, w.y - desc.length * 13 - i * 11.5 + 1, 8.5, w.regular, MUTED));
    w.right(String(l.quantity), xQty, w.y, 10);
    w.right(formatMoney(l.unitPrice), xRate, w.y, 10, w.regular, BODY);
    w.right(formatMoney(t.lineTotals[l.id] ?? 0), xAmt - 8, w.y, 10, w.bold);
    w.y -= h + 6;
    w.rule(w.y + 4, M, PAGE_W - M, RULE, 0.5);
    w.y -= 12;
  }
  if (!included.length) {
    w.text("No services added yet.", M + 8, w.y, 10, w.regular, MUTED);
    w.y -= 24;
  }

  // Totals
  w.ensure(130);
  const tl = PAGE_W - M - 220;
  const row = (k: string, v: string, o: { strong?: boolean; tint?: boolean } = {}) => {
    if (o.tint) w.page.drawRectangle({ x: tl - 10, y: w.y - 7, width: PAGE_W - M - tl + 10, height: 24, color: ACCENT });
    const size = o.strong || o.tint ? 11.5 : 10;
    const color = o.tint ? TINT_TEXT : o.strong ? undefined : BODY;
    w.text(k, tl, w.y, size, o.strong || o.tint ? w.bold : w.regular, color);
    w.right(v, xAmt - 8, w.y, size, o.strong || o.tint ? w.bold : w.regular, o.tint ? TINT_TEXT : undefined);
    w.y -= o.tint ? 28 : o.strong ? 20 : 16;
  };
  w.y -= 2;
  row("Subtotal", formatMoney(t.subtotal));
  if (t.discount > 0) row(`Discount${quote.discountType === "percent" ? ` (${quote.discountValue}%)` : ""}`, `−${formatMoney(t.discount)}`);
  if (t.tax > 0) row(`Tax (${quote.taxPct}%)`, formatMoney(t.tax));
  w.rule(w.y + 10, tl, PAGE_W - M - 8);
  w.y -= 4;
  if (isInvoice) {
    row("Total", formatMoney(t.total), { strong: true });
    if (t.paid > 0) row("Paid", `−${formatMoney(t.paid)}`);
    w.y -= 4;
    row("Balance due", formatMoney(t.due), { tint: true });
  } else {
    row("Total", formatMoney(t.total), { strong: true });
    if (t.deposit > 0) {
      w.y -= 4;
      row(`Deposit to book${quote.depositType === "percent" ? ` (${quote.depositValue}%)` : ""}`, formatMoney(t.deposit), { tint: true });
      row("Balance on delivery", formatMoney(t.balance));
    }
  }

  // Optional add-ons (quotes only)
  const optional = isInvoice ? [] : quote.lines.filter((l) => l.optional && (l.description || l.unitPrice));
  if (optional.length) {
    w.y -= 14;
    w.heading("Optional add-ons", 20);
    w.text("Not included in the total. Ask to add any of these.", M, w.y + 2, 8.5, w.regular, MUTED);
    w.y -= 16;
    for (const l of optional) {
      w.ensure(16);
      w.text(wrap(l.description || "Add-on", w.regular, 10, 380)[0] ?? "", M, w.y, 10, w.regular, BODY);
      w.right(formatMoney(t.lineTotals[l.id] ?? 0), xAmt - 8, w.y, 10);
      w.y -= 16;
    }
  }

  // Payment, notes, terms
  for (const [title, body] of [
    ["How to pay", isInvoice ? quote.paymentInfo : ""],
    ["Notes", quote.notes],
    [isInvoice ? "Payment terms" : "Terms", quote.terms],
  ] as const) {
    if (!body.trim()) continue;
    w.y -= 12;
    w.heading(title, 26);
    w.paragraph(body);
  }

  // Acceptance (quotes only)
  if (!isInvoice) {
    w.ensure(70);
    w.y -= 40;
    const half = (PAGE_W - 2 * M - 30) / 2;
    w.rule(w.y, M, M + half, MUTED);
    w.rule(w.y, M + half + 30, PAGE_W - M, MUTED);
    w.text("Accepted by (name and signature)", M, w.y - 13, 8.5, w.regular, MUTED);
    w.text("Date", M + half + 30, w.y - 13, 8.5, w.regular, MUTED);
  } else {
    w.ensure(30);
    w.y -= 24;
    w.text("Thank you for your business.", M, w.y, 10, w.bold, ACCENT);
  }

  return w.save([quote.business.name, quote.number ? `${label} ${quote.number}` : ""].filter(Boolean).join("  ·  "));
}
