/**
 * Client-side settings search index for the admin command palette.
 * Synonyms + individual field anchors — not just section labels.
 * Message bodies are intentionally NOT searchable (see admin-search.ts).
 */

import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings-nav";

export type SettingsSearchEntry = {
  id: string;
  sectionId: SettingsSectionId;
  label: string;
  description: string;
  href: string;
  keywords: string[];
};

/** Explicit synonym / field map layered on SETTINGS_SECTIONS. */
const FIELD_ENTRIES: Omit<SettingsSearchEntry, "href">[] = [
  {
    id: "custom_domain",
    sectionId: "custom_domain",
    label: "Use your own web address",
    description: "Connect portal.yourstudio.com for your client portal.",
    keywords: [
      "domain",
      "url",
      "website",
      "subdomain",
      "custom domain",
      "cname",
      "dns",
      "hostname",
      "web address",
    ],
  },
  {
    id: "payments",
    sectionId: "payments",
    label: "Payments",
    description: "Connect Stripe so clients pay you directly.",
    keywords: ["stripe", "payment", "payout", "invoice", "checkout", "connect", "billing"],
  },
  {
    id: "email",
    sectionId: "email",
    label: "Email Sender",
    description: "Sender identity, Resend domain, and diagnostics.",
    keywords: ["email", "sender", "from", "smtp", "reply", "resend", "mail"],
  },
  {
    id: "reply-to",
    sectionId: "email",
    label: "Reply-to email",
    description: "Where client replies to portal emails go.",
    keywords: ["reply-to", "reply to", "replyto", "reply"],
  },
  {
    id: "from-name",
    sectionId: "email",
    label: "Default from name",
    description: "Display name on outbound client emails.",
    keywords: ["from name", "from", "sender name"],
  },
  {
    id: "branding",
    sectionId: "branding",
    label: "Branding & Colors",
    description: "Logo, favicon, and brand colors.",
    keywords: ["logo", "colors", "brand", "favicon", "branding", "accent", "theme"],
  },
  {
    id: "logo",
    sectionId: "branding",
    label: "Logo",
    description: "Upload your studio logo.",
    keywords: ["logo", "mark", "wordmark"],
  },
  {
    id: "colors",
    sectionId: "branding",
    label: "Brand colors",
    description: "Primary and accent colors for the portal.",
    keywords: ["colors", "colour", "primary", "accent", "palette"],
  },
  {
    id: "notifications",
    sectionId: "notifications",
    label: "Notifications",
    description: "In-app, email, and push channels per event.",
    keywords: ["notification", "alerts", "reminders", "push", "email alerts"],
  },
  {
    id: "landing",
    sectionId: "landing",
    label: "Client Landing Page",
    description: "Hero copy, industries, how-it-works, and social.",
    keywords: [
      "landing",
      "landing page",
      "homepage",
      "public page",
      "hero",
      "home page",
      "marketing",
      "client landing",
    ],
  },
  {
    id: "services",
    sectionId: "services",
    label: "Services",
    description: "Catalog and preliminary estimate prices.",
    keywords: ["services", "pricing", "rates", "packages", "catalog", "estimate"],
  },
  {
    id: "workflow",
    sectionId: "workflow",
    label: "Workflow Automation",
    description: "Stage actions, reminders, and proposal defaults.",
    keywords: ["automation", "workflow", "follow-up", "follow up", "reminders", "stages"],
  },
  {
    id: "identity",
    sectionId: "identity",
    label: "Business Identity",
    description: "Name, portal title, legal copy, and public links.",
    keywords: ["business name", "portal name", "identity", "legal", "tagline"],
  },
  {
    id: "admin-display",
    sectionId: "identity",
    label: "Admin display name",
    description: "How your name appears to clients.",
    keywords: ["team", "users", "admins", "admin", "display name", "staff"],
  },
  {
    id: "contact",
    sectionId: "contact",
    label: "Contact Information",
    description: "Email, phone, website, and mailing address.",
    keywords: ["contact", "phone", "address", "support email", "website"],
  },
  {
    id: "integrations",
    sectionId: "integrations",
    label: "Integrations",
    description: "GoHighLevel.",
    keywords: ["integrations", "ghl", "gohighlevel"],
  },
  {
    id: "automated_emails",
    sectionId: "automated_emails",
    label: "Automated Emails",
    description: "Subject and body for client-facing workflow emails.",
    keywords: ["templates", "automated emails", "email copy", "subjects"],
  },
];

const HASH_BY_ENTRY: Record<string, string> = {
  custom_domain: "settings-custom-domain",
  payments: "settings-payments",
  email: "settings-email",
  "reply-to": "settings-reply-to",
  "from-name": "settings-from-name",
  branding: "settings-colors",
  logo: "settings-logo",
  colors: "settings-colors",
  notifications: "settings-notifications",
  landing: "settings-landing",
  services: "settings-services",
  workflow: "settings-workflow",
  identity: "settings-business",
  "admin-display": "settings-business-name",
  contact: "settings-contact",
  integrations: "settings-integrations",
  automated_emails: "settings-automated-emails",
};

function buildIndex(): SettingsSearchEntry[] {
  const byId = new Map<string, SettingsSearchEntry>();

  for (const section of SETTINGS_SECTIONS) {
    const hash = section.hashes[0] ?? `settings-${section.id}`;
    byId.set(section.id, {
      id: section.id,
      sectionId: section.id,
      label: section.label,
      description: section.description,
      href: `/admin/settings#${hash}`,
      keywords: [section.label, section.description, section.id.replace(/_/g, " ")],
    });
  }

  for (const field of FIELD_ENTRIES) {
    const hash = HASH_BY_ENTRY[field.id] ?? `settings-${field.sectionId}`;
    const existing = byId.get(field.id);
    if (existing) {
      existing.keywords = [...new Set([...existing.keywords, ...field.keywords])];
      existing.label = field.label || existing.label;
      existing.description = field.description || existing.description;
      existing.href = `/admin/settings#${hash}`;
    } else {
      byId.set(field.id, {
        ...field,
        href: `/admin/settings#${hash}`,
      });
    }
  }

  return [...byId.values()];
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = buildIndex();

function scoreSettingsHit(query: string, entry: SettingsSearchEntry): number {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return 0;
  const label = entry.label.toLowerCase();
  const desc = entry.description.toLowerCase();
  const keys = entry.keywords.map((k) => k.toLowerCase());

  if (label === q || keys.some((k) => k === q)) return 300;
  if (label.startsWith(q) || keys.some((k) => k.startsWith(q))) return 200;
  if (label.includes(q) || desc.includes(q) || keys.some((k) => k.includes(q))) return 100;
  // multi-word: every token hits somewhere
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => label.includes(t) || keys.some((k) => k.includes(t)))) {
    return 80;
  }
  return 0;
}

export function searchSettingsIndex(query: string, limit = 10): SettingsSearchEntry[] {
  const scored = SETTINGS_SEARCH_INDEX.map((entry) => ({
    entry,
    score: scoreSettingsHit(query, entry),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
  return scored.slice(0, limit).map((r) => r.entry);
}
