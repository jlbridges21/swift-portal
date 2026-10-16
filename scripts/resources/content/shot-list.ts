import type { Block } from "../blocks";
import type { DocMeta } from "../brand";
import { renderDocx } from "../docx";
import { renderPdf } from "../pdf";
import { LABELS, type ResourceBuild } from "../types";

const BASE = "real-estate-photography-shot-list-template";

const blocks: Block[] = [
  {
    kind: "header",
    eyebrow: "Real estate photography",
    title: "Listing shoot shot list",
    subtitle: "Send the prep list to the agent or homeowner a day or two before the shoot.",
  },
  {
    kind: "fields",
    columns: 4,
    items: [
      { label: "Property address", span: 2 },
      { label: "Shoot date" },
      { label: "Arrival time" },
      { label: "Agent / homeowner and phone", span: 2 },
      { label: "Beds / baths / sq ft" },
      { label: "Access notes" },
    ],
  },
  {
    kind: "section",
    number: 1,
    title: "Before the shoot — agent and homeowner prep",
    intro: "Share this with whoever is preparing the home. Each item saves editing time and helps the listing look its best.",
  },
  {
    kind: "checklist",
    columns: 2,
    items: [
      "Turn on all lights, including lamps",
      "Replace burnt-out bulbs; match bulb colors",
      "Open blinds and curtains evenly",
      "Clear kitchen counters of small items",
      "Hide dish soap, sponges and towels",
      "Clear magnets and papers off the fridge",
      "Clear bathroom counters and toiletries",
      "Close toilet lids; tidy showers and tubs",
      "Make beds and straighten pillows",
      "Put away personal photos, mail and valuables",
      "Hide pet bowls, beds, toys and litter boxes",
      "Turn off ceiling fans and TVs",
      "Move cars off the driveway and street front",
      "Put trash and recycling bins out of sight",
      "Mow, sweep walkways and tidy the yard",
      "Plan for pets and occupants to be out",
    ],
  },
  { kind: "section", number: 2, title: "Exterior" },
  {
    kind: "checklist",
    columns: 2,
    items: [
      "Front elevation — straight on",
      "Front elevation — angle from each front corner",
      "Front entry and door",
      "Street view and curb appeal",
      "Garage and driveway",
      "Rear elevation",
      "Backyard — wide from each corner",
      "Patio, deck or porch",
      "Pool, spa or outdoor kitchen",
      "Notable landscaping, views or amenities",
    ],
  },
  { kind: "section", number: 3, title: "Twilight and drone add-ons" },
  {
    kind: "checkGroups",
    groups: [
      {
        title: "Twilight",
        tag: "Add-on",
        items: ["Front elevation at dusk with all lights on", "Backyard, patio or pool at dusk", "Exterior lighting details"],
      },
      {
        title: "Drone",
        tag: "Add-on",
        items: [
          "High front angle of the home",
          "Overhead view of the lot",
          { text: "Neighborhood context and nearby amenities", hint: "Confirm airspace and any authorization first" },
        ],
      },
    ],
  },
  {
    kind: "section",
    number: 4,
    title: "Interior — room by room",
    intro: "Shoot from doorways and corners at a consistent height, keep verticals straight, and check mirrors and windows for reflections.",
    pageBreakBefore: true,
  },
  {
    kind: "checkGroups",
    groups: [
      { title: "Entry and foyer", items: ["Wide from the front door", "View into the main living space", "Staircase (if present)"] },
      { title: "Living and family rooms", items: ["Wide from two corners", "Fireplace or feature wall", "Flow into adjacent rooms"] },
      { title: "Kitchen", items: ["Wide from the main entry point", "Opposite-angle wide", "Island or peninsula", "Pantry"] },
      { title: "Dining", items: ["Wide showing table and light fixture", "Connection to kitchen or living area", "View to the outdoors (if notable)"] },
      { title: "Primary suite", items: ["Bedroom from two angles", "Walk-in closet", "Primary bath — vanity", "Primary bath — shower or tub"] },
      { title: "Bedrooms and bathrooms", items: ["Each bedroom — one or two angles", "Each bath — vanity and mirror", "Each bath — shower or tub"] },
      { title: "Bonus spaces", items: ["Office or den", "Laundry room", "Basement, media room or gym", "Mudroom or bonus room"] },
      { title: "Details", items: ["Finishes, fixtures and hardware", "Built-ins and cabinetry", "Upgraded or smart-home features", "Features the agent asked for"] },
    ],
  },
  { kind: "section", number: 5, title: "Before you leave" },
  {
    kind: "checklist",
    columns: 2,
    items: [
      "Compare shots against this list",
      "Check focus and exposure on the camera",
      "Back up or double-check memory cards",
      "Return furniture, blinds and decor as found",
      "Turn off lights you turned on (if requested)",
      "Lock up and return keys or lockbox",
      "Note any reshoots or follow-ups for the agent",
      "Confirm the delivery time with the agent",
    ],
  },
];

export async function buildShotList(): Promise<ResourceBuild> {
  const meta: DocMeta = {
    title: "Real estate photography shot list",
    subject: "Pre-shoot prep, exterior, room-by-room interior, add-on and final check lists for listing shoots",
    description: "Printable and editable shot list for real estate photographers.",
    keywords: ["real estate photography", "shot list", "checklist", "listing photos"],
    runningTitle: "Real estate photography shot list",
  };
  const docx = await renderDocx(meta, blocks);
  const pdf = await renderPdf(meta, blocks);
  return {
    id: "real-estate-photography-shot-list",
    previewFrom: `${BASE}.pdf`,
    files: [
      { format: "pdf", filename: `${BASE}.pdf`, bytes: pdf.bytes, pages: pdf.pages, label: LABELS.pdf },
      { format: "docx", filename: `${BASE}.docx`, bytes: docx, label: LABELS.docx },
    ],
  };
}
