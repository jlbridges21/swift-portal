import type { Block } from "../blocks";
import { BRAND, FOOTER_TEXT, type DocMeta } from "../brand";
import { renderPdf } from "../pdf";
import { DISCLAIMER, LABELS, type ResourceBuild } from "../types";
import { calc, CURRENCY, CURRENCY_DASH, DATE, emphasis, input, Workbook, XS, type XStyle } from "../xlsx";

const BASE = "photography-invoice-template";

function invoiceSheet(book: Workbook): void {
  const s = book.sheet("Invoice");
  s.width("A", 2.5).width("B", 40).width("C", 13).width("D", 9).width("E", 22).width("F", 16).width("G", 2.5);
  s.height(1, 14);

  const placeholder = (extra: Partial<XStyle> = {}) => input({ font: { size: 10, color: BRAND.muted }, ...extra });
  const metaLabel: XStyle = { font: { size: 9, color: BRAND.muted }, h: "right", indent: 1 };

  // Business block (left) and invoice title + meta (right)
  s.merge("B2:C2", "Your business name", input({ font: { bold: true, size: 14, color: BRAND.slate } })).height(2, 28);
  s.merge("B3:C3", "Street address, city, state, ZIP", placeholder());
  s.merge("B4:C4", "Phone · email", placeholder());
  s.merge("B5:C5", "Website", placeholder());
  s.merge("D2:F2", "Invoice", { font: { bold: true, size: 24, color: BRAND.indigo }, h: "right" });

  s.set("E3", "Invoice no.", metaLabel);
  s.set("F3", null, input({ h: "right" }));
  s.set("E4", "Issue date", metaLabel);
  s.set("F4", null, input({ numFmt: DATE, h: "right" }));
  s.set("E5", "Payment terms (days)", metaLabel);
  s.set("F5", null, input({ numFmt: "0", h: "right" }));
  s.set("E6", "Due date", { ...metaLabel, font: { bold: true, size: 9, color: BRAND.slate } });
  s.formula("F6", 'IF(OR(F4="",F5=""),"",F4+F5)', calc({ numFmt: DATE, font: { bold: true, size: 10, color: BRAND.slate } }), "");
  for (const r of [3, 4, 5, 6]) s.height(r, 21);

  // Bill to / project
  s.set("B8", "Bill to", XS.eyebrow);
  s.merge("D8:F8", "Project / property", XS.eyebrow);
  s.height(8, 22);
  s.merge("B9:C9", "Client name", placeholder());
  s.merge("B10:C10", "Company or brokerage", placeholder());
  s.merge("B11:C11", "Billing address · email", placeholder());
  s.merge("D9:F9", "Property address or project name", placeholder());
  s.merge("D10:F10", "Service date(s)", placeholder());
  s.merge("D11:F11", "PO or reference (optional)", placeholder());
  for (const r of [9, 10, 11]) s.height(r, 21);

  // Line items
  const heads: Array<[string, XStyle]> = [
    ["Description", XS.head],
    ["Date", XS.head],
    ["Qty", XS.headRight],
    ["Rate", XS.headRight],
    ["Amount", XS.headRight],
  ];
  heads.forEach(([h, st], i) => s.set(`${"BCDEF"[i]}13`, h, st));
  s.height(13, 24);
  for (let r = 14; r <= 23; r++) {
    s.set(`B${r}`, null, input({ wrap: true }));
    s.set(`C${r}`, null, input({ numFmt: "mmm d", h: "left" }));
    s.set(`D${r}`, null, input({ numFmt: "#,##0.##", h: "right" }));
    s.set(`E${r}`, null, input({ numFmt: CURRENCY, h: "right" }));
    s.formula(`F${r}`, `IF(OR(D${r}="",E${r}=""),"",D${r}*E${r})`, calc({ numFmt: CURRENCY }), "");
    s.height(r, 22);
  }

  // Totals
  const label: XStyle = { font: { size: 10, color: BRAND.body }, h: "right", indent: 1, border: { bottom: { color: BRAND.line } } };
  s.set("E25", "Subtotal", label);
  s.formula("F25", "SUM(F14:F23)", calc({ numFmt: CURRENCY }), 0);
  s.set("E26", "Discount", label);
  s.set("F26", null, input({ numFmt: CURRENCY, h: "right" }));
  s.set("E27", "Tax rate", label);
  s.set("F27", null, input({ numFmt: "0.00%", h: "right" }));
  s.set("E28", "Tax", label);
  s.formula("F28", "ROUND((F25-F26)*F27,2)", calc({ numFmt: CURRENCY_DASH }), 0);
  s.set("E29", "Total", { ...label, font: { bold: true, size: 10, color: BRAND.slate } });
  s.formula("F29", "F25-F26+F28", calc({ numFmt: CURRENCY, font: { bold: true, size: 10, color: BRAND.slate } }), 0);
  s.set("E30", "Amount paid / deposit", label);
  s.set("F30", null, input({ numFmt: CURRENCY, h: "right" }));
  s.set("E31", "Balance due", { ...emphasis(), h: "right" });
  s.formula("F31", "F29-F30", emphasis({ numFmt: CURRENCY }), 0);
  for (let r = 25; r <= 30; r++) s.height(r, 21);
  s.height(31, 26);
  s.decimalValidation("F27", 0, 1, "Enter the tax rate as a percentage, e.g. 7.5%.");

  // Payment instructions (left of totals)
  s.set("B25", "Payment instructions", XS.eyebrow);
  s.merge(
    "B26:C31",
    "Accepted methods: …\nPay to / account name: …\nPayment link or details: …\nPlease include the invoice number as your reference.",
    placeholder({ wrap: true, v: "top" }),
  );

  s.set("B33", "Notes", XS.eyebrow);
  s.height(33, 20);
  s.merge("B34:F35", "Add a note for your client — what’s included, delivery details, usage terms or a thank-you.", placeholder({ wrap: true, v: "top" }));
  s.height(34, 22).height(35, 22);

  s.merge("B37:F37", DISCLAIMER, { ...XS.hint, font: { size: 8, color: BRAND.faint } }).height(37, 24);
  s.set("B39", FOOTER_TEXT, XS.footer);
  s.printArea = "$A$1:$G$39";
}

function guideSheet(book: Workbook): void {
  const s = book.sheet("How to use");
  s.tabColor = BRAND.lineStrong;
  s.width("A", 2.5).width("B", 4).width("C", 90);
  s.merge("B2:C2", "How to use this invoice", XS.title).height(2, 30);
  const steps = [
    "Replace the gray placeholder text and fill the shaded cells. Everything else calculates on its own.",
    "Enter the issue date and payment terms in days — the due date fills in automatically.",
    "Add one line per service or expense. Amount = Qty × Rate. Leave unused rows blank.",
    "Enter any discount as a dollar amount and the tax rate as a percentage (leave blank if you don’t charge tax).",
    "Record any deposit already received in “Amount paid / deposit” so the balance due is correct.",
    "Give every invoice a unique number (for example, INV-0001) and keep a copy for your records.",
    "To send: File → Save as PDF / Download as PDF. The page is already set to fit one sheet of US Letter.",
  ];
  steps.forEach((t, i) => {
    const r = 4 + i;
    s.set(`B${r}`, i + 1, { font: { bold: true, size: 10, color: BRAND.indigo }, h: "center", v: "top" });
    s.set(`C${r}`, t, { font: { size: 10, color: BRAND.text }, wrap: true, v: "top" });
    s.height(r, 30);
  });
  s.set("B12", FOOTER_TEXT, XS.footer);
}

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Photography services",
    title: "Invoice",
    logoBox: true,
    meta: [{ label: "Invoice no." }, { label: "Issue date" }, { label: "Due date" }, { label: "Project / property" }],
  },
  {
    kind: "parties",
    parties: [
      { title: "From", fields: ["Business name", "Address", "Phone and email"] },
      { title: "Bill to", fields: ["Client name and company", "Billing address", "Email"] },
    ],
  },
  {
    kind: "table",
    columns: [
      { header: "Description", width: 46 },
      { header: "Date", width: 14 },
      { header: "Qty", width: 10, align: "right" },
      { header: "Rate", width: 15, align: "right" },
      { header: "Amount", width: 15, align: "right" },
    ],
    blankRows: 7,
    rowHeight: 23,
    totals: [
      { label: "Subtotal" },
      { label: "Discount" },
      { label: "Tax (____ %)" },
      { label: "Total", strong: true },
      { label: "Amount paid / deposit" },
      { label: "Balance due", emphasis: true },
    ],
    aside: {
      title: "Payment instructions",
      fields: ["Accepted payment methods", "Pay to / account name", "Payment link or details", "Reference to include (e.g., invoice no.)"],
    },
  },
  { kind: "spacer", size: 6 },
  { kind: "paragraph", text: DISCLAIMER, muted: true },
];

export async function buildInvoice(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Photography invoice template",
    subject: "Invoice with line items, discount, tax rate, deposit and balance due",
    description: "Editable photography invoice with working formulas. Not legal, tax or financial advice.",
    keywords: ["photography invoice", "invoice template", "real estate photography", "videography"],
    runningTitle: "Photography invoice",
  };
  const book = new Workbook();
  invoiceSheet(book);
  guideSheet(book);
  const xlsx = await book.build(meta);
  const pdf = await renderPdf(meta, blocks);
  return {
    id: "photography-invoice",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "xlsx", filename: `${BASE}.xlsx`, bytes: xlsx, label: LABELS.xlsx },
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
    ],
  };
}
