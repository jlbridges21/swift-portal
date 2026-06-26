import type { QuoteLineItem } from "@/lib/types";
import { formatIncludesBlock } from "@/lib/quote-display";

export interface ServiceTemplate {
  id: string;
  serviceNames: string[];
  title: string;
  startingAtCents: number | null;
  startingLabel: string;
  lineItems: QuoteLineItem[];
  includes: string[];
  description?: string;
  notes: string;
  hidePricing?: boolean;
  recommended?: boolean;
}

export const PRELIMINARY_ESTIMATE_DISCLAIMER =
  "This estimate is generated automatically based on the service you selected. It is intended to provide a realistic starting price for your project. Final pricing may be adjusted after Swift Aerial Media reviews the property, confirms the scope of work, and schedules the shoot.";

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "aerial_photography",
    serviceNames: ["Aerial Photography"],
    title: "Aerial Photography",
    startingAtCents: 24900,
    startingLabel: "Starting at $249",
    lineItems: [{ description: "Aerial Photography", amount_cents: 24900 }],
    includes: [
      "FAA Part 107 licensed pilot",
      "20–30 professionally edited aerial images",
      "Multiple property overview angles",
      "Waterfront or neighborhood context (when applicable)",
      "MLS-ready high-resolution images",
      "Commercial usage rights",
      "Secure Swift Portal delivery",
      "Typical turnaround: 24–48 hours",
    ],
    notes: "Final pricing depends on property size, accessibility, airspace, travel, and requested shot list.",
  },
  {
    id: "aerial_videography",
    serviceNames: ["Aerial Videography"],
    title: "Aerial Videography",
    startingAtCents: 39900,
    startingLabel: "Starting at $399",
    lineItems: [{ description: "Aerial Videography", amount_cents: 39900 }],
    includes: [
      "Cinematic drone flight",
      "Professionally edited highlight video",
      "Licensed music",
      "Color grading",
      "Social media version",
      "Website version",
      "Commercial usage rights",
      "Swift Portal delivery",
    ],
    notes: "",
  },
  {
    id: "exterior_360_tour",
    serviceNames: ["360 Virtual Tour", "Exterior 360° Virtual Tour"],
    title: "Exterior 360° Virtual Tour",
    startingAtCents: 29900,
    startingLabel: "Starting at $299",
    lineItems: [{ description: "Exterior 360° Virtual Tour", amount_cents: 29900 }],
    includes: [
      "Exterior-only 360° capture",
      "Hosted interactive tour",
      "Shareable tour link",
      "Website embed code",
      "Swift Portal access",
    ],
    description:
      "Designed for homes, commercial properties, developments, golf courses, resorts, marinas, and outdoor spaces.",
    notes:
      "This service is for exterior virtual tours only. Interior Matterport-style walkthroughs are not included. Pricing varies based on project size.",
  },
  {
    id: "drone_mapping",
    serviceNames: ["Drone Mapping"],
    title: "Drone Mapping",
    startingAtCents: 59900,
    startingLabel: "Starting at $599",
    lineItems: [{ description: "Drone Mapping", amount_cents: 59900 }],
    includes: [
      "High-overlap mapping mission",
      "Orthomosaic map",
      "Site documentation",
      "Organized digital deliverables",
    ],
    notes: "",
  },
  {
    id: "real_estate_media_package",
    serviceNames: ["Real Estate Media Package"],
    title: "Real Estate Media Package",
    startingAtCents: 49900,
    startingLabel: "Starting at $499",
    recommended: true,
    lineItems: [{ description: "Real Estate Media Package", amount_cents: 49900 }],
    includes: [
      "Professional aerial photography",
      "Cinematic aerial video",
      "MLS-ready media",
      "Social media video",
      "Commercial usage rights",
      "Swift Portal delivery",
    ],
    notes: "",
  },
  {
    id: "commercial_aerial",
    serviceNames: ["Commercial Aerial", "Commercial Aerial Media"],
    title: "Commercial Aerial Media",
    startingAtCents: 79900,
    startingLabel: "Starting at $799",
    lineItems: [{ description: "Commercial Aerial Media", amount_cents: 79900 }],
    includes: [
      "Discovery consultation",
      "Commercial aerial photography",
      "Commercial aerial video",
      "Marketing-ready media",
      "Commercial licensing",
    ],
    notes: "",
  },
  {
    id: "event_coverage",
    serviceNames: ["Event Coverage"],
    title: "Event Coverage",
    startingAtCents: 59900,
    startingLabel: "Starting at $599",
    lineItems: [{ description: "Event Coverage", amount_cents: 59900 }],
    includes: [
      "Drone photography",
      "Drone videography",
      "Highlight video",
      "Commercial licensing",
      "Swift Portal delivery",
    ],
    notes: "",
  },
  {
    id: "construction_progress",
    serviceNames: ["Construction Progress Documentation"],
    title: "Construction Progress Documentation",
    startingAtCents: 29900,
    startingLabel: "Starting at $299 per visit",
    lineItems: [{ description: "Construction Progress Documentation", amount_cents: 29900 }],
    includes: [
      "Scheduled drone site visit",
      "Progress photography",
      "Progress video",
      "Chronological project archive",
      "Secure Swift Portal delivery",
    ],
    notes: "",
  },
  {
    id: "land_listing",
    serviceNames: ["Land Listing Package"],
    title: "Land Listing Package",
    startingAtCents: 34900,
    startingLabel: "Starting at $349",
    lineItems: [{ description: "Land Listing Package", amount_cents: 34900 }],
    includes: [
      "Property overview photography",
      "Boundary highlight imagery",
      "Access road imagery",
      "Nearby landmarks",
      "Waterfront context when applicable",
      "MLS-ready images",
    ],
    notes: "",
  },
  {
    id: "golf_resort",
    serviceNames: ["Golf Course & Resort Marketing"],
    title: "Golf Course & Resort Marketing",
    startingAtCents: 0,
    startingLabel: "Custom Proposal Required",
    hidePricing: true,
    lineItems: [{ description: "Custom Proposal Required", amount_cents: 0 }],
    includes: [],
    description: "Custom proposal based on property size, deliverables, and marketing goals.",
    notes: "A custom official proposal will be prepared after project review.",
  },
  {
    id: "roof_inspection",
    serviceNames: ["Roof Inspection"],
    title: "Roof Inspection",
    startingAtCents: 19900,
    startingLabel: "Starting at $199",
    lineItems: [{ description: "Roof Inspection", amount_cents: 19900 }],
    includes: [
      "High-resolution inspection imagery",
      "Roof overview",
      "Chimney",
      "Flashing",
      "Gutters",
      "Roof penetrations",
      "Secure digital delivery",
    ],
    notes: "",
  },
  {
    id: "property_documentation",
    serviceNames: ["Property Documentation", "Insurance Documentation"],
    title: "Property Documentation",
    startingAtCents: 24900,
    startingLabel: "Starting at $249",
    lineItems: [{ description: "Property Documentation", amount_cents: 24900 }],
    includes: [
      "Exterior property overview",
      "Roof imagery",
      "Storm damage documentation",
      "High-resolution photography",
      "Date-stamped digital delivery",
      "Secure Swift Portal delivery",
    ],
    notes:
      "Swift Aerial Media documents visible property conditions from the air. We do not provide engineering reports or insurance adjusting services.",
  },
  {
    id: "marina_waterfront",
    serviceNames: ["Marina & Waterfront Marketing"],
    title: "Marina & Waterfront Marketing",
    startingAtCents: 39900,
    startingLabel: "Starting at $399",
    lineItems: [{ description: "Marina & Waterfront Marketing", amount_cents: 39900 }],
    includes: [
      "Marina overview imagery",
      "Waterfront context",
      "Lifestyle photography",
      "Commercial usage rights",
    ],
    notes: "",
  },
  {
    id: "hoa_community",
    serviceNames: ["HOA & Community Marketing"],
    title: "HOA & Community Marketing",
    startingAtCents: 49900,
    startingLabel: "Starting at $499",
    lineItems: [{ description: "HOA & Community Marketing", amount_cents: 49900 }],
    includes: [
      "Entrance monument",
      "Amenities",
      "Pool",
      "Clubhouse",
      "Walking trails",
      "Common areas",
      "Aerial overview",
    ],
    notes: "",
  },
  {
    id: "custom_project",
    serviceNames: ["Other", "Custom Project"],
    title: "Custom Project",
    startingAtCents: 0,
    startingLabel: "Custom Quote",
    hidePricing: true,
    lineItems: [{ description: "Custom Proposal Required", amount_cents: 0 }],
    includes: [],
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
  if (lower.includes("real estate") || lower.includes("listing media")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "real_estate_media_package")!;
  }
  if (lower.includes("commercial")) return SERVICE_TEMPLATES.find((t) => t.id === "commercial_aerial")!;
  if (lower.includes("event")) return SERVICE_TEMPLATES.find((t) => t.id === "event_coverage")!;
  if (lower.includes("construction")) return SERVICE_TEMPLATES.find((t) => t.id === "construction_progress")!;
  if (lower.includes("roof")) return SERVICE_TEMPLATES.find((t) => t.id === "roof_inspection")!;
  if (lower.includes("insurance") || lower.includes("documentation")) {
    return SERVICE_TEMPLATES.find((t) => t.id === "property_documentation")!;
  }
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
  const includesBlock = formatIncludesBlock(template.includes);
  const description = [template.description, includesBlock].filter(Boolean).join("\n\n");

  const noteParts = [
    template.hidePricing ? "Custom Proposal Required" : template.startingLabel,
    template.notes,
  ].filter(Boolean);

  return {
    title: `Preliminary Estimate — ${template.title}`,
    description,
    line_items: template.lineItems,
    total_cents,
    notes: noteParts.join("\n\n"),
    quote_kind: "preliminary" as const,
  };
}
