export const PARTNER_SECTION_IDS = [
  "overview",
  "referrals",
  "commissions",
  "payouts",
  "landing",
  "payout-details",
] as const;

export type PartnerSectionId = (typeof PARTNER_SECTION_IDS)[number];

export type PartnerNavSection = {
  id: PartnerSectionId;
  label: string;
  href: string;
};

export const PARTNER_NAV_SECTIONS: PartnerNavSection[] = [
  { id: "overview", label: "Overview", href: "/partner/dashboard" },
  { id: "referrals", label: "Referrals", href: "/partner/referrals" },
  { id: "commissions", label: "Commissions", href: "/partner/commissions" },
  { id: "payouts", label: "Payouts", href: "/partner/payouts" },
  { id: "landing", label: "Landing page", href: "/partner/landing" },
  { id: "payout-details", label: "Payout details", href: "/partner/payout-details" },
];

export function partnerSectionForPath(pathname: string): PartnerSectionId {
  const match = PARTNER_NAV_SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
  );
  return match?.id ?? "overview";
}
