import type { Block } from "../blocks";
import type { DocMeta } from "../brand";
import { renderDocx } from "../docx";
import { renderPdf } from "../pdf";
import { DISCLAIMER, LABELS, type ResourceBuild } from "../types";

const BASE = "drone-photography-quote-template";

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Drone photography & video",
    title: "Quote",
    subtitle: "Aerial photo and video services for the project described below. Prices are valid until the date shown.",
    logoBox: true,
    meta: [{ label: "Quote no." }, { label: "Date issued" }, { label: "Valid until" }, { label: "Prepared by" }],
  },
  {
    kind: "parties",
    parties: [
      { title: "From", fields: ["Business name", "Address", "Phone and email", "Remote pilot certificate no. (if applicable)"] },
      { title: "Prepared for", fields: ["Client name and company", "Billing address", "Phone and email", "Purchase order or reference (optional)"] },
    ],
  },
  { kind: "section", number: 1, title: "Project details" },
  {
    kind: "fields",
    columns: 2,
    items: [
      { label: "Project name" },
      { label: "Service type (photo, video, mapping, inspection…)" },
      { label: "Site address or coordinates", span: 2 },
      { label: "Preferred date(s)" },
      { label: "Flight window / time of day" },
      { label: "On-site contact and phone" },
      { label: "Access, parking and launch area notes" },
    ],
  },
  {
    kind: "prompt",
    label: "Location and airspace notes",
    guidance:
      "Note the airspace around the site, nearby airports or heliports, and whether an authorization (for example, LAANC in the US) or landowner permission is needed. Requirements vary — check your local rules before confirming the date.",
    lines: 3,
  },
  {
    kind: "section",
    number: 2,
    title: "Services and pricing",
    intro: "List each deliverable as its own line — for example, aerial photo set, edited video, extra locations, travel, or time spent on authorizations.",
  },
  {
    kind: "table",
    columns: [
      { header: "Description", width: 52 },
      { header: "Qty", width: 12, align: "right" },
      { header: "Rate", width: 18, align: "right" },
      { header: "Amount", width: 18, align: "right" },
    ],
    blankRows: 6,
    totals: [
      { label: "Subtotal" },
      { label: "Discount" },
      { label: "Tax (____ %)" },
      { label: "Total", emphasis: true },
      { label: "Deposit to book" },
      { label: "Balance due on delivery" },
    ],
  },
  { kind: "section", number: 3, title: "Deliverables and timeline" },
  {
    kind: "prompt",
    label: "Deliverables",
    guidance: "Number of edited photos, video length and format, resolution, aspect ratios, and how files are delivered.",
    lines: 3,
  },
  {
    kind: "prompt",
    label: "Timeline",
    guidance: "When edited files will be delivered after the flight, how proofs are shared, and how many revision rounds are included.",
    lines: 2,
  },
  { kind: "section", number: 4, title: "Weather, safety and rescheduling" },
  {
    kind: "prompt",
    guidance:
      "Explain how you handle wind, rain, low visibility and other no-fly conditions: who makes the call, how much notice you give, how a new date is chosen, and whether weather reschedules are free. Note that flights can be stopped on site for safety reasons.",
    lines: 4,
  },
  { kind: "section", number: 5, title: "Terms" },
  {
    kind: "prompt",
    label: "Deposit and payment terms",
    guidance: "Deposit amount, when the balance is due, and accepted payment methods.",
    lines: 2,
  },
  {
    kind: "prompt",
    label: "Cancellation and reschedule policy",
    guidance: "What happens if the client cancels or moves the date, and how much notice is needed.",
    lines: 2,
  },
  {
    kind: "prompt",
    label: "Usage and licensing",
    guidance: "Where and how long the client may use the images and footage, and whether third parties (agents, builders, partners) are included.",
    lines: 2,
  },
  {
    kind: "prompt",
    label: "Insurance and responsibilities",
    guidance: "What insurance you carry and what the client is responsible for (site access, permissions, informing occupants or neighbors).",
    lines: 2,
  },
  { kind: "note", title: "Please note", text: DISCLAIMER, tone: "muted" },
  { kind: "section", number: 6, title: "Acceptance" },
  {
    kind: "paragraph",
    text: "To accept this quote, sign below and return it by the “valid until” date. The project is scheduled once the signed quote and any deposit are received.",
  },
  { kind: "signature", items: ["Client signature", "Printed name", "Date"] },
];

export async function buildDroneQuote(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Drone photography quote template",
    subject: "Quote for aerial photo and video services with line items, totals, deposit, weather policy and acceptance",
    description: "Editable drone photography quote. Not legal, tax or financial advice.",
    keywords: ["drone photography", "quote", "estimate", "aerial video", "template"],
    runningTitle: "Drone photography quote",
  };
  const docx = await renderDocx(meta, blocks);
  const pdf = await renderPdf(meta, blocks);
  return {
    id: "drone-photography-quote",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "docx", filename: `${BASE}.docx`, bytes: docx, label: LABELS.docx },
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
    ],
  };
}
