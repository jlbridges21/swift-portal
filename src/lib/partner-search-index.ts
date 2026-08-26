/**
 * Client-side partner destination index for the admin command palette.
 * Destinations only — not tenant records. Capability-gated at search time;
 * route guards remain the security boundary.
 */

import { PARTNER_NAV_SECTIONS } from "@/lib/partner-nav";

export type PartnerSearchEntry = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
};

/** How partner results should appear for the current identity. */
export type PartnerSearchMode = "active" | "pitch" | "none";

const COMMON_KEYWORDS = [
  "partner",
  "partners",
  "affiliate",
  "partner program",
  "promote",
] as const;

const SECTION_META: Record<
  string,
  { description: string; keywords: string[] }
> = {
  overview: {
    description: "Partner dashboard — earnings summary and quick links.",
    keywords: ["overview", "dashboard", "home", "summary", "earnings"],
  },
  referrals: {
    description: "Your referral code, share links, and attributed signups.",
    keywords: [
      "referrals",
      "referral",
      "refer",
      "referral code",
      "referral link",
      "share",
      "invite",
      "attributed",
    ],
  },
  commissions: {
    description: "Commission ledger and earnings history.",
    keywords: ["commissions", "commission", "earnings", "ledger", "revenue share"],
  },
  payouts: {
    description: "Partner payout history and status.",
    keywords: ["payouts", "payout", "paid out", "transfer", "partner payout"],
  },
  landing: {
    description: "Your co-branded ShootPortal landing page at /your-slug.",
    keywords: [
      "landing",
      "landing page",
      "co-branded",
      "public page",
      "slug",
      "referral link",
    ],
  },
  "payout-details": {
    description: "Where ShootPortal sends your partner payouts.",
    keywords: [
      "payout details",
      "payout",
      "bank",
      "payment method",
      "direct deposit",
    ],
  },
};

const ACTIVE_ENTRIES: PartnerSearchEntry[] = PARTNER_NAV_SECTIONS.map((section) => {
  const meta = SECTION_META[section.id] ?? {
    description: section.label,
    keywords: [] as string[],
  };
  return {
    id: section.id,
    label: section.label,
    description: meta.description,
    href: section.href,
    keywords: [...COMMON_KEYWORDS, section.label, ...meta.keywords],
  };
});

/** Single pitch entry for non-partners and suspended partners (no deep links). */
export const PARTNER_PROGRAM_PITCH_ENTRY: PartnerSearchEntry = {
  id: "partner-program",
  label: "Partner Program",
  description: "Earn commission by referring studios to ShootPortal.",
  href: "/partner",
  keywords: [
    ...COMMON_KEYWORDS,
    "apply",
    "join",
    "program",
    "referral",
    "refer",
    "commission",
    "earnings",
    "payout",
    "landing page",
    "referral link",
  ],
};

export function resolvePartnerSearchMode(input: {
  showPartner: boolean;
  partnerActive: boolean;
}): PartnerSearchMode {
  if (!input.showPartner) return "none";
  if (input.partnerActive) return "active";
  // Non-partner business admin OR suspended partner → pitch only (no deep links).
  return "pitch";
}

function scorePartnerHit(query: string, entry: PartnerSearchEntry): number {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return 0;
  const label = entry.label.toLowerCase();
  const desc = entry.description.toLowerCase();
  const keys = entry.keywords.map((k) => k.toLowerCase());

  if (label === q || keys.some((k) => k === q)) return 300;
  if (label.startsWith(q) || keys.some((k) => k.startsWith(q))) return 200;
  if (label.includes(q) || desc.includes(q) || keys.some((k) => k.includes(q))) return 100;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => label.includes(t) || keys.some((k) => k.includes(t)))) {
    return 80;
  }
  return 0;
}

export function searchPartnerIndex(
  query: string,
  mode: PartnerSearchMode,
  limit = 10
): PartnerSearchEntry[] {
  if (mode === "none") return [];
  const pool = mode === "active" ? ACTIVE_ENTRIES : [PARTNER_PROGRAM_PITCH_ENTRY];
  const scored = pool
    .map((entry) => ({ entry, score: scorePartnerHit(query, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
  return scored.slice(0, limit).map((r) => r.entry);
}
