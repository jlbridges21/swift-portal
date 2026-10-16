import type { Block } from "../blocks";
import type { DocMeta } from "../brand";
import { renderDocx } from "../docx";
import { renderPdf } from "../pdf";
import { LABELS, type ResourceBuild } from "../types";

const BASE = "photography-client-questionnaire-template";

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Photography & video",
    title: "Client questionnaire",
    subtitle: "A few questions before we plan your shoot. Answer what you can — we’ll go over the rest together.",
    logoBox: true,
    meta: [{ label: "Client" }, { label: "Date" }, { label: "Project / reference" }],
  },

  { kind: "section", number: 1, title: "Contact details" },
  {
    kind: "fields",
    columns: 2,
    items: [
      { label: "Full name" },
      { label: "Company or brokerage" },
      { label: "Email" },
      { label: "Phone" },
      { label: "Best way to reach you" },
      { label: "Billing contact (if different)" },
    ],
  },

  { kind: "section", number: 2, title: "Project goals" },
  { kind: "prompt", label: "What is this project for?", guidance: "For example, a property listing, a website refresh, a product launch, an event or a social campaign.", lines: 2 },
  { kind: "prompt", label: "What does a great result look like?", guidance: "How you’ll judge success — more inquiries, a faster sale, a consistent brand look…", lines: 2 },
  { kind: "prompt", label: "Who is the audience?", lines: 1 },

  { kind: "section", number: 3, title: "Deliverables", intro: "Check everything you’re interested in. We’ll confirm quantities and formats in the quote." },
  {
    kind: "checklist",
    columns: 2,
    items: [
      "Edited photos",
      "Edited video",
      "Short vertical clips for social",
      "Drone / aerial photos or video",
      "Floor plan",
      "360° virtual tour",
      "Headshots or team photos",
      "Something else (describe below)",
    ],
  },
  {
    kind: "fields",
    columns: 2,
    items: [{ label: "Approximate number of photos / length of video" }, { label: "Formats and aspect ratios (e.g., 16:9, 9:16, 1:1)" }],
  },

  { kind: "section", number: 4, title: "Usage" },
  {
    kind: "checklist",
    columns: 2,
    items: ["Website", "Social media", "Listing and MLS sites", "Print, brochures and signage", "Paid advertising", "Shared with third parties (agents, builders, partners)"],
  },
  {
    kind: "prompt",
    label: "Where, and for how long, will the images be used?",
    guidance: "Usage affects licensing and price. Mention anyone else who will also use the images.",
    lines: 2,
  },

  { kind: "section", number: 5, title: "Schedule and access" },
  {
    kind: "fields",
    columns: 2,
    items: [
      { label: "Preferred date(s) and time" },
      { label: "Backup date(s)" },
      { label: "Final delivery deadline" },
      { label: "On-site contact and phone" },
      { label: "Access instructions (keys, gate, lockbox, parking)", span: 2 },
    ],
  },

  { kind: "section", number: 6, title: "Location details" },
  {
    kind: "fields",
    columns: 2,
    items: [
      { label: "Address", span: 2 },
      { label: "Type of location (home, office, venue, outdoor…)" },
      { label: "Size or number of rooms / areas" },
    ],
  },
  {
    kind: "prompt",
    label: "Anything we should know about the location?",
    guidance: "Pets, occupants, ongoing work, restricted areas, venue rules, permits, or nearby airports if you’ve asked for drone footage.",
    lines: 2,
  },

  { kind: "section", number: 7, title: "Style and references" },
  { kind: "prompt", label: "Links to photos or videos you like", guidance: "Websites, listings, social accounts or a mood board. Say what you like about each one.", lines: 3 },
  { kind: "prompt", label: "Words that describe the look you want", lines: 1 },
  { kind: "prompt", label: "Anything you don’t want", lines: 1 },

  { kind: "section", number: 8, title: "Budget", intro: "A range helps us recommend the right package and options for your project." },
  {
    kind: "checklist",
    columns: 2,
    items: ["Under $__________", "$__________ to $__________", "$__________ to $__________", "Not sure yet — please recommend options"],
  },
  { kind: "fields", columns: 2, items: [{ label: "Purchase order or approval process" }, { label: "Who pays the invoice?" }] },

  { kind: "section", number: 9, title: "Approvals and decision makers" },
  {
    kind: "table",
    columns: [
      { header: "Name", width: 26 },
      { header: "Role", width: 22 },
      { header: "Email", width: 28 },
      { header: "Approves", width: 24 },
    ],
    blankRows: 3,
    note: "For example: final photo selection, video edits, invoice approval.",
  },
  {
    kind: "prompt",
    label: "How should feedback be shared?",
    guidance: "One combined list of changes per review round keeps things moving. Who will collect feedback from everyone?",
    lines: 2,
  },
  { kind: "paragraph", text: "Thank you! Please return this form by __________ so we can prepare your quote and shot plan." },
];

export async function buildQuestionnaire(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Photography client questionnaire",
    subject: "Client intake form covering goals, deliverables, usage, schedule, location, style, budget and approvals",
    description: "Editable client questionnaire for photographers and videographers.",
    keywords: ["photography client questionnaire", "client intake form", "photography", "videography"],
    runningTitle: "Client questionnaire",
  };
  const docx = await renderDocx(meta, blocks);
  const pdf = await renderPdf(meta, blocks);
  return {
    id: "photography-client-questionnaire",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "docx", filename: `${BASE}.docx`, bytes: docx, label: LABELS.docx },
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
    ],
  };
}
