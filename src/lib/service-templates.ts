import type { QuoteLineItem } from "@/lib/types";

export interface ServiceTemplate {
  id: string;
  serviceNames: string[];
  title: string;
  startingAtCents: number | null;
  startingLabel: string;
  lineItems: QuoteLineItem[];
  description: string;
  notes: string;
}

export const PRELIMINARY_ESTIMATE_DISCLAIMER =
  "This estimate is generated automatically based on the service you selected. It is intended to provide a realistic starting price for your project. Final pricing may be adjusted after Swift Aerial Media reviews the property, confirms the scope of work, and schedules the shoot.";

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "aerial_photography",
    serviceNames: ["Aerial Photography"],
    title: "Essential Aerial Photography Package",
    startingAtCents: 24900,
    startingLabel: "Starting at $249",
    lineItems: [
      { description: "Essential Aerial Photography Package", amount_cents: 24900 },
      { description: "Commercial Usage Rights", amount_cents: 0 },
      { description: "Secure Swift Portal Delivery", amount_cents: 0 },
    ],
    description:
      "Professional aerial photography for residential, waterfront, commercial, and land listings.\n\nIncludes:\n• 20–30 professionally edited drone photographs\n• Multiple property overview angles\n• MLS-ready formatting\n• High-resolution downloads\n• Commercial usage rights\n• Secure delivery through Swift Portal\n• Standard 24–48 hour turnaround",
    notes:
      "Final pricing depends on property size, accessibility, airspace, travel, and requested shot list.",
  },
  {
    id: "aerial_videography",
    serviceNames: ["Aerial Videography"],
    title: "Cinematic Aerial Video Package",
    startingAtCents: 39900,
    startingLabel: "Starting at $399",
    lineItems: [
      { description: "Cinematic Aerial Video Package", amount_cents: 39900 },
      { description: "Commercial Usage Rights", amount_cents: 0 },
      { description: "Swift Portal Delivery", amount_cents: 0 },
    ],
    description:
      "Professional cinematic aerial video for real estate, commercial marketing, resorts, developments, and businesses.\n\nIncludes:\n• Cinematic drone footage\n• Professionally edited highlight video\n• Licensed music\n• Color correction\n• Social media export\n• Commercial usage rights\n• Swift Portal delivery",
    notes: "",
  },
  {
    id: "exterior_360_tour",
    serviceNames: ["360 Virtual Tour", "Exterior 360° Virtual Tour"],
    title: "Exterior 360° Virtual Tour Package",
    startingAtCents: 29900,
    startingLabel: "Starting at $299",
    lineItems: [
      { description: "Exterior 360° Virtual Tour Package", amount_cents: 29900 },
      { description: "Hosted Interactive Tour", amount_cents: 0 },
      { description: "Embed Code & Share Link", amount_cents: 0 },
    ],
    description:
      "Interactive exterior-only 360° virtual tour.\n\nIncludes:\n• Exterior-only 360° capture\n• Hosted interactive tour\n• Shareable tour link\n• Website embed code\n• Swift Portal access",
    notes:
      "This service is for exterior virtual tours only. Interior Matterport-style walkthroughs are not included. Pricing varies significantly based on project size. Large commercial properties, golf courses, resorts, and country clubs may exceed several thousand dollars.",
  },
  {
    id: "drone_mapping",
    serviceNames: ["Drone Mapping"],
    title: "Drone Mapping Package",
    startingAtCents: 59900,
    startingLabel: "Starting at $599",
    lineItems: [
      { description: "Drone Mapping Package", amount_cents: 59900 },
      { description: "Processed Deliverables", amount_cents: 0 },
    ],
    description:
      "Professional mapping for land, construction, and development projects.\n\nIncludes:\n• High-overlap mapping flight\n• Orthomosaic processing\n• Organized digital delivery",
    notes: "",
  },
  {
    id: "real_estate_media_package",
    serviceNames: ["Real Estate Media Package"],
    title: "Complete Listing Media Package",
    startingAtCents: 49900,
    startingLabel: "Starting at $499",
    lineItems: [
      { description: "Complete Listing Media Package", amount_cents: 49900 },
      { description: "MLS Delivery & Licensing", amount_cents: 0 },
    ],
    description:
      "Complete marketing package for residential listings.\n\nIncludes:\n• 20–30 edited aerial photographs\n• Cinematic aerial video\n• MLS-ready media\n• Commercial licensing\n• Swift Portal delivery",
    notes: "",
  },
  {
    id: "commercial_aerial",
    serviceNames: ["Commercial Aerial", "Commercial Aerial Media"],
    title: "Commercial Marketing Package",
    startingAtCents: 79900,
    startingLabel: "Starting at $799",
    lineItems: [
      { description: "Commercial Marketing Package", amount_cents: 79900 },
      { description: "Commercial Usage Rights", amount_cents: 0 },
    ],
    description:
      "Designed for businesses, developers, apartment communities, hotels, resorts, and commercial properties.\n\nIncludes:\n• Drone photography\n• Drone videography\n• Edited media\n• Commercial licensing",
    notes: "",
  },
  {
    id: "event_coverage",
    serviceNames: ["Event Coverage"],
    title: "Event Coverage Package",
    startingAtCents: 59900,
    startingLabel: "Starting at $599",
    lineItems: [
      { description: "Event Coverage Package", amount_cents: 59900 },
      { description: "Edited Deliverables", amount_cents: 0 },
    ],
    description:
      "Professional aerial event coverage.\n\nIncludes:\n• Drone photography\n• Drone videography\n• Highlight video\n• Commercial licensing",
    notes: "",
  },
  {
    id: "construction_progress",
    serviceNames: ["Construction Progress Documentation"],
    title: "Construction Progress Visit",
    startingAtCents: 29900,
    startingLabel: "Starting at $299 per visit",
    lineItems: [
      { description: "Construction Progress Visit", amount_cents: 29900 },
      { description: "Project Archive", amount_cents: 0 },
    ],
    description:
      "Recurring aerial documentation for builders and developers.\n\nIncludes:\n• Scheduled drone site visit\n• Progress photography\n• Progress video\n• Organized project archive\n\nPerfect for recurring monthly documentation.",
    notes: "",
  },
  {
    id: "land_listing",
    serviceNames: ["Land Listing Package"],
    title: "Land Listing Package",
    startingAtCents: 34900,
    startingLabel: "Starting at $349",
    lineItems: [
      { description: "Land Listing Package", amount_cents: 34900 },
      { description: "MLS Delivery", amount_cents: 0 },
    ],
    description:
      "Designed specifically for vacant land marketing.\n\nIncludes:\n• Boundary overview imagery\n• Property overview shots\n• Access road imagery\n• Waterfront imagery when applicable",
    notes: "",
  },
  {
    id: "golf_resort",
    serviceNames: ["Golf Course & Resort Marketing"],
    title: "Golf Course & Resort Marketing",
    startingAtCents: 0,
    startingLabel: "Custom Quote",
    lineItems: [{ description: "Custom Proposal Required", amount_cents: 0 }],
    description:
      "Designed for golf courses, resorts, country clubs, and destination properties.\n\nPricing depends on acreage, amenities, deliverables, and marketing goals.",
    notes: "A custom official proposal will be prepared after project review.",
  },
  {
    id: "roof_inspection",
    serviceNames: ["Roof Inspection"],
    title: "Roof Inspection Package",
    startingAtCents: 19900,
    startingLabel: "Starting at $199",
    lineItems: [
      { description: "Roof Inspection Package", amount_cents: 19900 },
      { description: "Digital Inspection Report", amount_cents: 0 },
    ],
    description:
      "Drone roof inspections for homeowners, contractors, and insurance documentation.",
    notes: "",
  },
  {
    id: "marina_waterfront",
    serviceNames: ["Marina & Waterfront Marketing"],
    title: "Waterfront Marketing Package",
    startingAtCents: 39900,
    startingLabel: "Starting at $399",
    lineItems: [
      { description: "Waterfront Marketing Package", amount_cents: 39900 },
      { description: "Commercial Usage Rights", amount_cents: 0 },
    ],
    description:
      "Photography and video for waterfront homes, marinas, and coastal businesses.",
    notes: "",
  },
  {
    id: "hoa_community",
    serviceNames: ["HOA & Community Marketing"],
    title: "Community Marketing Package",
    startingAtCents: 49900,
    startingLabel: "Starting at $499",
    lineItems: [
      { description: "Community Marketing Package", amount_cents: 49900 },
      { description: "Commercial Licensing", amount_cents: 0 },
    ],
    description:
      "Photography for neighborhoods, amenities, clubhouses, apartment communities, and HOAs.",
    notes: "",
  },
  {
    id: "custom_project",
    serviceNames: ["Other", "Custom Project"],
    title: "Custom Project Estimate",
    startingAtCents: 0,
    startingLabel: "Custom Quote",
    lineItems: [{ description: "Custom Proposal Required", amount_cents: 0 }],
    description:
      "Swift Aerial Media will review your request and prepare a custom proposal based on the project scope.",
    notes: "Final pricing will be confirmed after scope review and scheduling.",
  },
];

const FALLBACK_TEMPLATE = SERVICE_TEMPLATES.find((t) => t.id === "custom_project")!;

export function getServiceTemplate(serviceType: string): ServiceTemplate {
  const trimmed = serviceType.trim();
  const exact = SERVICE_TEMPLATES.find((t) => t.serviceNames.includes(trimmed));
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const fuzzy = SERVICE_TEMPLATES.find((t) =>
    t.serviceNames.some(
      (name) => lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)
    )
  );
  if (fuzzy) return fuzzy;

  if (lower.includes("photo")) return SERVICE_TEMPLATES.find((t) => t.id === "aerial_photography")!;
  if (lower.includes("video") || lower.includes("cinematic")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "aerial_videography")!;
  }
  if (lower.includes("360") || lower.includes("tour")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "exterior_360_tour")!;
  }
  if (lower.includes("mapping")) return SERVICE_TEMPLATES.find((t) => t.id === "drone_mapping")!;
  if (lower.includes("real estate") || lower.includes("listing")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "real_estate_media_package")!;
  }
  if (lower.includes("commercial")) return SERVICE_TEMPLATES.find((t) => t.id === "commercial_aerial")!;
  if (lower.includes("event")) return SERVICE_TEMPLATES.find((t) => t.id === "event_coverage")!;
  if (lower.includes("construction")) return SERVICE_TEMPLATES.find((t) => t.id === "construction_progress")!;
  if (lower.includes("roof")) return SERVICE_TEMPLATES.find((t) => t.id === "roof_inspection")!;
  if (lower.includes("waterfront") || lower.includes("marina")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "marina_waterfront")!;
  }
  if (lower.includes("hoa") || lower.includes("community")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "hoa_community")!;
  }
  if (lower.includes("golf") || lower.includes("resort")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "golf_resort")!;
  }

  return FALLBACK_TEMPLATE;
}

export function buildPreliminaryEstimatePayload(serviceType: string) {
  const template = getServiceTemplate(serviceType);
  const total_cents = template.lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  return {
    title: `Preliminary Estimate — ${template.title}`,
    description: template.description,
    line_items: template.lineItems,
    total_cents,
    notes: [template.startingLabel, template.notes].filter(Boolean).join("\n\n"),
    quote_kind: "preliminary" as const,
  };
}
