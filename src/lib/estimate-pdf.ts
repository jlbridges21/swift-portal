import * as fontkitNs from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import {
  quotePaymentTermsText,
  resolveDepositCharge,
  resolveQuoteDepositTerms,
  type DepositTerms,
  type QuoteDepositColumns,
} from "@/lib/payment-quote";
import type { QuoteLineItem } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DepositMode } from "@/lib/workflow-settings";

/**
 * One estimate PDF for the admin preview, the business download, and the
 * client download. Callers pass plain data. This file does not fetch logos
 * or fonts, so a missing asset cannot change the document layout twice.
 */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

export type EstimatePdfLogo = {
  bytes: Uint8Array;
  type: "png" | "jpg";
};

export type EstimatePdfAssets = {
  fontRegular: Uint8Array;
  fontBold: Uint8Array;
  logo?: EstimatePdfLogo | null;
};

export type EstimatePdfInput = {
  businessName: string;
  legalName: string;
  addressLines: string[];
  phone: string;
  email: string;
  website: string;
  brandPrimaryColor: string;
  /** Null until the quote has an id. The reference is the first 8 hex chars. */
  quoteId: string | null;
  /** Stable instant written into the PDF metadata so two renders match. */
  issuedAt: Date;
  expiresAt: string | null;
  clientName: string;
  projectName: string;
  propertyAddress: string;
  title: string;
  description: string;
  notes: string;
  lineItems: QuoteLineItem[];
  /** Portal total. Deposit wording is computed from this, not a second sum. */
  totalCents: number;
  deposit: QuoteDepositColumns;
  depositFallback: DepositTerms;
};

type FontkitLike = {
  create: (buffer: Uint8Array | ArrayBuffer, postscriptName?: string) => unknown;
};

function resolveFontkit(): FontkitLike {
  const ns = fontkitNs as unknown as FontkitLike & { default?: FontkitLike };
  if (typeof ns.create === "function") return ns;
  if (ns.default && typeof ns.default.create === "function") return ns.default;
  throw new Error("Estimate font could not be loaded");
}

/** EST- plus the first 8 hex characters of the quote id. No counter. */
export function estimateReference(quoteId: string): string {
  const hex = quoteId.replace(/[^a-fA-F0-9]/g, "").slice(0, 8).toUpperCase();
  return `EST-${hex}`;
}

export function estimateAddressLines(business: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string[] {
  const cityLine = [business.city, business.state, business.postalCode]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  return [business.addressLine1, business.addressLine2, cityLine, business.country]
    .map((line) => (line || "").trim())
    .filter(Boolean);
}

/**
 * The sentence the client already sees, when the resolved terms are a deposit.
 * Null when approval charges the full total, so the PDF does not invent wording.
 */
export function estimateDepositLine(
  totalCents: number,
  quote: QuoteDepositColumns,
  business: DepositTerms
): string | null {
  const terms = resolveQuoteDepositTerms(quote, business);
  if (!resolveDepositCharge(totalCents, terms).isDeposit) return null;
  return quotePaymentTermsText(totalCents, terms);
}

export function estimateLineItems(items: QuoteLineItem[]): QuoteLineItem[] {
  return items
    .map((item) => ({
      description: (item.description || "").trim(),
      amount_cents: Number(item.amount_cents) || 0,
    }))
    .filter((item) => item.description.length > 0 || item.amount_cents !== 0);
}

function calendarLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseBrandColor(hex: string): RGB {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return rgb(0.035, 0.08, 0.16);
  const value = Number.parseInt(match[1], 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const pieces = splitLongWord(word, font, size, maxWidth);
      for (const piece of pieces) {
        const next = current ? `${current} ${piece}` : piece;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          current = next;
        } else {
          if (current) lines.push(current);
          current = piece;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let current = "";
  for (const char of Array.from(word)) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) parts.push(current);
      current = char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

type Cursor = {
  page: PDFPage;
  y: number;
  pages: PDFPage[];
};

/**
 * pdf-lib names embedded images with Math.random. A fixed sequence keeps two
 * renders of the same estimate byte-for-byte identical.
 */
async function withStableRandom<T>(run: () => Promise<T>): Promise<T> {
  const original = Math.random;
  let state = 0x5eed;
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  try {
    return await run();
  } finally {
    Math.random = original;
  }
}

export async function buildEstimatePdf(
  input: EstimatePdfInput,
  assets: EstimatePdfAssets
): Promise<Uint8Array> {
  return withStableRandom(() => buildEstimatePdfUnstable(input, assets));
}

async function buildEstimatePdfUnstable(
  input: EstimatePdfInput,
  assets: EstimatePdfAssets
): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(resolveFontkit() as unknown as Parameters<PDFDocument["registerFontkit"]>[0]);
  const regular = await doc.embedFont(assets.fontRegular, { subset: true, customName: "EstimateText" });
  const bold = await doc.embedFont(assets.fontBold, { subset: true, customName: "EstimateText-Bold" });
  const brand = parseBrandColor(input.brandPrimaryColor);
  const ink = rgb(0.07, 0.09, 0.13);
  const muted = rgb(0.33, 0.37, 0.43);
  const reference = input.quoteId ? estimateReference(input.quoteId) : null;
  const displayName = input.legalName.trim() || input.businessName.trim() || "Estimate";
  const items = estimateLineItems(input.lineItems);
  const depositLine = estimateDepositLine(input.totalCents, input.deposit, input.depositFallback);

  doc.setTitle(reference ? `${reference} ${input.title}`.trim() : input.title || "Estimate");
  doc.setAuthor(displayName);
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const cursor: Cursor = {
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN_TOP,
    pages: [],
  };
  cursor.pages.push(cursor.page);

  function newPage() {
    cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor.pages.push(cursor.page);
    cursor.y = PAGE_HEIGHT - MARGIN_TOP;
    const continued = reference ? `Estimate ${reference}` : "Estimate";
    draw(continued, { font: bold, size: 10, color: brand });
    draw(displayName, { font: regular, size: 9, color: muted, gap: 8 });
  }

  function ensure(height: number) {
    if (cursor.y - height < MARGIN_BOTTOM) newPage();
  }

  function draw(
    text: string,
    options: { font: PDFFont; size: number; color: RGB; gap?: number; x?: number }
  ) {
    const gap = options.gap ?? 4;
    const lines = wrapText(text, options.font, options.size, CONTENT_WIDTH - ((options.x ?? MARGIN_X) - MARGIN_X));
    const lineHeight = options.size + 3;
    for (const line of lines) {
      ensure(lineHeight);
      if (line) {
        cursor.page.drawText(line, {
          x: options.x ?? MARGIN_X,
          y: cursor.y - options.size,
          size: options.size,
          font: options.font,
          color: options.color,
        });
      }
      cursor.y -= lineHeight;
    }
    cursor.y -= gap;
  }

  let logo: PDFImage | null = null;
  if (assets.logo?.bytes && assets.logo.type) {
    try {
      logo =
        assets.logo.type === "png"
          ? await doc.embedPng(assets.logo.bytes)
          : await doc.embedJpg(assets.logo.bytes);
    } catch {
      logo = null;
    }
  }

  if (logo) {
    const scale = Math.min(150 / logo.width, 46 / logo.height, 1);
    const width = logo.width * scale;
    const height = logo.height * scale;
    ensure(height + 12);
    cursor.page.drawImage(logo, {
      x: MARGIN_X,
      y: cursor.y - height,
      width,
      height,
    });
    cursor.y -= height + 14;
  }

  draw(displayName, { font: bold, size: 14, color: ink, gap: 2 });
  for (const line of input.addressLines) {
    draw(line, { font: regular, size: 9, color: muted, gap: 0 });
  }
  const contact = [input.phone, input.email, input.website].map((value) => value.trim()).filter(Boolean);
  for (const line of contact) {
    draw(line, { font: regular, size: 9, color: muted, gap: 0 });
  }
  cursor.y -= 8;
  ensure(8);
  cursor.page.drawLine({
    start: { x: MARGIN_X, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: cursor.y },
    thickness: 1.25,
    color: brand,
  });
  cursor.y -= 18;

  ensure(28);
  cursor.page.drawText("Estimate", {
    x: MARGIN_X,
    y: cursor.y - 20,
    size: 20,
    font: bold,
    color: brand,
  });
  if (reference) {
    const refWidth = bold.widthOfTextAtSize(reference, 11);
    cursor.page.drawText(reference, {
      x: PAGE_WIDTH - MARGIN_X - refWidth,
      y: cursor.y - 16,
      size: 11,
      font: bold,
      color: ink,
    });
  }
  cursor.y -= 32;

  draw(`Date: ${formatDate(input.issuedAt)}`, { font: regular, size: 10, color: ink, gap: 1 });
  const expires = calendarLabel(input.expiresAt);
  if (expires) draw(`Expires: ${expires}`, { font: regular, size: 10, color: ink, gap: 1 });
  draw(`Client: ${input.clientName.trim() || "Client"}`, { font: regular, size: 10, color: ink, gap: 1 });
  draw(`Project: ${input.projectName.trim() || "Project"}`, { font: regular, size: 10, color: ink, gap: 1 });
  draw(`Property: ${input.propertyAddress.trim() || "—"}`, { font: regular, size: 10, color: ink, gap: 8 });

  if (input.title.trim()) {
    draw(input.title.trim(), { font: bold, size: 13, color: ink, gap: 4 });
  }
  if (input.description.trim()) {
    draw(input.description.trim(), { font: regular, size: 10, color: ink, gap: 10 });
  }

  const amountWidth = 96;
  const descWidth = CONTENT_WIDTH - amountWidth - 12;
  const rowSize = 10;
  const rowLeading = 14;

  function drawTableHeader() {
    ensure(22);
    cursor.page.drawText("Description", {
      x: MARGIN_X,
      y: cursor.y - 11,
      size: 9,
      font: bold,
      color: brand,
    });
    const amountHeader = "Amount";
    const amountHeaderWidth = bold.widthOfTextAtSize(amountHeader, 9);
    cursor.page.drawText(amountHeader, {
      x: PAGE_WIDTH - MARGIN_X - amountHeaderWidth,
      y: cursor.y - 11,
      size: 9,
      font: bold,
      color: brand,
    });
    cursor.y -= 16;
    cursor.page.drawLine({
      start: { x: MARGIN_X, y: cursor.y },
      end: { x: PAGE_WIDTH - MARGIN_X, y: cursor.y },
      thickness: 0.6,
      color: brand,
    });
    cursor.y -= 8;
  }

  drawTableHeader();

  const rows = items.length > 0 ? items : [{ description: "—", amount_cents: 0 }];
  for (const item of rows) {
    const descLines = wrapText(item.description || "—", regular, rowSize, descWidth);
    const amount = formatCurrency(item.amount_cents);
    for (let index = 0; index < descLines.length; index++) {
      if (cursor.y - rowLeading < MARGIN_BOTTOM) {
        newPage();
        drawTableHeader();
      }
      cursor.page.drawText(descLines[index], {
        x: MARGIN_X,
        y: cursor.y - rowSize,
        size: rowSize,
        font: regular,
        color: ink,
      });
      if (index === 0) {
        const width = regular.widthOfTextAtSize(amount, rowSize);
        cursor.page.drawText(amount, {
          x: PAGE_WIDTH - MARGIN_X - width,
          y: cursor.y - rowSize,
          size: rowSize,
          font: regular,
          color: ink,
        });
      }
      cursor.y -= rowLeading;
    }
    cursor.y -= 2;
  }

  cursor.y -= 4;
  ensure(20);
  cursor.page.drawLine({
    start: { x: MARGIN_X, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: cursor.y },
    thickness: 0.6,
    color: brand,
  });
  cursor.y -= 16;
  const total = `Total ${formatCurrency(input.totalCents)}`;
  const totalWidth = bold.widthOfTextAtSize(total, 12);
  ensure(16);
  cursor.page.drawText(total, {
    x: PAGE_WIDTH - MARGIN_X - totalWidth,
    y: cursor.y - 12,
    size: 12,
    font: bold,
    color: ink,
  });
  cursor.y -= 22;

  if (depositLine) {
    draw(depositLine, { font: regular, size: 10, color: ink, gap: 8 });
  }

  if (input.notes.trim()) {
    cursor.y -= 6;
    ensure(8);
    cursor.page.drawLine({
      start: { x: MARGIN_X, y: cursor.y },
      end: { x: PAGE_WIDTH - MARGIN_X, y: cursor.y },
      thickness: 0.4,
      color: rgb(0.8, 0.82, 0.86),
    });
    cursor.y -= 14;
    draw("Notes", { font: bold, size: 10, color: brand, gap: 2 });
    draw(input.notes.trim(), { font: regular, size: 10, color: ink, gap: 0 });
  }

  const pageCount = cursor.pages.length;
  cursor.pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${pageCount}`;
    const width = regular.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: PAGE_WIDTH - MARGIN_X - width,
      y: 22,
      size: 8,
      font: regular,
      color: muted,
    });
  });

  return doc.save({ useObjectStreams: false });
}

export function estimateIssuedAt(createdAt: string | null | undefined, now = new Date()): Date {
  if (createdAt) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function estimateInputFromFields(fields: {
  businessName: string;
  legalName: string;
  addressLines: string[];
  phone: string;
  email: string;
  website: string;
  brandPrimaryColor: string;
  quoteId: string | null;
  issuedAt: Date;
  expiresAt: string | null;
  clientName: string;
  projectName: string;
  propertyAddress: string;
  title: string;
  description: string;
  notes: string;
  lineItems: QuoteLineItem[];
  depositMode: DepositMode | null;
  depositPercent: number | null;
  depositAmountCents: number | null;
  depositFallback: DepositTerms;
  totalCents?: number;
}): EstimatePdfInput {
  const lineItems = fields.lineItems.map((item) => ({
    description: item.description || "",
    amount_cents: Number(item.amount_cents) || 0,
  }));
  const sum = estimateLineItems(lineItems).reduce((total, item) => total + item.amount_cents, 0);
  return {
    businessName: fields.businessName,
    legalName: fields.legalName,
    addressLines: fields.addressLines,
    phone: fields.phone,
    email: fields.email,
    website: fields.website,
    brandPrimaryColor: fields.brandPrimaryColor,
    quoteId: fields.quoteId,
    issuedAt: fields.issuedAt,
    expiresAt: fields.expiresAt,
    clientName: fields.clientName,
    projectName: fields.projectName,
    propertyAddress: fields.propertyAddress,
    title: fields.title,
    description: fields.description,
    notes: fields.notes,
    lineItems,
    totalCents: fields.totalCents ?? sum,
    deposit: {
      deposit_mode: fields.depositMode,
      deposit_percent: fields.depositPercent,
      deposit_amount_cents: fields.depositAmountCents,
    },
    depositFallback: fields.depositFallback,
  };
}
