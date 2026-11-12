/**
 * PDF copy of a ShootPortal payment receipt (pdf-lib, no extra dependencies).
 * Renders only what is on the PaymentReceipt object — nothing is added or guessed here.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PaymentReceipt } from "@/lib/payment-receipt";
import { formatReceiptMoney, receiptDateLabel, receiptStatusLabel } from "@/lib/payment-receipt-format";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.53);
const LINE = rgb(0.89, 0.91, 0.94);
const GREEN = rgb(0.02, 0.47, 0.34);
const GREEN_BG = rgb(0.86, 0.97, 0.91);
const AMBER = rgb(0.67, 0.36, 0.02);
const AMBER_BG = rgb(1, 0.95, 0.85);
const SLATE_BG = rgb(0.95, 0.96, 0.97);

export type ReceiptLogo = { bytes: Uint8Array; type: "png" | "jpg" };

/** Fetch the business logo for embedding. Any failure means "no logo", never a failed PDF. */
export async function loadReceiptLogo(url: string | null | undefined): Promise<ReceiptLogo | null> {
  const trimmed = url?.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(trimmed, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isPng) return { bytes, type: "png" };
    if (isJpg) return { bytes, type: "jpg" };
    const sharp = (await import("sharp")).default;
    const png = await sharp(bytes).resize({ height: 240, withoutEnlargement: true }).png().toBuffer();
    return { bytes: new Uint8Array(png), type: "png" };
  } catch {
    return null;
  }
}

function safeText(font: PDFFont, text: string): string {
  const normalized = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/\s+/g, " ").trim();
  try {
    font.encodeText(normalized);
    return normalized;
  } catch {
    return normalized.replace(/[^\x20-\x7E -ÿ–—•]/g, "");
  }
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = safeText(font, text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = safeText(font, text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

export async function buildPaymentReceiptPdf(receipt: PaymentReceipt, logo?: ReceiptLogo | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${receipt.title} ${receipt.receiptNumber}`);
  doc.setAuthor(receipt.business.name || "ShootPortal");
  doc.setProducer("ShootPortal");
  doc.setCreator("ShootPortal");
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const right = PAGE_W - M;
  const contentW = PAGE_W - M * 2;
  let y = PAGE_H - M;

  const text = (t: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(safeText(f, t), { x, y: yy, size, font: f, color });
  const textRight = (t: string, xr: number, yy: number, size: number, f: PDFFont = font, color = INK) => {
    const s = safeText(f, t);
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });
  };
  const rule = (yy: number, thickness = 0.75) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: right, y: yy }, thickness, color: LINE });
  const ensure = (needed: number) => {
    if (y - needed < M + 40) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  };

  // Header: logo (or business name) on the left, title + status on the right.
  let headerBottom = y;
  let drewLogo = false;
  if (logo) {
    try {
      const image = logo.type === "png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
      const scale = Math.min(170 / image.width, 52 / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: M, y: y - h, width: w, height: h });
      headerBottom = Math.min(headerBottom, y - h);
      drewLogo = true;
    } catch {
      drewLogo = false; // a broken logo must not block the receipt
    }
  }
  if (!drewLogo && receipt.business.name) {
    text(fit(bold, receipt.business.name, 16, contentW / 2), M, y - 16, 16, bold);
    headerBottom = Math.min(headerBottom, y - 20);
  }
  textRight(receipt.title, right, y - 18, 20, bold);
  const status = receiptStatusLabel(receipt).toUpperCase();
  const pillColors =
    receipt.status === "paid" ? (receipt.kind === "manual" ? [SLATE_BG, MUTED] : [GREEN_BG, GREEN]) : [AMBER_BG, AMBER];
  const pillW = bold.widthOfTextAtSize(status, 8.5) + 16;
  page.drawRectangle({ x: right - pillW, y: y - 44, width: pillW, height: 16, color: pillColors[0] });
  textRight(status, right - 8, y - 39.5, 8.5, bold, pillColors[1]);
  textRight(receipt.receiptNumber, right, y - 60, 9.5, font, MUTED);
  y = Math.min(headerBottom, y - 64) - 22;

  // Business block
  const bizLines = [
    ...(drewLogo && receipt.business.name ? [receipt.business.name] : []),
    ...receipt.business.addressLines,
    receipt.business.email,
    receipt.business.phone,
    receipt.business.website,
  ].filter(Boolean);
  bizLines.forEach((line, i) => {
    text(fit(i === 0 && drewLogo ? bold : font, line, 9.5, contentW / 2), M, y, 9.5, i === 0 && drewLogo ? bold : font, i === 0 && drewLogo ? INK : MUTED);
    y -= 13;
  });
  y -= 10;

  // Amount hero
  rule(y);
  y -= 30;
  const netCents = receipt.totalCents - receipt.refundedCents;
  text(receipt.kind === "manual" ? "Amount recorded" : "Amount paid", M, y + 8, 9, font, MUTED);
  text(formatReceiptMoney(receipt.totalCents, receipt.currency), M, y - 16, 24, bold);
  textRight(receipt.currency.toUpperCase(), right, y - 12, 10, bold, MUTED);
  y -= 34;
  rule(y);
  y -= 22;

  // Details grid (two columns)
  const details: [string, string][] = [
    ["Receipt number", receipt.receiptNumber],
    ["Date paid", receiptDateLabel(receipt.paidAt)],
    ["Payment method", receipt.methodLabel || "Not available"],
    ["Status", receiptStatusLabel(receipt)],
    ...(receipt.clientName ? ([["Billed to", receipt.clientName]] as [string, string][]) : []),
    ...(receipt.projectName ? ([["Project", receipt.projectName]] as [string, string][]) : []),
    ...(receipt.propertyAddress ? ([["Property", receipt.propertyAddress]] as [string, string][]) : []),
    ["Payment reference", receipt.paymentId],
    ...(receipt.verification.paymentIntentId && receipt.kind === "stripe"
      ? ([["Stripe reference", receipt.verification.paymentIntentId]] as [string, string][])
      : []),
  ];
  const colW = contentW / 2 - 12;
  for (let i = 0; i < details.length; i += 2) {
    ensure(36);
    for (let c = 0; c < 2; c++) {
      const item = details[i + c];
      if (!item) continue;
      const x = M + c * (contentW / 2 + 12);
      text(item[0].toUpperCase(), x, y, 7.5, bold, MUTED);
      text(fit(font, item[1], 10.5, colW), x, y - 14, 10.5);
    }
    y -= 34;
  }
  y -= 6;

  // Line items
  ensure(60);
  text("DESCRIPTION", M, y, 7.5, bold, MUTED);
  textRight("AMOUNT", right, y, 7.5, bold, MUTED);
  y -= 8;
  rule(y);
  y -= 18;
  for (const line of receipt.lineItems) {
    const rows = wrap(font, line.label, 10.5, contentW - 110);
    ensure(rows.length * 14 + 10);
    rows.forEach((row, i) => text(row, M, y - i * 14, 10.5, font, line.muted ? MUTED : INK));
    textRight(formatReceiptMoney(line.amountCents, receipt.currency), right, y, 10.5, font, line.muted ? MUTED : INK);
    y -= rows.length * 14 + 8;
  }
  rule(y + 2);
  y -= 16;
  const totalRow = (label: string, cents: number, emphasize = false, color = INK) => {
    ensure(20);
    text(label, right - 260, y, emphasize ? 11 : 10, emphasize ? bold : font, color);
    textRight(formatReceiptMoney(cents, receipt.currency), right, y, emphasize ? 11 : 10, emphasize ? bold : font, color);
    y -= 18;
  };
  totalRow(receipt.kind === "manual" ? "Total recorded" : "Total paid", receipt.totalCents, true);
  if (receipt.refundedCents > 0) {
    totalRow(
      `Refunded${receipt.lastRefundAt ? ` (${receiptDateLabel(receipt.lastRefundAt)})` : ""}`,
      -receipt.refundedCents,
      false,
      AMBER
    );
    totalRow("Net paid", netCents, true);
  }
  y -= 6;

  if (receipt.appliedToward) {
    for (const row of wrap(font, receipt.appliedToward, 9.5, contentW)) {
      ensure(14);
      text(row, M, y, 9.5, font, MUTED);
      y -= 13;
    }
    y -= 6;
  }

  if (receipt.notes.length) {
    y -= 4;
    for (const note of receipt.notes) {
      const rows = wrap(font, note, 9, contentW - 20);
      ensure(rows.length * 12 + 16);
      const boxH = rows.length * 12 + 12;
      page.drawRectangle({ x: M, y: y - boxH + 12, width: contentW, height: boxH, color: SLATE_BG });
      rows.forEach((row, i) => text(row, M + 10, y - i * 12, 9, font, MUTED));
      y -= boxH + 8;
    }
  }

  // Footer on every page
  const generated = receiptDateLabel(new Date().toISOString());
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: right, y: M + 18 }, thickness: 0.5, color: LINE });
    const footer = safeText(font, `${receipt.receiptNumber} · Generated ${generated} · Keep this receipt for your records.`);
    p.drawText(footer, { x: M, y: M + 4, size: 8, font, color: MUTED });
  }

  return doc.save();
}

export function receiptPdfFilename(receipt: Pick<PaymentReceipt, "receiptNumber">): string {
  return `receipt-${receipt.receiptNumber.toLowerCase()}.pdf`;
}
