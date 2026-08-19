import type { QuoteLineItem } from "@/lib/types";
import { formatIncludesBlock } from "@/lib/quote-display";
import {
  DEFAULT_PRELIMINARY_DISCLAIMER,
  preliminaryEstimateDisclaimer,
} from "@/lib/preliminary-disclaimer";

export { DEFAULT_PRELIMINARY_DISCLAIMER, preliminaryEstimateDisclaimer };

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
  /** Database row id when loaded from business_services. */
  dbId?: string;
}

/** @deprecated Use preliminaryEstimateDisclaimer(businessName) */
export const PRELIMINARY_ESTIMATE_DISCLAIMER = preliminaryEstimateDisclaimer("our team");

/**
 * Hardcoded Swift catalog used ONLY when a business has zero `business_services`
 * rows (empty catalog fallback). Live businesses read from the database.
 */
export const FALLBACK_SERVICE_TEMPLATES: ServiceTemplate[] = [
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
      "Secure {{portalName}} delivery",
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
      "{{portalName}} delivery",
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
      "{{portalName}} access",
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
      "{{portalName}} delivery",
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
      "{{portalName}} delivery",
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
      "Secure {{portalName}} delivery",
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
      "Secure {{portalName}} delivery",
    ],
    notes:
      "{{businessName}} documents visible property conditions from the air. We do not provide engineering reports or insurance adjusting services.",
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
      "{{businessName}} will review your request and prepare a custom proposal based on the project scope.",
    notes: "Final pricing will be confirmed after scope review and scheduling.",
  },
];

export const SERVICE_TEMPLATES = FALLBACK_SERVICE_TEMPLATES;

function templateById(templates: ServiceTemplate[], id: string): ServiceTemplate | undefined {
  return templates.find((t) => t.id === id);
}

/**
 * Fuzzy matcher used for historical `service_type` strings.
 * Candidates come from `business_services` (or the fallback array).
 */
export function matchServiceTemplate(
  serviceType: string,
  templates: ServiceTemplate[]
): ServiceTemplate {
  const list = templates.length ? templates : FALLBACK_SERVICE_TEMPLATES;
  const fallback =
    templateById(list, "custom_project") ??
    templateById(FALLBACK_SERVICE_TEMPLATES, "custom_project")!;

  const trimmed = serviceType.trim();
  const exact = list.find((t) => t.serviceNames.includes(trimmed) || t.title === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const fuzzy = list.find((t) =>
    t.serviceNames.some(
      (name) => lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)
    )
  );
  if (fuzzy) return fuzzy;

  if (lower.includes("photo")) {
    const hit = templateById(list, "aerial_photography");
    if (hit) return hit;
  }
  if (lower.includes("video") || lower.includes("cinematic")) {
    const hit = templateById(list, "aerial_videography");
    if (hit) return hit;
  }
  if (lower.includes("360") || lower.includes("tour")) {
    const hit = templateById(list, "exterior_360_tour");
    if (hit) return hit;
  }
  if (lower.includes("mapping")) {
    const hit = templateById(list, "drone_mapping");
    if (hit) return hit;
  }
  if (lower.includes("real estate") || lower.includes("listing media")) {
    const hit = templateById(list, "real_estate_media_package");
    if (hit) return hit;
  }
  if (lower.includes("commercial")) {
    const hit = templateById(list, "commercial_aerial");
    if (hit) return hit;
  }
  if (lower.includes("event")) {
    const hit = templateById(list, "event_coverage");
    if (hit) return hit;
  }
  if (lower.includes("construction")) {
    const hit = templateById(list, "construction_progress");
    if (hit) return hit;
  }
  if (lower.includes("roof")) {
    const hit = templateById(list, "roof_inspection");
    if (hit) return hit;
  }
  if (lower.includes("insurance") || lower.includes("documentation")) {
    const hit = templateById(list, "property_documentation");
    if (hit) return hit;
  }
  if (lower.includes("waterfront") || lower.includes("marina")) {
    const hit = templateById(list, "marina_waterfront");
    if (hit) return hit;
  }
  if (lower.includes("hoa") || lower.includes("community")) {
    const hit = templateById(list, "hoa_community");
    if (hit) return hit;
  }
  if (lower.includes("golf") || lower.includes("resort")) {
    const hit = templateById(list, "golf_resort");
    if (hit) return hit;
  }

  return fallback;
}

export function applyServiceTemplateBrand(
  template: ServiceTemplate,
  brand: { portalName: string; businessName: string }
): ServiceTemplate {
  const fill = (value: string) =>
    value.replaceAll("{{portalName}}", brand.portalName).replaceAll("{{businessName}}", brand.businessName);
  return {
    ...template,
    includes: template.includes.map(fill),
    notes: fill(template.notes),
    description: template.description ? fill(template.description) : template.description,
  };
}

export function buildPreliminaryEstimatePayloadFromTemplate(
  template: ServiceTemplate,
  brand?: { portalName: string; businessName: string }
) {
  const branded = applyServiceTemplateBrand(
    template,
    brand ?? { portalName: "the portal", businessName: "our team" }
  );
  const total_cents = branded.lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  const includesBlock = formatIncludesBlock(branded.includes);
  const description = [branded.description, includesBlock].filter(Boolean).join("\n\n");

  const noteParts = [
    branded.hidePricing ? "Custom Proposal Required" : branded.startingLabel,
    branded.notes,
  ].filter(Boolean);

  return {
    title: `Preliminary Estimate — ${branded.title}`,
    description,
    line_items: branded.lineItems,
    total_cents,
    notes: noteParts.join("\n\n"),
    quote_kind: "preliminary" as const,
  };
}

const LEGACY_PAYMENT_DESCRIPTIONS: Record<string, string> = {
  "Aerial Photography": "Professional aerial photography package for the selected property.",
  "Aerial Videography": "Professional aerial videography package for the selected property.",
  "360 Virtual Tour": "Professional exterior 360° virtual tour for the selected property.",
  "Exterior 360° Virtual Tour": "Professional exterior 360° virtual tour for the selected property.",
  "Drone Mapping": "Professional drone mapping package for the selected property.",
  "Real Estate Media Package": "Complete real estate media package for the selected property.",
  "Commercial Aerial Media": "Commercial aerial media package for the selected property.",
  "Event Coverage": "Professional aerial event coverage for the selected property.",
  "Construction Progress Documentation":
    "Construction progress documentation package for the selected property.",
  "Land Listing Package": "Land listing aerial media package for the selected property.",
  "Roof Inspection": "Aerial roof inspection package for the selected property.",
  "Property Documentation": "Property documentation package for the selected property.",
  "Marina & Waterfront Marketing": "Marina and waterfront marketing package for the selected property.",
  "HOA & Community Marketing": "HOA and community marketing package for the selected property.",
};

/** Short default copy for Stripe payment link descriptions. */
export function getServicePaymentDescription(
  serviceType: string,
  template?: ServiceTemplate | null
): string {
  const trimmed = serviceType.trim();
  const fromRow = template?.description?.trim().split("\n")[0]?.trim();
  if (fromRow && !fromRow.includes("{{")) {
    return fromRow.slice(0, 250);
  }
  if (LEGACY_PAYMENT_DESCRIPTIONS[trimmed]) return LEGACY_PAYMENT_DESCRIPTIONS[trimmed];

  const resolved = template ?? matchServiceTemplate(trimmed, FALLBACK_SERVICE_TEMPLATES);
  return `Professional ${resolved.title.toLowerCase()} package for the selected property.`;
}
