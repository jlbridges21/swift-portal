/**
 * Navigation map for the super-admin Platform Console (/platform).
 *
 *   Left sidebar  → CONSOLE_GROUPS (primary sections)
 *   Top bar       → the active section's tabs (secondary navigation)
 *
 * Pure data + pathname matching, so it can be unit-checked without a browser. Routes are the
 * existing ones; nothing here adds or renames a page.
 */

import {
  PLATFORM_PARTNERS_SECTIONS,
  PLATFORM_PARTNER_DETAIL_SECTIONS,
  platformPartnerDetailHref,
} from "@/lib/platform-partners-nav";

export type ConsoleIcon =
  | "dashboard"
  | "new-business"
  | "revenue"
  | "economics"
  | "plans"
  | "analytics"
  | "partners"
  | "lifecycle"
  | "w9"
  | "audit";

export type ConsoleSection = {
  id: string;
  label: string;
  href: string;
  icon: ConsoleIcon;
  /** Does this pathname belong to the section? */
  match: (pathname: string) => boolean;
};

export type ConsoleGroup = { label: string; sections: ConsoleSection[] };

const under = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

export const CONSOLE_GROUPS: ConsoleGroup[] = [
  {
    label: "Overview",
    sections: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/platform",
        icon: "dashboard",
        // Business detail pages are opened from the dashboard table.
        match: (p) => p === "/platform" || (under("/platform/businesses")(p) && !under("/platform/businesses/new")(p)),
      },
      { id: "new-business", label: "New business", href: "/platform/businesses/new", icon: "new-business", match: under("/platform/businesses/new") },
    ],
  },
  {
    label: "Revenue & pricing",
    sections: [
      { id: "revenue", label: "Revenue", href: "/platform/revenue/subscriptions", icon: "revenue", match: under("/platform/revenue") },
      { id: "economics", label: "Economics", href: "/platform/economics", icon: "economics", match: under("/platform/economics") },
      { id: "plans", label: "Plans", href: "/platform/plans", icon: "plans", match: under("/platform/plans") },
    ],
  },
  {
    label: "Growth",
    sections: [
      { id: "analytics", label: "Analytics", href: "/platform/analytics", icon: "analytics", match: under("/platform/analytics") },
      { id: "partners", label: "Partners", href: "/platform/partners", icon: "partners", match: under("/platform/partners") },
      { id: "lifecycle-emails", label: "Lifecycle emails", href: "/platform/lifecycle-emails", icon: "lifecycle", match: under("/platform/lifecycle-emails") },
    ],
  },
  {
    label: "Administration",
    sections: [
      { id: "w9", label: "W-9 form", href: "/platform/w9", icon: "w9", match: under("/platform/w9") },
      { id: "audit", label: "Audit log", href: "/platform/audit", icon: "audit", match: under("/platform/audit") },
    ],
  },
];

export const CONSOLE_SECTIONS: ConsoleSection[] = CONSOLE_GROUPS.flatMap((g) => g.sections);

export function activeConsoleSection(pathname: string): ConsoleSection | null {
  return CONSOLE_SECTIONS.find((s) => s.match(pathname)) ?? null;
}

/**
 * A top-bar tab.
 *   kind "route" → a real page; `preserveQuery` keys are carried over (e.g. analytics range).
 *   kind "hash"  → an in-page section selected by location.hash (partners program page).
 */
export type ConsoleTab =
  | { kind: "route"; href: string; label: string; exact?: boolean; preserveQuery?: string[] }
  | { kind: "hash"; hash: string; label: string; isDefault?: boolean };

export type ConsoleTabs = {
  ariaLabel: string;
  tabs: ConsoleTab[];
  /** Short context shown before the tabs (e.g. "Partner"), when the page is a sub-entity. */
  context?: string;
};

const ANALYTICS_RANGE = ["range", "from", "to"];

const ECONOMICS_TABS: ConsoleTab[] = [
  { kind: "route", href: "/platform/economics", label: "Overview", exact: true },
  { kind: "route", href: "/platform/economics/storage", label: "Storage & Bandwidth" },
  { kind: "route", href: "/platform/economics/businesses", label: "Business Economics" },
  { kind: "route", href: "/platform/economics/simulator", label: "Pricing Simulator" },
  { kind: "route", href: "/platform/economics/costs", label: "Costs & Assumptions" },
];

const ANALYTICS_TABS: ConsoleTab[] = [
  { kind: "route", href: "/platform/analytics", label: "Overview", exact: true, preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/acquisition", label: "Acquisition", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/blog", label: "Blog", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/accounts", label: "Accounts", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/conversions", label: "Conversions", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/seo", label: "SEO", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/definitions", label: "Definitions", preserveQuery: ANALYTICS_RANGE },
  { kind: "route", href: "/platform/analytics/diagnostics", label: "Diagnostics", preserveQuery: ANALYTICS_RANGE },
];

const REVENUE_TABS: ConsoleTab[] = [
  { kind: "route", href: "/platform/revenue/subscriptions", label: "Subscriptions" },
  { kind: "route", href: "/platform/revenue/client-payments", label: "Client payments" },
];

const PARTNERS_PROGRAM_TABS: ConsoleTab[] = PLATFORM_PARTNERS_SECTIONS.map((s, i) => ({
  kind: "hash",
  hash: s.hashes[0],
  label: s.label,
  isDefault: i === 0,
}));

/** /platform/partners/{id}/… → partner id, else null. */
export function partnerIdFromPathname(pathname: string): string | null {
  const m = /^\/platform\/partners\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

export function consoleTabsFor(pathname: string): ConsoleTabs | null {
  if (under("/platform/economics")(pathname)) return { ariaLabel: "Platform economics sections", tabs: ECONOMICS_TABS };
  if (under("/platform/analytics")(pathname)) return { ariaLabel: "Analytics sections", tabs: ANALYTICS_TABS };
  if (under("/platform/revenue")(pathname)) return { ariaLabel: "Revenue sections", tabs: REVENUE_TABS };
  if (pathname === "/platform/partners") return { ariaLabel: "Partner program sections", tabs: PARTNERS_PROGRAM_TABS };
  const partnerId = partnerIdFromPathname(pathname);
  if (partnerId) {
    return {
      ariaLabel: "Partner detail sections",
      context: "Partner",
      tabs: PLATFORM_PARTNER_DETAIL_SECTIONS.map((s) => ({
        kind: "route",
        href: platformPartnerDetailHref(partnerId, s.id),
        label: s.label,
        exact: s.segment === "",
      })),
    };
  }
  return null;
}

export function routeTabActive(tab: Extract<ConsoleTab, { kind: "route" }>, pathname: string): boolean {
  return tab.exact ? pathname === tab.href : under(tab.href)(pathname);
}

/** Cookie that remembers the collapsed sidebar, read server-side to avoid a layout flash. */
export const CONSOLE_SIDEBAR_COOKIE = "platform_sidebar";
