/**
 * Section navigation for /platform/partners (program) and /platform/partners/[id] (detail).
 * Visual language matches admin settings via SettingsTabNav.
 */

export const PLATFORM_PARTNERS_SECTION_IDS = [
  "overview",
  "performance",
  "applications",
  "payouts",
  "referral_discount",
  "program_settings",
] as const;

export type PlatformPartnersSectionId = (typeof PLATFORM_PARTNERS_SECTION_IDS)[number];

export type PlatformPartnersSection = {
  id: PlatformPartnersSectionId;
  label: string;
  description: string;
  hashes: string[];
};

export const PLATFORM_PARTNERS_SECTIONS: PlatformPartnersSection[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Program metrics and trends.",
    hashes: ["partners-overview"],
  },
  {
    id: "performance",
    label: "Partner performance",
    description: "Per-partner performance table.",
    hashes: ["partners-performance"],
  },
  {
    id: "applications",
    label: "Applications",
    description: "Applications and partner accounts.",
    hashes: ["partners-applications"],
  },
  {
    id: "payouts",
    label: "Payouts",
    description: "Automated payout runs and controls.",
    hashes: ["partners-payouts"],
  },
  {
    id: "referral_discount",
    label: "Referral discount",
    description: "Signup discount for referred businesses.",
    hashes: ["partners-referral-discount"],
  },
  {
    id: "program_settings",
    label: "Program settings",
    description: "Default commission rate and auto-approve.",
    hashes: ["partners-program-settings"],
  },
];

export function platformPartnersSectionForHash(hash: string): PlatformPartnersSectionId | null {
  const normalized = hash.replace(/^#/, "").trim();
  if (!normalized) return null;
  for (const section of PLATFORM_PARTNERS_SECTIONS) {
    if (section.hashes.some((h) => normalized === h || normalized.startsWith(`${h}-`))) {
      return section.id;
    }
  }
  return null;
}

/** Individual partner detail — real routes under /platform/partners/{id}/… */
export const PLATFORM_PARTNER_DETAIL_SECTION_IDS = [
  "overview",
  "referrals",
  "commissions",
  "payouts",
  "payout-details",
  "landing",
  "settings",
  "activity",
] as const;

export type PlatformPartnerDetailSectionId =
  (typeof PLATFORM_PARTNER_DETAIL_SECTION_IDS)[number];

export type PlatformPartnerDetailSection = {
  id: PlatformPartnerDetailSectionId;
  label: string;
  /** Path segment after /platform/partners/{id}; empty = overview at [id] itself. */
  segment: string;
};

export const PLATFORM_PARTNER_DETAIL_SECTIONS: PlatformPartnerDetailSection[] = [
  { id: "overview", label: "Overview", segment: "" },
  { id: "referrals", label: "Referrals", segment: "referrals" },
  { id: "commissions", label: "Commissions", segment: "commissions" },
  { id: "payouts", label: "Payouts", segment: "payouts" },
  { id: "payout-details", label: "Payout details (Connect)", segment: "payout-details" },
  { id: "landing", label: "Landing page", segment: "landing" },
  { id: "settings", label: "Settings", segment: "settings" },
  { id: "activity", label: "Activity", segment: "activity" },
];

export function platformPartnerDetailHref(
  partnerId: string,
  sectionId: PlatformPartnerDetailSectionId
): string {
  const section = PLATFORM_PARTNER_DETAIL_SECTIONS.find((s) => s.id === sectionId);
  const base = `/platform/partners/${partnerId}`;
  if (!section?.segment) return base;
  return `${base}/${section.segment}`;
}

export function platformPartnerDetailSectionFromPathname(
  pathname: string,
  partnerId: string
): PlatformPartnerDetailSectionId {
  const base = `/platform/partners/${partnerId}`;
  if (pathname === base || pathname === `${base}/`) return "overview";
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : "";
  const segment = rest.split("/")[0] || "";
  const match = PLATFORM_PARTNER_DETAIL_SECTIONS.find((s) => s.segment === segment);
  return match?.id ?? "overview";
}
