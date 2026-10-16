import type { Block } from "../blocks";
import { BRAND, FOOTER_TEXT, type DocMeta } from "../brand";
import { renderPdf } from "../pdf";
import { LABELS, type ResourceBuild } from "../types";
import { calc, CURRENCY, CURRENCY_DASH, DATE, emphasis, input, Workbook, XS, type XStyle } from "../xlsx";

const BASE = "real-estate-photography-pricing-sheet-template";

export const ADD_ONS: Array<[string, string, string, string]> = [
  ["Drone aerial photos", "Per shoot", "Aerial views of the home, lot and surroundings, where flight is permitted", "Aerial views of the home, lot and surroundings"],
  ["Drone aerial video", "Per clip", "Edited aerial footage for listing videos and social posts", "Edited aerial footage for listing video and social"],
  ["Walkthrough video", "Per video", "Edited interior and exterior video tour", "Edited interior and exterior video tour"],
  ["Twilight photos", "Per shoot", "Exterior images at dusk with interior and landscape lights on", "Exterior images at dusk with the lights on"],
  ["Floor plan", "Per plan", "2D floor plan with room labels and approximate dimensions", "2D plan with room labels and approximate sizes"],
  ["360° virtual tour", "Per tour", "Interactive tour for listing sites that support it", "Interactive tour for sites that support it"],
  ["Virtual staging", "Per image", "Digitally furnished photos of empty rooms", "Digitally furnished photos of empty rooms"],
  ["Rush delivery", "Per order", "Faster turnaround than your standard delivery time", "Faster than your standard turnaround"],
  ["Additional photos", "Per image", "Extra edited images beyond the package count", "Extra edited images beyond the package"],
];

const PACKAGES: Array<[string, number, number, string]> = [
  ["Essentials", 0, 2000, "Interior and exterior photos, online gallery"],
  ["Signature", 2001, 3500, "Everything in Essentials plus drone aerial photos"],
  ["Estate", 3501, 5000, "Everything in Signature plus floor plan and walkthrough video"],
];

function priceSheet(book: Workbook): void {
  const s = book.sheet("Price sheet");
  s.width("A", 2.5).width("B", 30).width("C", 14).width("D", 14).width("E", 14).width("F", 44).width("G", 15).width("H", 2.5);
  s.height(1, 12);

  s.merge("B2:G2", "Real estate photography price sheet", XS.title).height(2, 30);
  s.merge(
    "B3:G3",
    "Shaded cells are editable. Price cells are blank on purpose — fill in your own numbers. Package names, inclusions and square-footage bands are examples to replace.",
    XS.subtitle,
  ).height(3, 30);

  s.set("B5", "Business name", XS.label);
  s.merge("C5:D5", null, input());
  s.set("E5", "Effective date", XS.label);
  s.set("F5", null, input({ numFmt: DATE, h: "left" }));
  s.height(5, 22);

  // Packages
  const section = (row: number, title: string, hint: string) => {
    s.merge(`B${row}:G${row}`, title, XS.section).height(row, 26);
    s.merge(`B${row + 1}:G${row + 1}`, hint, XS.hint).height(row + 1, 28);
  };
  section(7, "Packages by home size", "One package per square-footage band. Set the bands, photo counts and prices to match how you work — the quick quote below picks the package from the home size.");
  const head = ["Package", "From (sq ft)", "To (sq ft)", "Edited photos", "What’s included", "Price"];
  head.forEach((h, i) => s.set(`${"BCDEFG"[i]}9`, h, i === 5 ? XS.headRight : i >= 1 && i <= 3 ? XS.headRight : XS.head));
  s.height(9, 22);
  PACKAGES.forEach(([name, from, to, inc], i) => {
    const r = 10 + i;
    s.set(`B${r}`, name, input({ font: { bold: true, size: 10, color: BRAND.slate } }));
    s.set(`C${r}`, from, input({ numFmt: "#,##0", h: "right" }));
    s.set(`D${r}`, to, input({ numFmt: "#,##0", h: "right" }));
    s.set(`E${r}`, null, input({ numFmt: "0", h: "right" }));
    s.set(`F${r}`, inc, input({ wrap: true }));
    s.set(`G${r}`, null, input({ numFmt: CURRENCY, h: "right" }));
    s.height(r, 30);
  });
  s.merge("B13:G13", "Example bands — replace with your own. Keep the “From” values in ascending order. For homes larger than your top band, consider quoting individually.", XS.hint).height(13, 26);

  // Add-ons
  section(15, "Add-on menu", "Add-ons can be combined with any package. Enter a quantity in the Qty column to include an add-on in the quick quote.");
  const addHead: Array<[string, XStyle]> = [
    ["Add-on", XS.head],
    ["Unit", XS.head],
    ["Price", XS.headRight],
    ["Qty (quote)", XS.headRight],
    ["Details", XS.head],
    ["Line total", XS.headRight],
  ];
  addHead.forEach(([h, st], i) => s.set(`${"BCDEFG"[i]}17`, h, st));
  s.height(17, 22);
  ADD_ONS.forEach(([name, unit, details], i) => {
    const r = 18 + i;
    s.set(`B${r}`, name, input({ font: { bold: true, size: 10, color: BRAND.slate } }));
    s.set(`C${r}`, unit, input());
    s.set(`D${r}`, null, input({ numFmt: CURRENCY, h: "right" }));
    s.set(`E${r}`, null, input({ numFmt: "0", h: "right" }));
    s.set(`F${r}`, details, input({ wrap: true, font: { size: 9, color: BRAND.body } }));
    s.formula(`G${r}`, `IF(OR(D${r}="",E${r}=""),0,D${r}*E${r})`, calc({ numFmt: CURRENCY_DASH }), 0);
    s.height(r, 30);
  });
  s.set("F27", "Add-ons in this quote", { ...XS.labelBold, h: "right" });
  s.formula("G27", "SUM(G18:G26)", calc({ numFmt: CURRENCY_DASH, font: { bold: true, size: 10, color: BRAND.slate } }), 0);
  s.height(27, 22);

  // Travel
  section(29, "Travel fees", "How you charge for distance. Publish these rules so clients can predict the fee; the quick quote uses them.");
  const travel: Array<[string, XStyle, string, string?]> = [
    ["Base location (city or ZIP)", input(), "Where distance is measured from"],
    ["Free travel radius (miles)", input({ numFmt: "#,##0", h: "right" }), "No travel fee inside this distance"],
    ["Fee per mile beyond the radius", input({ numFmt: CURRENCY, h: "right" }), "Charged only on the miles beyond the free radius"],
    ["Minimum travel fee", input({ numFmt: CURRENCY, h: "right" }), "Optional floor once a job is outside the radius"],
    ["Distance is measured", input(), "Choose one way or round trip, and say which on your price list", "One way,Round trip"],
    ["Tolls, parking and ferries", input(), "Choose whether these are included or billed at cost", "Included,Billed at cost"],
  ];
  travel.forEach(([label, st, note, list], i) => {
    const r = 31 + i;
    s.set(`B${r}`, label, XS.label);
    s.merge(`C${r}:D${r}`, null, st);
    s.merge(`E${r}:G${r}`, note, XS.note);
    if (list) s.listValidation(`C${r}`, `"${list}"`);
    s.height(r, 22);
  });

  // Quick quote
  section(38, "Quick quote", "Enter the home size, add-on quantities (above) and the trip distance to price a job.");
  const q: Array<[number, string, string | null, XStyle, string, (string | number)?]> = [
    [40, "Home size (sq ft)", null, input({ numFmt: "#,##0", h: "right" }), "From the listing or the agent"],
    [41, "Package", 'IF(C40="","",IFERROR(LOOKUP(C40,$C$10:$C$12,$B$10:$B$12),"Below your smallest band"))', calc(), "Picked from the bands in the package table", ""],
    [42, "Package price", "IF(C40=\"\",0,IFERROR(LOOKUP(C40,$C$10:$C$12,$G$10:$G$12),0))", calc({ numFmt: CURRENCY_DASH }), "Price of the matching package", 0],
    [43, "Add-ons", "G27", calc({ numFmt: CURRENCY_DASH }), "Sum of the add-on line totals", 0],
    [44, "Trip distance (miles)", null, input({ numFmt: "#,##0", h: "right" }), "Measured the way you chose in travel fees"],
    [45, "Travel fee", 'IF(OR(C44="",C32=""),0,IF(C44>C32,MAX(C34,(C44-C32)*C33),0))', calc({ numFmt: CURRENCY_DASH }), "Uses the travel rules above", 0],
    [46, "Quote total", "C42+C43+C45", emphasis({ numFmt: CURRENCY }), "Before any tax or discounts", 0],
  ];
  for (const [r, label, f, st, note, cached] of q) {
    s.set(`B${r}`, label, r === 46 ? { ...XS.labelBold, fill: BRAND.bgIndigo, border: { top: { color: BRAND.indigo }, bottom: { color: BRAND.indigo } } } : XS.label);
    if (f) s.mergeFormula(`C${r}:D${r}`, f, st, cached);
    else s.merge(`C${r}:D${r}`, null, st);
    s.merge(`E${r}:G${r}`, note, XS.note);
    s.height(r, 22);
  }
  s.height(46, 26);

  s.set("B48", FOOTER_TEXT, XS.footer);
  s.printArea = "$A$1:$H$48";
}

function costCalculator(book: Workbook): void {
  const s = book.sheet("Cost calculator");
  s.width("A", 2.5).width("B", 40).width("C", 16).width("D", 56).width("E", 2.5);
  s.height(1, 12);
  s.merge("B2:D2", "Cost and price calculator", XS.title).height(2, 30);
  s.merge(
    "B3:D3",
    "Work out what one job really costs, then set a price that reaches your target profit margin. Shaded cells are inputs. The numbers shown are examples only — replace them with your own.",
    XS.subtitle,
  ).height(3, 30);

  const section = (row: number, title: string, headers: [string, string, string]) => {
    s.merge(`B${row}:D${row}`, title, XS.section).height(row, 26);
    s.set(`B${row + 1}`, headers[0], XS.head);
    s.set(`C${row + 1}`, headers[1], XS.headRight);
    s.set(`D${row + 1}`, headers[2], XS.head);
    s.height(row + 1, 22);
  };
  const row = (r: number, label: string, value: number | null, st: XStyle, note: string) => {
    s.set(`B${r}`, label, XS.label);
    s.set(`C${r}`, value, st);
    s.set(`D${r}`, note, XS.note);
    s.height(r, 22);
  };
  const frow = (r: number, label: string, f: string, st: XStyle, note: string, cached: number | string, bold = false) => {
    s.set(`B${r}`, label, bold ? XS.labelBold : XS.label);
    s.formula(`C${r}`, f, st, cached);
    s.set(`D${r}`, note, XS.note);
    s.height(r, 22);
  };
  const hours = input({ numFmt: "0.00", h: "right" });
  const money = input({ numFmt: CURRENCY, h: "right" });
  const count = input({ numFmt: "#,##0", h: "right" });

  section(5, "Time per job", ["Item", "Hours", "Notes"]);
  row(7, "Hours on site", 1.5, hours, "Setup, walkthrough and shooting (example)");
  row(8, "Editing hours", 2, hours, "Culling, editing and exporting (example)");
  row(9, "Travel time, round trip", 1, hours, "Driving to and from the property (example)");
  row(10, "Admin and communication", 0.5, hours, "Scheduling, emails, invoicing and delivery (example)");
  frow(11, "Total hours", "SUM(C7:C10)", calc({ numFmt: "0.00", font: { bold: true, size: 10, color: BRAND.slate } }), "", 5, true);

  section(13, "Rates and overhead", ["Item", "Value", "Notes"]);
  row(15, "Your hourly rate", 50, money, "What your time is worth before profit (example — set your own)");
  row(16, "Travel distance, round trip (miles)", 30, count, "Example distance for this job");
  row(17, "Vehicle cost per mile", 0.5, money, "Your own estimate for fuel, maintenance and wear (example)");
  row(18, "Direct costs for this job", 25, money, "Outsourced editing, floor plan or tour fees, parking (example)");
  row(19, "Monthly overhead", 600, money, "Insurance, software, phone, equipment replacement, marketing (example)");
  row(20, "Jobs per month", 20, count, "Average number of jobs you complete in a month (example)");
  frow(21, "Overhead per job", "IFERROR(C19/C20,0)", calc({ numFmt: CURRENCY }), "Monthly overhead ÷ jobs per month", 30);

  section(23, "Cost per job", ["Item", "Amount", "How it’s calculated"]);
  frow(25, "Labor", "C11*C15", calc({ numFmt: CURRENCY }), "Total hours × hourly rate", 250);
  frow(26, "Travel", "C16*C17", calc({ numFmt: CURRENCY }), "Miles × vehicle cost per mile", 15);
  frow(27, "Direct costs", "C18", calc({ numFmt: CURRENCY }), "From rates and overhead", 25);
  frow(28, "Overhead share", "C21", calc({ numFmt: CURRENCY }), "From rates and overhead", 30);
  s.set("B29", "Total cost per job", { ...XS.labelBold, fill: BRAND.bgIndigo, border: { top: { color: BRAND.indigo }, bottom: { color: BRAND.indigo } } });
  s.formula("C29", "SUM(C25:C28)", emphasis({ numFmt: CURRENCY }), 320);
  s.set("D29", "What the job costs you before any profit", { ...XS.note, fill: BRAND.bgIndigo, border: { top: { color: BRAND.indigo }, bottom: { color: BRAND.indigo } } });
  s.height(29, 26);

  section(31, "Suggested price", ["Item", "Value", "Notes"]);
  row(33, "Target profit margin", 0.3, input({ numFmt: "0%", h: "right" }), "Share of the price you keep as profit. Must be below 100% (example: 30%)");
  s.decimalValidation("C33", 0, 0.95, "Enter a margin between 0% and 95%.");
  s.set("B34", "Suggested price", { ...XS.labelBold, fill: BRAND.bgIndigo, border: { top: { color: BRAND.indigo }, bottom: { color: BRAND.indigo } } });
  s.formula("C34", 'IF(C33>=1,"",C29/(1-C33))', emphasis({ numFmt: CURRENCY }), 320 / 0.7);
  s.set("D34", "Total cost ÷ (1 − margin)", { ...XS.note, fill: BRAND.bgIndigo, border: { top: { color: BRAND.indigo }, bottom: { color: BRAND.indigo } } });
  s.height(34, 26);
  frow(35, "Profit per job", 'IF(C34="",0,C34-C29)', calc({ numFmt: CURRENCY }), "Suggested price − total cost", 320 / 0.7 - 320);
  frow(36, "Markup on cost (same profit)", "IFERROR((C34-C29)/C29,0)", calc({ numFmt: "0.0%" }), "Profit ÷ total cost — see the note below", (320 / 0.7 - 320) / 320);
  frow(37, "Effective hourly rate", "IFERROR(C34/C11,0)", calc({ numFmt: CURRENCY }), "Suggested price ÷ total hours", 320 / 0.7 / 5);
  row(38, "Your current price (optional)", null, money, "Enter what you charge today to compare");
  frow(39, "Margin at your current price", 'IF(OR(C38="",C38=0),"",(C38-C29)/C38)', calc({ numFmt: "0.0%" }), "Below your target? Revisit the price or the costs above", "");

  s.merge("B41:D41", "Margin vs. markup", XS.section).height(41, 26);
  s.merge(
    "B42:D42",
    "Margin is profit as a share of the price: (price − cost) ÷ price. Markup is profit as a share of the cost: (price − cost) ÷ cost. They describe the same profit differently — a job that costs $100 and sells for $150 has a 50% markup but a 33.3% margin. Adding 30% to your costs gives a 30% markup, not a 30% margin. This calculator uses margin: price = cost ÷ (1 − margin).",
    { font: { size: 10, color: BRAND.body }, wrap: true, v: "top", fill: BRAND.bgLight, indent: 1 },
  ).height(42, 70);
  s.set("B44", "Target margin", XS.head);
  s.set("C44", "Markup needed", XS.headRight);
  s.set("D44", "Price for every $100 of cost", XS.head);
  s.height(44, 22);
  [0.2, 0.3, 0.4, 0.5, 0.6].forEach((m, i) => {
    const r = 45 + i;
    s.set(`B${r}`, m, input({ numFmt: "0%", h: "left" }));
    s.formula(`C${r}`, `IFERROR(B${r}/(1-B${r}),"")`, calc({ numFmt: "0.0%" }), m / (1 - m));
    s.formula(`D${r}`, `IFERROR(100/(1-B${r}),"")`, calc({ numFmt: CURRENCY, h: "left" }), 100 / (1 - m));
    s.height(r, 22);
  });

  s.set("B51", FOOTER_TEXT, XS.footer);
  s.printArea = "$A$1:$E$51";
}

const menuBlocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Real estate photography",
    title: "Photography packages",
    subtitle: "Priced by home size. Add-ons combine with any package.",
    logoBox: true,
    meta: [{ label: "Business name" }, { label: "Phone" }, { label: "Email" }, { label: "Website" }],
  },
  {
    kind: "cards",
    cards: [
      {
        title: "Essentials",
        subtitle: "Homes up to ________ sq ft",
        items: ["________ edited photos", "Interior and exterior", "Online gallery delivery", "Delivered in ____ days"],
      },
      {
        title: "Signature",
        subtitle: "Homes ________ to ________ sq ft",
        items: ["________ edited photos", "Everything in Essentials", "Drone aerial photos", "Delivered in ____ days"],
      },
      {
        title: "Estate",
        subtitle: "Homes ________ sq ft and up",
        items: ["________ edited photos", "Everything in Signature", "Floor plan and video tour", "Delivered in ____ days"],
      },
    ],
  },
  { kind: "paragraph", text: "Example layout — replace package names, inclusions and prices with your own.", muted: true },
  { kind: "section", title: "Add-ons" },
  {
    kind: "table",
    columns: [
      { header: "Add-on", width: 24 },
      { header: "Details", width: 49 },
      { header: "Unit", width: 13 },
      { header: "Price", width: 14 },
    ],
    rows: ADD_ONS.slice(0, 8).map(([name, unit, , short]) => [name, short, unit.toLowerCase(), "$"]),
    rowHeight: 19,
  },
  { kind: "section", title: "Travel, booking and usage" },
  {
    kind: "fields",
    columns: 3,
    items: [
      { label: "Travel included within (miles of)" },
      { label: "Beyond that, per mile" },
      { label: "Tolls and parking" },
      { label: "Deposit and payment" },
      { label: "Reschedule and cancellation" },
      { label: "Usage and licensing" },
    ],
  },
];

export async function buildPricingSheet(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Real estate photography pricing sheet template",
    subject: "Package tiers by square footage, add-on menu, travel fees and a cost-based price calculator",
    description: "Editable price sheet for real estate photographers. Example values are placeholders.",
    keywords: ["real estate photography", "pricing", "price sheet", "template"],
    runningTitle: "Real estate photography pricing",
  };
  const book = new Workbook();
  priceSheet(book);
  costCalculator(book);
  const xlsx = await book.build(meta);
  const pdf = await renderPdf({ ...meta, title: "Real estate photography price menu" }, menuBlocks);
  return {
    id: "real-estate-photography-pricing-sheet",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "xlsx", filename: `${BASE}.xlsx`, bytes: xlsx, label: LABELS.xlsx },
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: "Printable client price menu (PDF)" },
    ],
  };
}
