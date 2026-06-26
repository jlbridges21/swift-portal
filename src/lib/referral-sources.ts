export const REFERRAL_SOURCES = [
  "Google Search",
  "Google Business Profile",
  "Realtor Referral",
  "Past Client Referral",
  "Facebook",
  "Instagram",
  "Website",
  "Direct Outreach",
  "Golf Course Relationship",
  "Builder / Developer",
  "Other",
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export function isReferralSource(value: string | null | undefined): value is ReferralSource {
  return Boolean(value && REFERRAL_SOURCES.includes(value as ReferralSource));
}
