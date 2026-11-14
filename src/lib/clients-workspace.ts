/**
 * New interface Clients page — pure rules shared by the server loader and the client UI.
 * No server imports here (this file ships to the browser).
 */

/**
 * Mirrors INVITE_ACTIVATION_TTL_MS in portal-activation.ts (not imported: that module pulls in
 * the token cipher, which must stay out of the browser bundle).
 */
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Portal status ────────────────────────────────────────────────────────────

/**
 * Same facts as derivePortalAccessState (portal-activation.ts), split further for the list:
 *  - active          linked login with a confirmed email (same business)
 *  - invite_sent     an invite was emailed and its 7-day link is still valid
 *  - invite_expired  the newest invite's link has expired and the client never activated
 *  - not_invited     no invite on record and no active login
 *  - unavailable     the email's login belongs to another business — can't invite here
 */
export type ClientPortalStatus = "active" | "invite_sent" | "invite_expired" | "not_invited" | "unavailable";

/** Tabs group the five states into the four the business thinks in. */
export type ClientStatusTab = "all" | "active" | "invited" | "not_invited";

export const CLIENT_STATUS_TABS: { value: ClientStatusTab; label: string }[] = [
  { value: "all", label: "All Clients" },
  { value: "active", label: "Portal Active" },
  { value: "invited", label: "Invite Sent" },
  { value: "not_invited", label: "Not Invited" },
];

export function tabOfStatus(status: ClientPortalStatus): Exclude<ClientStatusTab, "all"> {
  if (status === "active") return "active";
  if (status === "invite_sent" || status === "invite_expired") return "invited";
  return "not_invited";
}

export const PORTAL_STATUS_LABEL: Record<ClientPortalStatus, string> = {
  active: "Active",
  invite_sent: "Invite Sent",
  invite_expired: "Invite Expired",
  not_invited: "Not Invited",
  unavailable: "Unavailable",
};

export function deriveClientPortalStatus(facts: {
  hasEmail: boolean;
  foreign: boolean;
  emailConfirmedAt: string | null;
  lastInviteSentAt: string | null;
  now?: number;
}): ClientPortalStatus {
  if (facts.foreign) return "unavailable";
  if (facts.emailConfirmedAt) return "active";
  if (facts.lastInviteSentAt) {
    const age = (facts.now ?? Date.now()) - new Date(facts.lastInviteSentAt).getTime();
    return age > INVITE_LINK_TTL_MS ? "invite_expired" : "invite_sent";
  }
  return "not_invited";
}

/** Can the owner email a (new) invite to this client? */
export function canInvite(c: { portal_status: ClientPortalStatus; email: string }): boolean {
  return Boolean(c.email?.trim()) && (c.portal_status === "not_invited" || c.portal_status === "invite_expired");
}

/** Can the owner resend a pending/expired invite? */
export function canResend(c: { portal_status: ClientPortalStatus; email: string }): boolean {
  return Boolean(c.email?.trim()) && (c.portal_status === "invite_sent" || c.portal_status === "invite_expired");
}

// ── Row shape the page receives ──────────────────────────────────────────────

export interface ClientWorkspaceRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  referral_source: string | null;
  created_at: string;
  /** Newest of tracked client activity and portal sign-in — never an invite being sent. */
  last_seen_at: string | null;
  total_projects: number;
  active_projects: number;
  /** Cents. 0 when the viewer can't see money. */
  lifetime_revenue: number;
  outstanding_balance: number;
  portal_status: ClientPortalStatus;
  invite_sent_at: string | null;
  activated_at: string | null;
  deleted_at: string | null;
}

// ── Filters & sort ───────────────────────────────────────────────────────────

export type ClientsSort =
  | "name_asc"
  | "name_desc"
  | "activity_desc"
  | "activity_asc"
  | "created_desc"
  | "created_asc"
  | "projects_desc"
  | "revenue_desc";

export const CLIENTS_SORT_OPTIONS: { value: ClientsSort; label: string; money?: boolean }[] = [
  { value: "activity_desc", label: "Last Activity" },
  { value: "activity_asc", label: "Oldest Activity" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "created_desc", label: "Newest Client" },
  { value: "created_asc", label: "Oldest Client" },
  { value: "projects_desc", label: "Most Projects" },
  { value: "revenue_desc", label: "Highest Lifetime Revenue", money: true },
];

export function isClientsSort(v: unknown): v is ClientsSort {
  return typeof v === "string" && CLIENTS_SORT_OPTIONS.some((o) => o.value === v);
}

export type ProjectsFilter = "any" | "with" | "without";
export type ActivityFilter = "any" | "7d" | "30d" | "90d" | "stale" | "never";

export const ACTIVITY_FILTER_OPTIONS: { value: Exclude<ActivityFilter, "any">; label: string }[] = [
  { value: "7d", label: "Active in last 7 days" },
  { value: "30d", label: "Active in last 30 days" },
  { value: "90d", label: "Active in last 90 days" },
  { value: "stale", label: "No activity in 90+ days" },
  { value: "never", label: "No activity yet" },
];

export interface ClientsFilters {
  search: string;
  companies: string[];
  statuses: ClientPortalStatus[];
  referrals: string[];
  projects: ProjectsFilter;
  activity: ActivityFilter;
  outstandingOnly: boolean;
}

export const EMPTY_CLIENT_FILTERS: ClientsFilters = {
  search: "",
  companies: [],
  statuses: [],
  referrals: [],
  projects: "any",
  activity: "any",
  outstandingOnly: false,
};

/** Value used in the Company filter for clients with no company. */
export const NO_COMPANY = "__none__";

const DAY = 24 * 60 * 60 * 1000;

export function matchesSearch(c: ClientWorkspaceRow, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return (
    c.name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    (c.company?.toLowerCase().includes(q) ?? false) ||
    (c.referral_source?.toLowerCase().includes(q) ?? false) ||
    (c.phone?.toLowerCase().includes(q) ?? false) ||
    (digits.length >= 3 && (c.phone?.replace(/\D/g, "").includes(digits) ?? false))
  );
}

/** Everything except the status tab (tab counts are computed on this result). */
export function filterClients(rows: ClientWorkspaceRow[], f: ClientsFilters, now = Date.now()): ClientWorkspaceRow[] {
  return rows.filter((c) => {
    if (!matchesSearch(c, f.search)) return false;
    if (f.companies.length) {
      const key = c.company?.trim() ? c.company.trim() : NO_COMPANY;
      if (!f.companies.includes(key)) return false;
    }
    if (f.statuses.length && !f.statuses.includes(c.portal_status)) return false;
    if (f.referrals.length && !(c.referral_source && f.referrals.includes(c.referral_source))) return false;
    if (f.projects === "with" && c.total_projects === 0) return false;
    if (f.projects === "without" && c.total_projects > 0) return false;
    if (f.outstandingOnly && c.outstanding_balance <= 0) return false;
    if (f.activity !== "any") {
      const t = c.last_seen_at ? new Date(c.last_seen_at).getTime() : null;
      if (f.activity === "never") return t === null;
      if (f.activity === "stale") return t === null || now - t > 90 * DAY;
      if (t === null) return false;
      const days = f.activity === "7d" ? 7 : f.activity === "30d" ? 30 : 90;
      if (now - t > days * DAY) return false;
    }
    return true;
  });
}

export function filterByTab(rows: ClientWorkspaceRow[], tab: ClientStatusTab): ClientWorkspaceRow[] {
  return tab === "all" ? rows : rows.filter((c) => tabOfStatus(c.portal_status) === tab);
}

export function countTabs(rows: ClientWorkspaceRow[]): Record<ClientStatusTab, number> {
  const counts: Record<ClientStatusTab, number> = { all: rows.length, active: 0, invited: 0, not_invited: 0 };
  for (const c of rows) counts[tabOfStatus(c.portal_status)]++;
  return counts;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export function sortClients(rows: ClientWorkspaceRow[], sort: ClientsSort): ClientWorkspaceRow[] {
  const byName = (a: ClientWorkspaceRow, b: ClientWorkspaceRow) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  // Clients with no activity sink to the bottom in both activity orders.
  const byActivity = (dir: 1 | -1) => (a: ClientWorkspaceRow, b: ClientWorkspaceRow) => {
    const ta = time(a.last_seen_at);
    const tb = time(b.last_seen_at);
    if (ta === tb) return byName(a, b);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return (ta - tb) * dir;
  };
  const list = [...rows];
  switch (sort) {
    case "name_asc":
      return list.sort(byName);
    case "name_desc":
      return list.sort((a, b) => byName(b, a));
    case "activity_desc":
      return list.sort(byActivity(-1));
    case "activity_asc":
      return list.sort(byActivity(1));
    case "created_desc":
      return list.sort((a, b) => (time(b.created_at) ?? 0) - (time(a.created_at) ?? 0));
    case "created_asc":
      return list.sort((a, b) => (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0));
    case "projects_desc":
      return list.sort((a, b) => b.total_projects - a.total_projects || byName(a, b));
    case "revenue_desc":
      return list.sort((a, b) => b.lifetime_revenue - a.lifetime_revenue || byName(a, b));
  }
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function clientInitials(name: string, email?: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || (email?.[0]?.toUpperCase() ?? "?");
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "Just now", "2h ago", "Yesterday", "3 days ago", then "Nov 12, 2026". */
export function formatLastSeen(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = now - t;
  if (diff < 0) return shortDate.format(new Date(t));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const yesterday = startOfToday.getTime() - DAY;
  if (t >= yesterday) return "Yesterday";
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days} days ago`;
  return shortDate.format(new Date(t));
}

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : shortDate.format(d);
}

// ── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function clientsToCsv(rows: ClientWorkspaceRow[], opts: { includeMoney: boolean }): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Company",
    "Referral Source",
    "Portal Status",
    "Last Activity",
    "Projects",
    "Active Projects",
    ...(opts.includeMoney ? ["Lifetime Revenue", "Outstanding Balance"] : []),
    "Client Since",
  ];
  const lines = rows.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.company,
      c.referral_source,
      PORTAL_STATUS_LABEL[c.portal_status],
      c.last_seen_at ? new Date(c.last_seen_at).toISOString() : "",
      c.total_projects,
      c.active_projects,
      ...(opts.includeMoney
        ? [(c.lifetime_revenue / 100).toFixed(2), (c.outstanding_balance / 100).toFixed(2)]
        : []),
      new Date(c.created_at).toISOString().slice(0, 10),
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface ImportClientInput {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  referral_source: string | null;
  notes: string | null;
}

export const IMPORT_MAX_ROWS = 500;

const HEADER_ALIASES: Record<keyof ImportClientInput, string[]> = {
  name: ["name", "full name", "fullname", "client", "client name", "contact", "contact name"],
  email: ["email", "email address", "e-mail", "mail"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "tel"],
  company: ["company", "company name", "business", "organization", "organisation", "brokerage"],
  referral_source: ["referral", "referral source", "source", "lead source", "how did you hear"],
  notes: ["notes", "note", "comments", "comment"],
};

const FIRST_NAME = ["first name", "firstname", "first", "given name"];
const LAST_NAME = ["last name", "lastname", "last", "surname", "family name"];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportPreviewRow = {
  line: number;
  input: ImportClientInput;
  problem: string | null;
};

/** Map a parsed CSV (first row = headers) to client inputs with per-row validation. */
export function mapImportRows(
  table: string[][]
): { rows: ImportPreviewRow[]; missingColumns: string[]; unknownHeaders: string[] } {
  if (!table.length) return { rows: [], missingColumns: ["Name", "Email"], unknownHeaders: [] };
  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ").trim());
  const find = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
  const idx = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as (keyof ImportClientInput)[]).map((k) => [k, find(HEADER_ALIASES[k])])
  ) as Record<keyof ImportClientInput, number>;
  const first = find(FIRST_NAME);
  const last = find(LAST_NAME);

  const missingColumns: string[] = [];
  if (idx.name < 0 && first < 0) missingColumns.push("Name");
  if (idx.email < 0) missingColumns.push("Email");

  const known = new Set(
    [...Object.values(idx), first, last].filter((i) => i >= 0)
  );
  const unknownHeaders = table[0].filter((h, i) => h.trim() && !known.has(i));

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const seen = new Set<string>();
  const rows = table.slice(1).map((r, i): ImportPreviewRow => {
    const name =
      cell(r, idx.name) || [cell(r, first), cell(r, last)].filter(Boolean).join(" ");
    const email = cell(r, idx.email).toLowerCase();
    const input: ImportClientInput = {
      name: name.slice(0, 200),
      email: email.slice(0, 320),
      phone: cell(r, idx.phone).slice(0, 50) || null,
      company: cell(r, idx.company).slice(0, 200) || null,
      referral_source: cell(r, idx.referral_source).slice(0, 120) || null,
      notes: cell(r, idx.notes).slice(0, 2000) || null,
    };
    let problem: string | null = null;
    if (!input.name) problem = "Missing name";
    else if (!input.email) problem = "Missing email";
    else if (!EMAIL_RE.test(input.email)) problem = "Invalid email";
    else if (seen.has(input.email)) problem = "Duplicate email in this file";
    if (!problem) seen.add(input.email);
    return { line: i + 2, input, problem };
  });
  return { rows, missingColumns, unknownHeaders };
}
