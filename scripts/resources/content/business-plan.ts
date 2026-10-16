import type { Block } from "../blocks";
import type { DocMeta } from "../brand";
import { renderDocx } from "../docx";
import { renderPdf } from "../pdf";
import { DISCLAIMER, LABELS, type ResourceBuild } from "../types";

const BASE = "drone-photography-business-plan-template";

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Drone business",
    title: "Drone photography business plan",
    subtitle:
      "A working plan for an aerial photo and video business. Replace each prompt with your own answers and delete anything you don’t need.",
    meta: [{ label: "Business name" }, { label: "Owner" }, { label: "Service area" }, { label: "Version / date" }],
  },
  {
    kind: "note",
    title: "How to use this plan",
    text: "Work through one section at a time and keep answers short and specific. A two-page plan you revisit every quarter is more useful than a long one you never reopen. Leave amounts blank until you have real quotes or numbers. "
      + DISCLAIMER,
  },

  { kind: "section", number: 1, title: "Executive summary" },
  {
    kind: "prompt",
    label: "The business in one sentence",
    guidance: "What you do, for whom, and where. For example: “Aerial photo and video for real estate agents and builders in ________ County.”",
    lines: 2,
  },
  { kind: "prompt", label: "The opportunity", guidance: "Why customers in your area need this now, and what you’ve heard from them directly.", lines: 3 },
  { kind: "prompt", label: "Goals for the next 12 months", guidance: "Two or three measurable goals — revenue, jobs per month, number of repeat clients.", lines: 3 },

  { kind: "section", number: 2, title: "Services", intro: "Start with a short list you can deliver well. Add services once you have demand and the right equipment." },
  {
    kind: "table",
    columns: [
      { header: "Service", width: 28 },
      { header: "What the client gets", width: 36 },
      { header: "Deliverables", width: 20 },
      { header: "Turnaround", width: 16 },
    ],
    rows: [
      ["Real estate aerial photos"],
      ["Aerial and walkthrough video"],
      ["Construction progress documentation"],
      ["Roof and property inspection imagery"],
      ["Mapping and orthomosaics"],
      ["Event and promotional aerials"],
    ],
    blankRows: 1,
    rowHeight: 26,
  },
  { kind: "prompt", label: "What you won’t offer (yet)", guidance: "Work you’ll refer out or add later, and why.", lines: 2 },

  {
    kind: "section",
    number: 3,
    title: "Target customers and markets",
    intro: "Rank the segments you’ll focus on first. Fewer segments, served well, usually beats trying to reach everyone.",
  },
  {
    kind: "table",
    columns: [
      { header: "Segment", width: 30 },
      { header: "What they need", width: 30 },
      { header: "How you’ll reach them", width: 28 },
      { header: "Priority", width: 12, align: "center" },
    ],
    rows: [
      ["Real estate agents and brokerages"],
      ["Home builders and developers"],
      ["Construction and engineering firms"],
      ["Roofing, solar and inspection companies"],
      ["Property managers and HOAs"],
      ["Event venues and planners"],
      ["Tourism, hospitality and local businesses"],
    ],
    rowHeight: 26,
  },
  {
    kind: "fields",
    columns: 2,
    items: [{ label: "Service area (cities, counties or radius)" }, { label: "First ten customers you’ll contact (list separately)" }],
  },

  { kind: "section", number: 4, title: "Competition and positioning" },
  { kind: "prompt", label: "Who else serves these customers?", guidance: "Other drone operators, ground photographers who add aerials, and in-house teams.", lines: 3 },
  { kind: "prompt", label: "How you’ll stand out", guidance: "Turnaround, quality, specialization, reliability, communication, or a service others don’t offer.", lines: 3 },

  { kind: "section", number: 5, title: "Pricing approach" },
  {
    kind: "prompt",
    label: "Pricing model",
    guidance:
      "Per project, per package, hourly or day rate, or a retainer for recurring work such as monthly construction updates. Start from your cost per job and target margin, then compare with the market — not the other way around.",
    lines: 3,
  },
  {
    kind: "table",
    columns: [
      { header: "Package or service", width: 34 },
      { header: "Price", width: 16, align: "right" },
      { header: "What’s included", width: 32 },
      { header: "Cost to deliver", width: 18, align: "right" },
    ],
    blankRows: 4,
  },

  { kind: "section", number: 6, title: "Equipment", intro: "List what you own and what you still need. Include spares — a dead battery or broken propeller can end a job." },
  {
    kind: "table",
    columns: [
      { header: "Item", width: 34 },
      { header: "Purpose", width: 30 },
      { header: "Cost", width: 16, align: "right" },
      { header: "Status", width: 20 },
    ],
    rows: [
      ["Primary drone"],
      ["Backup drone"],
      ["Batteries and charging hub"],
      ["Filters (ND / polarizer)"],
      ["Controller, tablet or screen"],
      ["Ground camera and lenses"],
      ["Editing computer and storage"],
      ["Software (editing, mapping, flight logs)"],
      ["Cases, landing pad and safety gear"],
    ],
    totals: [{ label: "Total equipment", emphasis: true }],
  },

  {
    kind: "section",
    number: 7,
    title: "Operations and compliance",
    intro: "Prompts only — confirm current requirements with the relevant aviation authority, your insurer and a local professional.",
  },
  {
    kind: "checklist",
    columns: 1,
    items: [
      { text: "Pilot certification", hint: "In the US, commercial drone pilots need a Remote Pilot Certificate under FAA Part 107. Note your certificate number and recurrent training date." },
      { text: "Drone registration", hint: "Registration numbers for each aircraft and where they’re marked, if required where you fly." },
      { text: "Airspace checks and authorizations", hint: "How you check airspace before each job and request authorization (for example, LAANC) when needed — check your local requirements." },
      { text: "Insurance", hint: "Liability and equipment coverage. Ask an insurance professional what fits your services and client contracts." },
      { text: "Pre-flight checklist and flight logs", hint: "Weather, site survey, equipment checks, and how you record each flight." },
      { text: "Privacy and data handling", hint: "How you avoid capturing people and neighboring property unnecessarily, and how client files are stored and deleted." },
      { text: "Business registration, licenses and taxes", hint: "Confirm what your city, state and accountant require." },
    ],
  },
  { kind: "prompt", label: "Weather and no-fly policy", guidance: "Conditions that cancel a flight, who decides, and how rescheduling works.", lines: 2 },

  { kind: "section", number: 8, title: "Marketing plan" },
  {
    kind: "table",
    columns: [
      { header: "Channel", width: 30 },
      { header: "Actions", width: 38 },
      { header: "Monthly budget", width: 16, align: "right" },
      { header: "Goal", width: 16 },
    ],
    rows: [
      ["Website and portfolio"],
      ["Google Business Profile"],
      ["Social media (short aerial clips)"],
      ["Direct outreach to agents and builders"],
      ["Referrals and partnerships"],
      ["Local associations and networking"],
    ],
    rowHeight: 26,
  },
  { kind: "prompt", label: "Launch plan", guidance: "How you’ll land your first paying clients — portfolio shoots, introductory offers, or partnering with a ground photographer.", lines: 3 },

  { kind: "section", number: 9, title: "Startup costs", intro: "One-time costs to get running. Use real quotes where you can." },
  {
    kind: "table",
    columns: [
      { header: "Item", width: 44 },
      { header: "Estimated cost", width: 20, align: "right" },
      { header: "Notes", width: 36 },
    ],
    rows: [
      ["Drones and accessories"],
      ["Camera and editing equipment"],
      ["Software (first year)"],
      ["Certification and training"],
      ["Insurance (first payment)"],
      ["Business registration and setup"],
      ["Website, domain and branding"],
      ["Launch marketing"],
      ["Reserve for repairs and slow months"],
    ],
    totals: [{ label: "Total startup costs", emphasis: true }],
  },

  { kind: "section", number: 10, title: "Monthly operating costs" },
  {
    kind: "table",
    columns: [
      { header: "Item", width: 44 },
      { header: "Monthly cost", width: 20, align: "right" },
      { header: "Notes", width: 36 },
    ],
    rows: [
      ["Software subscriptions"],
      ["Insurance"],
      ["Phone and internet"],
      ["Marketing and advertising"],
      ["Vehicle and fuel"],
      ["Cloud storage and file delivery"],
      ["Equipment repair and replacement fund"],
      ["Bookkeeping and accounting"],
      ["Owner pay"],
      ["Other"],
    ],
    totals: [{ label: "Total monthly costs", emphasis: true }],
  },

  { kind: "section", number: 11, title: "Revenue goals worksheet", intro: "Work out how many jobs a month you need, then check that it fits your schedule." },
  {
    kind: "table",
    columns: [
      { header: "Line", width: 64 },
      { header: "Your number", width: 36, align: "right" },
    ],
    rows: [
      ["A. Monthly operating costs (section 10)"],
      ["B. Monthly profit goal"],
      ["C. Revenue needed per month (A + B)"],
      ["D. Average price per job"],
      ["E. Jobs needed per month (C ÷ D)"],
      ["F. Jobs you can realistically complete per week"],
      ["G. Monthly capacity (F × about 4.3 weeks)"],
      ["H. Gap (G − E) — if negative, raise prices, add capacity or lower costs"],
    ],
    rowHeight: 26,
  },

  { kind: "section", number: 12, title: "Milestones" },
  {
    kind: "table",
    columns: [
      { header: "Milestone", width: 52 },
      { header: "Target date", width: 24 },
      { header: "Status", width: 24 },
    ],
    rows: [
      ["Certification and registration complete"],
      ["Insurance in place"],
      ["Equipment purchased and tested"],
      ["Portfolio shoots completed"],
      ["Website and booking process live"],
      ["First paying client"],
      ["Reach ____ jobs per month"],
      ["Review pricing and this plan"],
    ],
  },
];

export async function buildBusinessPlan(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Drone photography business plan template",
    subject: "Business plan with guidance prompts for services, customers, pricing, equipment, compliance, marketing, costs and milestones",
    description: "Editable business plan for a drone photography and video business. Not legal, tax or financial advice.",
    keywords: ["drone business plan", "drone photography", "aerial photography business", "template"],
    runningTitle: "Drone photography business plan",
  };
  const docx = await renderDocx(meta, blocks);
  const pdf = await renderPdf(meta, blocks);
  return {
    id: "drone-photography-business-plan",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "docx", filename: `${BASE}.docx`, bytes: docx, label: LABELS.docx },
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
    ],
  };
}
