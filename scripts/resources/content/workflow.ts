import type { Block, CheckGroup } from "../blocks";
import { BRAND, FOOTER_TEXT, type DocMeta } from "../brand";
import { renderPdf } from "../pdf";
import { LABELS, type ResourceBuild } from "../types";
import { calc, CURRENCY, input, Workbook, XS, type XStyle } from "../xlsx";

const BASE = "photography-project-workflow-checklist";

type Stage = { name: string; done: string; items: string[] };

export const STAGES: Stage[] = [
  {
    name: "Inquiry",
    done: "You understand the job and have what you need to price it.",
    items: ["Reply within your stated response time", "Confirm location, date and scope", "Ask about usage, deadline and budget", "Send your questionnaire or intake form", "Log the lead and where it came from"],
  },
  {
    name: "Estimate",
    done: "The client has a clear quote with an expiry date.",
    items: ["Price from your costs and target margin", "List deliverables, timeline and add-ons", "State deposit, reschedule and usage terms", "Set an expiry date on the quote", "Follow up if there’s no reply"],
  },
  {
    name: "Booking",
    done: "The date is locked in and confirmed in writing.",
    items: ["Get the signed quote or agreement", "Collect the deposit, if you take one", "Add to your calendar with address and access", "Send a booking confirmation"],
  },
  {
    name: "Pre-shoot",
    done: "The site, the client and your gear are ready.",
    items: ["Send the prep checklist to the client", "Confirm access, parking and on-site contact", "Check the weather (and airspace for drone work)", "Charge batteries, format cards, clean lenses", "Prepare the shot list"],
  },
  {
    name: "Shoot day",
    done: "Everything on the shot list is captured and backed up.",
    items: ["Arrive early and walk through the site", "Work through the shot list", "Capture alternates of key shots", "Back up files before you leave", "Leave the property as you found it"],
  },
  {
    name: "Editing",
    done: "Final files are exported in every size and format promised.",
    items: ["Import, back up and cull", "Edit to your style guide", "Check verticals, color and consistency", "Remove or blur sensitive details if needed", "Export and name files consistently"],
  },
  {
    name: "Review and revisions",
    done: "The client has approved the final selection.",
    items: ["Share a proof gallery or review link", "Collect feedback in one round", "Make the agreed revisions", "Quote extra changes separately"],
  },
  {
    name: "Payment",
    done: "The invoice is paid in full.",
    items: ["Send the invoice with a due date", "Apply any deposit already paid", "Send a reminder around the due date", "Mark paid and send a receipt"],
  },
  {
    name: "Delivery",
    done: "The client has the final files and knows how they may use them.",
    items: ["Deliver final files by gallery or link", "Include a usage and licensing summary", "Confirm the client received everything", "Archive the project and files"],
  },
  {
    name: "Follow-up",
    done: "The relationship is set up for the next job.",
    items: ["Send a thank-you", "Ask for a review or testimonial", "Ask permission to use work in your portfolio", "Note what to improve next time", "Schedule a check-in for future work"],
  },
];

const groups: CheckGroup[] = STAGES.map((s, i) => ({ title: `${String(i + 1).padStart(2, "0")}  ${s.name}`, items: s.items }));

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Photography & video",
    title: "Project workflow checklist",
    subtitle: "Every step from first inquiry to follow-up. Print one per project, or use the spreadsheet tracker to follow all your jobs in one place.",
    meta: [{ label: "Project / property" }, { label: "Client" }, { label: "Shoot date" }, { label: "Delivery due" }],
  },
  { kind: "checkGroups", groups: groups.slice(0, 6) },
  { kind: "pageBreak" },
  { kind: "checkGroups", groups: groups.slice(6) },
  { kind: "section", title: "Project notes" },
  { kind: "prompt", lines: 6 },
];

function trackerSheet(book: Workbook): void {
  const s = book.sheet("Project tracker");
  s.landscape = true;
  const stageCols = ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  s.width("A", 34).width("B", 22).width("C", 13).width("D", 24).width("E", 14);
  stageCols.forEach((c) => s.width(c, 13.5));
  s.width("P", 11).width("Q", 40);

  s.merge("A1:E1", "Photography project tracker", XS.title).height(1, 32);
  s.merge("A2:Q2", "One row per project. Click a stage cell and use the dropdown to set Not started, In progress or Done — progress updates automatically. Delete the example row when you start.", XS.subtitle).height(2, 22);
  s.height(3, 8);

  const head: Array<[string, string, XStyle]> = [
    ["A", "Project / property", XS.head],
    ["B", "Client", XS.head],
    ["C", "Shoot date", XS.head],
    ["D", "Services", XS.head],
    ["E", "Quote total", XS.headRight],
    ...STAGES.map((st, i): [string, string, XStyle] => [stageCols[i], st.name, { ...XS.headCenter, wrap: true }]),
    ["P", "Progress", XS.headRight],
    ["Q", "Next step / notes", XS.head],
  ];
  for (const [c, h, st] of head) s.set(`${c}4`, h, st);
  s.height(4, 34);

  const first = 5;
  const last = 104;
  const stage = input({ h: "center", indent: 0, font: { size: 9, color: BRAND.text } });
  for (let r = first; r <= last; r++) {
    s.set(`A${r}`, null, input());
    s.set(`B${r}`, null, input());
    s.set(`C${r}`, null, input({ numFmt: "mmm d, yyyy", h: "left" }));
    s.set(`D${r}`, null, input());
    s.set(`E${r}`, null, input({ numFmt: CURRENCY, h: "right" }));
    stageCols.forEach((c) => s.set(`${c}${r}`, null, stage));
    s.formula(`P${r}`, `IF(A${r}="","",COUNTIF(F${r}:O${r},"Done")/10)`, calc({ numFmt: "0%" }), "");
    s.set(`Q${r}`, null, input());
    s.height(r, 22);
  }
  // Example row
  const example: Record<string, string> = {
    A: "Example — 123 Main St (delete this row)",
    B: "Example client",
    D: "Photos + drone",
    F: "Done",
    G: "Done",
    H: "Done",
    I: "In progress",
    J: "Not started",
    K: "Not started",
    L: "Not started",
    M: "Not started",
    N: "Not started",
    O: "Not started",
    Q: "Send prep checklist to the agent",
  };
  for (const [c, v] of Object.entries(example)) {
    const isStage = stageCols.includes(c);
    s.set(`${c}${first}`, v, isStage ? stage : input({ font: { size: 10, color: BRAND.muted } }));
  }
  s.formula(`P${first}`, `IF(A${first}="","",COUNTIF(F${first}:O${first},"Done")/10)`, calc({ numFmt: "0%" }), 0.3);

  const stageRange = `F${first}:O${last}`;
  s.listValidation(stageRange, '"Not started,In progress,Done"', { title: "Stage status", text: "Not started, In progress or Done" });
  s.equalsHighlight(stageRange, "Done", { color: BRAND.green, fill: BRAND.bgGreen, bold: true });
  s.equalsHighlight(stageRange, "In progress", { color: BRAND.indigoDark, fill: BRAND.bgIndigo, bold: true });
  s.equalsHighlight(stageRange, "Not started", { color: BRAND.muted, fill: BRAND.bgLight });
  s.dataBar(`P${first}:P${last}`, BRAND.indigoSoft);
  s.freeze = { col: 1, row: 4 };
  s.printTitles = "$4:$4";
  s.set(`A${last + 2}`, FOOTER_TEXT, XS.footer);
}

function guideSheet(book: Workbook): void {
  const s = book.sheet("Stage guide");
  s.tabColor = BRAND.lineStrong;
  s.width("A", 2.5).width("B", 24).width("C", 46).width("D", 70);
  s.merge("B2:D2", "Stage guide", XS.title).height(2, 30);
  s.merge("B3:D3", "What each stage in the tracker covers. Mark a stage Done when its “done means” line is true.", XS.subtitle).height(3, 20);
  s.set("B5", "Stage", XS.head);
  s.set("C5", "Done means", XS.head);
  s.set("D5", "Key tasks", XS.head);
  s.height(5, 22);
  STAGES.forEach((st, i) => {
    const r = 6 + i;
    s.set(`B${r}`, `${i + 1}. ${st.name}`, { ...XS.labelBold, v: "top", wrap: true });
    s.set(`C${r}`, st.done, { ...XS.note, v: "top", font: { size: 10, color: BRAND.text } });
    s.set(`D${r}`, st.items.map((t) => `• ${t}`).join("\n"), { ...XS.note, v: "top" });
    s.height(r, 18 + st.items.length * 13);
  });
  s.set("B17", FOOTER_TEXT, XS.footer);
}

export async function buildWorkflow(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Photography project workflow checklist",
    subject: "Inquiry to follow-up checklist for photography and video projects, with a project tracker spreadsheet",
    description: "Printable workflow checklist and editable project tracker for photographers and videographers.",
    keywords: ["photography workflow", "project checklist", "project tracker", "photography business"],
    runningTitle: "Project workflow checklist",
  };
  const pdf = await renderPdf(meta, blocks);
  const book = new Workbook();
  trackerSheet(book);
  guideSheet(book);
  const xlsx = await book.build({ ...meta, title: "Photography project tracker" });
  return {
    id: "photography-project-workflow-checklist",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
      { format: "xlsx", filename: "photography-project-tracker.xlsx", bytes: xlsx, label: "Project tracker — Excel / Google Sheets (.xlsx)" },
    ],
  };
}

