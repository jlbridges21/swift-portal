export const SETTINGS_SECTION_IDS = [
  "identity",
  "branding",
  "landing",
  "contact",
  "email",
  "custom_domain",
  "automated_emails",
  "payments",
  "services",
  "workflow",
  "notifications",
  "integrations",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  hashes: string[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "identity",
    label: "Business Identity",
    description: "Name, portal title, legal copy, and public links.",
    hashes: ["settings-business-name", "settings-business"],
  },
  {
    id: "branding",
    label: "Branding & Colors",
    description: "Logo, favicon, and brand colors used across the portal.",
    hashes: ["settings-logo", "settings-colors", "settings-favicon", "settings-email-logo"],
  },
  {
    id: "landing",
    label: "Client Landing Page",
    description: "Hero copy, industries, how-it-works, and social for your public portal.",
    hashes: ["settings-landing"],
  },
  {
    id: "contact",
    label: "Contact Information",
    description: "Email, phone, website, and mailing address.",
    hashes: ["settings-contact"],
  },
  {
    id: "email",
    label: "Email Sender",
    description: "Sender identity, Resend domain, and diagnostics.",
    hashes: ["settings-email"],
  },
  {
    id: "custom_domain",
    label: "Custom Domain",
    description: "Connect portal.yourstudio.com for your client portal.",
    hashes: ["settings-custom-domain"],
  },
  {
    id: "automated_emails",
    label: "Automated Emails",
    description: "Subject and body for client-facing workflow emails.",
    hashes: ["settings-automated-emails"],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Connect Stripe so clients pay you directly.",
    hashes: ["settings-payments"],
  },
  {
    id: "services",
    label: "Services",
    description: "Catalog and preliminary estimate prices.",
    hashes: ["settings-services"],
  },
  {
    id: "workflow",
    label: "Workflow Automation",
    description: "Stage actions, reminders, and proposal defaults.",
    hashes: ["settings-workflow"],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "In-app, email, and push channels per event.",
    hashes: ["settings-notifications"],
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Google Calendar and GoHighLevel.",
    hashes: ["settings-integrations"],
  },
];

export function sectionForHash(hash: string): SettingsSectionId | null {
  const normalized = hash.replace(/^#/, "").trim();
  if (!normalized) return null;
  for (const section of SETTINGS_SECTIONS) {
    if (section.hashes.some((h) => normalized === h || normalized.startsWith(`${h}-`))) {
      return section.id;
    }
  }
  return null;
}
