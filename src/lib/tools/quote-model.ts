import { cents, clampNumber, quoteTotals, type QuoteLine, type QuoteTotalsInput } from "@/lib/tools/pricing-math";
import { EMPTY_BRAND, sanitizeBrand, type Brand } from "@/lib/tools/brand";

/**
 * Quote and invoice document model for the free builders. Lives only in the visitor's browser
 * (localStorage draft). The business details come from the shared brand profile.
 */

export type DocKind = "quote" | "invoice";

export type Quote = QuoteTotalsInput & {
  kind: DocKind;
  business: Brand;
  client: { name: string; company: string; email: string };
  project: { title: string; location: string; date: string };
  number: string;
  issued: string; // yyyy-mm-dd
  /** Quote: days the price holds. */
  validDays: number;
  /** Invoice: days until payment is due. */
  dueDays: number;
  /** Invoice: amount already received (e.g. a deposit). */
  amountPaid: number;
  /** Invoice: how to pay. */
  paymentInfo: string;
  notes: string;
  terms: string;
};

/** Random line id (no module-level counter: module state is shared across requests on the server). */
export function lineId(): string {
  return `l${Math.random().toString(36).slice(2, 10)}`;
}

export function line(description: string, detail = "", quantity = 1, unitPrice = 0, optional = false): QuoteLine {
  return { id: lineId(), description, detail, quantity, unitPrice, optional };
}

export type QuoteTemplateKey = "real-estate" | "drone" | "video" | "blank";

/** Line items only. Prices start at $0: every business sets its own. */
export const QUOTE_TEMPLATES: Record<QuoteTemplateKey, { label: string; title: string; lines: () => QuoteLine[]; notes: string }> = {
  "real-estate": {
    label: "Real estate listing",
    title: "Listing media package",
    lines: () => [
      line("Interior and exterior photos", "Edited, MLS-ready and full-resolution files"),
      line("Drone photos", "Aerial stills of the property and surroundings"),
      line("Walkthrough video", "Horizontal edit with licensed music", 1, 0, true),
      line("Twilight exterior", "Dusk exterior photos", 1, 0, true),
      line("Travel", "Round trip to the property"),
    ],
    notes: "Photos are delivered through an online gallery with full-resolution and MLS-sized downloads.",
  },
  drone: {
    label: "Drone aerials",
    title: "Aerial photo and video",
    lines: () => [
      line("Flight planning and airspace check", "Site review and any required authorizations"),
      line("Aerial photography", "Edited high-resolution stills"),
      line("Aerial video", "Edited highlight video"),
      line("Raw footage delivery", "Unedited clips", 1, 0, true),
      line("Travel", "Round trip to the site"),
    ],
    notes: "Flights depend on weather and airspace conditions. If conditions aren’t safe, we’ll reschedule at no extra charge.",
  },
  video: {
    label: "Video production",
    title: "Video production",
    lines: () => [
      line("Pre-production", "Concept, shot list, and scheduling"),
      line("Filming", "On-site crew and equipment", 1),
      line("Editing", "One edit with up to two revision rounds"),
      line("Short social edits", "Vertical cutdowns", 3, 0, true),
      line("Licensed music", "Track licensed for this project"),
    ],
    notes: "Revision rounds beyond those listed are billed at the hourly editing rate.",
  },
  blank: { label: "Blank", title: "", lines: () => [line("")], notes: "" },
};

export const DEFAULT_INVOICE_TERMS = "Payment is due by the date shown above. Thank you for your business.";

export const DEFAULT_TERMS =
  "Deposit: the deposit listed above confirms your booking date.\nBalance: due on delivery.\nRescheduling: let us know at least 24 hours ahead.\nUsage: images are licensed for marketing this project.";

/** Invoices bill for agreed work, so template add-ons (optional lines) are left out. */
export function templateLines(template: QuoteTemplateKey, kind: DocKind): QuoteLine[] {
  const lines = QUOTE_TEMPLATES[template].lines();
  return kind === "invoice" ? lines.filter((l) => !l.optional) : lines;
}

export function blankQuote(template: QuoteTemplateKey = "real-estate", kind: DocKind = "quote"): Quote {
  const t = QUOTE_TEMPLATES[template];
  return {
    kind,
    business: { ...EMPTY_BRAND },
    client: { name: "", company: "", email: "" },
    project: { title: t.title, location: "", date: "" },
    number: "",
    issued: "",
    validDays: 14,
    dueDays: 14,
    amountPaid: 0,
    paymentInfo: "",
    notes: kind === "invoice" ? "" : t.notes,
    terms: kind === "invoice" ? DEFAULT_INVOICE_TERMS : DEFAULT_TERMS,
    lines: templateLines(template, kind),
    discountType: "none",
    discountValue: 0,
    taxPct: 0,
    depositType: kind === "invoice" ? "none" : "percent",
    depositValue: 50,
  };
}

/** Invoice money: total, amount already paid, and what's still due. */
export function invoiceAmounts(q: Quote) {
  const t = quoteTotals(q);
  const paid = cents(Math.min(Math.max(0, q.amountPaid), t.total));
  return { ...t, paid, due: cents(t.total - paid) };
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizeQuote(q: Quote): Quote {
  return {
    kind: q.kind === "invoice" ? "invoice" : "quote",
    business: sanitizeBrand({ ...EMPTY_BRAND, ...q.business }),
    client: { name: s(q.client?.name, 80), company: s(q.client?.company, 100), email: s(q.client?.email, 120) },
    project: { title: s(q.project?.title, 120), location: s(q.project?.location, 160), date: s(q.project?.date, 10) },
    number: s(q.number, 40),
    issued: s(q.issued, 10),
    validDays: Math.round(clampNumber(q.validDays, 0, 365, 14)),
    dueDays: Math.round(clampNumber(q.dueDays, 0, 365, 14)),
    amountPaid: clampNumber(q.amountPaid, 0, 10_000_000),
    paymentInfo: s(q.paymentInfo, 600),
    notes: s(q.notes, 1200),
    terms: s(q.terms, 2000),
    lines: (Array.isArray(q.lines) ? q.lines : []).slice(0, 40).map((l) => ({
      id: s(l.id, 40) || lineId(),
      description: s(l.description, 120),
      detail: s(l.detail, 200),
      quantity: clampNumber(l.quantity, 0, 100000, 1),
      unitPrice: clampNumber(l.unitPrice, 0, 10_000_000),
      optional: Boolean(l.optional),
    })),
    discountType: q.discountType === "percent" || q.discountType === "amount" ? q.discountType : "none",
    discountValue: clampNumber(q.discountValue, 0, 10_000_000),
    taxPct: clampNumber(q.taxPct, 0, 100),
    depositType: q.depositType === "amount" || q.depositType === "none" ? q.depositType : "percent",
    depositValue: clampNumber(q.depositValue, 0, 10_000_000),
  };
}

/** Today's date in the visitor's time zone, as yyyy-mm-dd. Call on the client only. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
}
