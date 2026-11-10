export const SETTINGS_SECTION_IDS = [
  "identity",
  "branding",
  "landing",
  "contact",
  "email",
  "custom_domain",
  "marketing_kit",
  "automated_emails",
  "new_project_setup",
  "payments",
  "services",
  "workflow",
  "notifications",
  "integrations",
  "tax",
  "staff",
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
    label: "Business Website",
    description: "Your public website: template, homepage, portfolio, contact and booking.",
    hashes: ["settings-website", "settings-landing"],
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
    hashes: ["settings-email", "settings-reply-to", "settings-from-name"],
  },
  {
    id: "custom_domain",
    label: "Use your own web address",
    description:
      "Your business website (www.yourstudio.com), client portal (portal.yourstudio.com) and property website (listings.yourstudio.com) addresses.",
    hashes: ["settings-custom-domain", "settings-website-domain", "settings-listing-domain"],
  },
  {
    id: "marketing_kit",
    label: "Marketing Kit",
    description: "Property websites and social media kits: included or paid, prices, client permissions.",
    hashes: ["settings-marketing-kit"],
  },
  {
    id: "automated_emails",
    label: "Automated Emails",
    description: "Subject and body for client-facing workflow emails.",
    hashes: ["settings-automated-emails"],
  },
  {
    id: "new_project_setup",
    label: "New project setup",
    description: "Defaults applied when a new project is created.",
    hashes: ["settings-media-section-defaults", "settings-new-project-setup"],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Connect Stripe so clients pay you directly.",
    hashes: ["settings-payments", "settings-bank-payments", "settings-card-fee", "settings-download-gate"],
  },
  {
    id: "services",
    label: "Services",
    description: "Catalog, request-form estimate toggle, and preliminary estimate prices.",
    hashes: [
      "settings-services",
      "settings-instant-preliminary",
      "settings-service-catalog",
      "settings-travel-fees",
    ],
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
    description: "GoHighLevel.",
    hashes: ["settings-integrations"],
  },
  {
    id: "tax",
    label: "Tax information",
    description: "Form W-9 identity fields. The taxpayer identification number is not saved.",
    hashes: ["settings-tax"],
  },
  {
    id: "staff",
    label: "Staff & Permissions",
    description: "Invite teammates and set what each staff member can do.",
    hashes: ["settings-staff", "settings-staff-permissions"],
  },
];

export function visibleSettingsSections(includeTax: boolean): SettingsSection[] {
  return includeTax ? SETTINGS_SECTIONS : SETTINGS_SECTIONS.filter((section) => section.id !== "tax");
}

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
