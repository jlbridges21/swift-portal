/**
 * Marketing Kit — automatic defaults derived from the project (pure).
 *
 * Nothing here invents property facts: values come from the project, its property record,
 * the assigned client (realtor), the client's saved brand profile, and the business's own
 * branding. Unknown facts stay empty and their template sections hide themselves.
 */
import {
  DEFAULT_FLYER,
  DEFAULT_SECTION_ORDER,
  type AgentInfo,
  type Branding,
  type DesignStyle,
  type MarketingContent,
  type MediaIndexItem,
  type PhotoCategory,
  type PropertyInfo,
  formatNumber,
  isHexColor,
} from "@/lib/marketing/model";

export type BrandProfile = {
  agent?: Partial<Pick<AgentInfo, "name" | "title" | "phone" | "email" | "website" | "brokerage" | "license" | "headshot" | "brokerageLogo">>;
  branding?: Partial<Pick<Branding, "source" | "primaryColor" | "accentColor" | "logo">>;
  websiteTemplate?: DesignStyle;
  socialStyle?: DesignStyle;
};

export type DefaultsInput = {
  project: { property_address: string | null; cover_image_id: string | null };
  property: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null; property_type?: string | null } | null;
  client: { name?: string | null; full_name?: string | null; email?: string | null; phone?: string | null; company?: string | null } | null;
  business: { name: string; primaryColor: string; accentColor: string; hasLogo: boolean };
  brandProfile: BrandProfile | null;
  settings: { defaultTemplate: DesignStyle; photographerCredit: boolean; poweredBy?: boolean };
  media: MediaIndexItem[];
};

const CATEGORY_PATTERNS: [PhotoCategory, RegExp][] = [
  ["floorplan", /floor[\s_-]?plan|floorplan|\bplan\b|\bfp\b|layout/i],
  ["twilight", /twilight|dusk|night|sunset/i],
  ["aerial", /aerial|drone|dji|birds?[\s_-]?eye/i],
  ["pool", /pool|spa\b|hot[\s_-]?tub/i],
  ["kitchen", /kitchen|pantry/i],
  ["dining", /dining|breakfast[\s_-]?nook/i],
  ["living", /living|family[\s_-]?room|great[\s_-]?room|lounge|den\b|foyer|entry/i],
  ["bedroom", /bed[\s_-]?room|bedroom|\bbed\b|primary[\s_-]?suite|master|guest[\s_-]?room|nursery/i],
  ["bathroom", /bath|ensuite|powder|shower/i],
  ["office", /office|study|library/i],
  ["view", /\bview|vista|ocean|lake|water[\s_-]?front|beach/i],
  ["outdoor", /patio|deck|backyard|back[\s_-]?yard|garden|porch|yard|outdoor|terrace|balcony/i],
  ["exterior", /exterior|front|facade|elevation|curb|street|\bext\b|outside|house|home/i],
];

export function classifyPhoto(name: string): PhotoCategory | null {
  const n = name.replace(/\.[a-z0-9]+$/i, "");
  for (const [cat, re] of CATEGORY_PATTERNS) if (re.test(n)) return cat;
  return null;
}

function splitAddress(raw: string): { street: string; locality: string } {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { street: raw.trim(), locality: "" };
  return { street: parts[0]!, locality: parts.slice(1).join(", ") };
}

export function defaultPropertyType(raw: string | null | undefined): string {
  if (!raw || raw === "Other" || raw === "Roof / Inspection" || raw === "Construction Site") return "";
  if (raw === "Residential") return "Single Family Home";
  return raw;
}

export function pickAutoHero(media: MediaIndexItem[], coverId: string | null): string | null {
  const photos = media.filter((m) => m.type === "photo" && m.category !== "floorplan");
  if (coverId && photos.some((p) => p.id === coverId)) return coverId;
  const preferred = photos.find((p) => p.category === "exterior" || p.category === "twilight") ?? photos.find((p) => p.category === "aerial");
  return preferred?.id ?? photos[0]?.id ?? null;
}

export function buildDefaults(input: DefaultsInput): MarketingContent {
  const rawAddress = input.project.property_address?.trim() || input.property?.address?.trim() || "";
  const split = splitAddress(rawAddress);
  const localityFromProperty = [
    input.property?.city?.trim(),
    [input.property?.state?.trim(), input.property?.zip?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const property: PropertyInfo = {
    address: split.street,
    locality: split.locality || localityFromProperty,
    price: null,
    status: "for_sale",
    beds: null,
    baths: null,
    sqft: null,
    lotSize: "",
    yearBuilt: null,
    propertyType: defaultPropertyType(input.property?.property_type),
    description: "",
    descriptionIsDraft: false,
    highlights: [],
    openHouse: null,
    mlsNumber: "",
  };

  const bp = input.brandProfile;
  const clientName = input.client?.full_name?.trim() || input.client?.name?.trim() || "";
  const agent: AgentInfo = {
    name: bp?.agent?.name ?? clientName,
    title: bp?.agent?.title ?? "",
    phone: bp?.agent?.phone ?? input.client?.phone?.trim() ?? "",
    email: bp?.agent?.email ?? input.client?.email?.trim() ?? "",
    website: bp?.agent?.website ?? "",
    brokerage: bp?.agent?.brokerage ?? input.client?.company?.trim() ?? "",
    license: bp?.agent?.license ?? "",
    headshot: bp?.agent?.headshot ?? null,
    brokerageLogo: bp?.agent?.brokerageLogo ?? null,
  };

  const realtorLogo = bp?.branding?.logo ?? agent.brokerageLogo ?? null;
  const hasRealtorBrand = Boolean(realtorLogo || isHexColor(bp?.branding?.primaryColor));
  const branding: Branding = {
    source: bp?.branding?.source ?? (hasRealtorBrand ? (bp?.branding?.logo ? "realtor" : "brokerage") : "business"),
    primaryColor: isHexColor(bp?.branding?.primaryColor)
      ? bp!.branding!.primaryColor!
      : isHexColor(input.business.primaryColor)
        ? input.business.primaryColor
        : "#1F2937",
    accentColor: isHexColor(bp?.branding?.accentColor)
      ? bp!.branding!.accentColor!
      : isHexColor(input.business.accentColor)
        ? input.business.accentColor
        : "#B08D57",
    logo: realtorLogo ?? (input.business.hasLogo ? { kind: "business_logo" } : null),
    unbranded: false,
    photographerCredit: input.settings.photographerCredit,
  };

  return {
    version: 1,
    property,
    agent,
    branding,
    media: {
      heroId: null,
      gallery: { mode: "auto", excluded: [] },
      videoIds: null,
      floorPlanIds: null,
    },
    website: {
      template: bp?.websiteTemplate ?? input.settings.defaultTemplate,
      sections: DEFAULT_SECTION_ORDER.map((key) => ({ key, visible: true })),
      poweredBy: input.settings.poweredBy !== false,
    },
    social: {
      style: bp?.socialStyle ?? bp?.websiteTemplate ?? input.settings.defaultTemplate,
      disabled: [],
      featured: {},
      headlines: {},
      carousel: null,
      includeCarousel: true,
      flyer: { ...DEFAULT_FLYER },
    },
  };
}

/**
 * Deterministic description draft from confirmed facts only. Marked as a draft so the
 * editor labels it and the user reviews it before publishing. No AI call, no invented copy.
 */
export function draftDescription(p: PropertyInfo): string {
  const beds = formatNumber(p.beds);
  const baths = formatNumber(p.baths);
  const sqft = formatNumber(p.sqft);
  const type = p.propertyType.trim().toLowerCase() || "home";
  const specs = [beds && `${beds}-bedroom`, baths && `${baths}-bath`].filter(Boolean).join(", ");
  const where = p.locality.split(",")[0]?.trim();
  let first = `Welcome to ${p.address || "this property"}`;
  if (specs || sqft) {
    first += `, a ${[specs, type].filter(Boolean).join(" ")}${sqft ? ` with ${sqft} square feet` : ""}`;
  }
  if (where) first += ` in ${where}`;
  first += ".";
  const parts = [first];
  if (p.yearBuilt) parts.push(`Built in ${p.yearBuilt}.`);
  if (p.lotSize.trim()) parts.push(`Set on a ${p.lotSize.trim()} lot.`);
  if (p.highlights.length) {
    const list = p.highlights.slice(0, 4).map((h) => h.trim().replace(/\.$/, "").toLowerCase());
    parts.push(`Highlights include ${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0]}.`);
  }
  parts.push("Contact us to schedule a private showing.");
  return parts.join(" ");
}

const SLUG_RESERVED = new Set(["api", "l", "_next", "login", "admin", "dashboard", "auth", "embed", "v", "photo", "folder", "favicon", "robots", "sitemap", "index"]);

/** "123 Main St, Austin, TX" → "123-main-st". Never empty. */
export function slugifyAddress(address: string): string {
  const base = address
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  if (!base) return "property";
  return SLUG_RESERVED.has(base) ? `${base}-home` : base;
}

export function isValidSiteSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 && !SLUG_RESERVED.has(slug);
}

/** Candidate slugs in order: street, street + city, then numbered. */
export function slugCandidates(street: string, locality: string): string[] {
  const a = slugifyAddress(street);
  const city = slugifyAddress(locality.split(",")[0] ?? "");
  const out = [a];
  if (city && city !== "property") out.push(`${a}-${city}`.slice(0, 80).replace(/-+$/g, ""));
  for (let i = 2; i <= 30; i++) out.push(`${a}-${i}`);
  return Array.from(new Set(out));
}
