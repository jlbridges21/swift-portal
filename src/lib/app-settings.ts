import { createServiceClient } from "@/lib/supabase/server";
import { BRAND, LOGO_URL } from "@/lib/brand";
import { getPortalBrandFromSettings, SWIFT_BUSINESS_DEFAULTS } from "@/lib/portal-brand";

export type NotificationEventKey =
  | "new_project_request"
  | "preliminary_estimate_created"
  | "official_proposal_sent"
  | "proposal_approved"
  | "proposal_changes_requested"
  | "shoot_time_proposed"
  | "shoot_time_confirmed"
  | "shoot_time_declined"
  | "shoot_scheduled"
  | "shoot_rescheduled"
  | "shoot_completed"
  | "deliverables_ready"
  | "revision_requested"
  | "revision_completed"
  | "payment_link_sent"
  | "payment_received"
  | "payment_failed"
  | "project_delivered";

export interface NotificationChannelSettings {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface EmailSettings {
  fromName: string;
  senderEmail: string;
  replyTo: string;
  footerText: string;
}

export interface BusinessSettings {
  businessName: string;
  portalName: string;
  adminDisplayName: string;
  primaryContactEmail: string;
  phoneNumber: string;
  websiteUrl: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
}

export interface ProposalSettings {
  autoPreliminaryEstimate: boolean;
  requireAdminReviewBeforeOfficial: boolean;
  showPreliminaryToClients: boolean;
  defaultEstimateExpirationDays: number;
  defaultProposalExpirationDays: number;
  allowClientProposalChanges: boolean;
}

export interface AppSettings {
  notifications: Record<NotificationEventKey, NotificationChannelSettings>;
  email: EmailSettings;
  business: BusinessSettings;
  proposals: ProposalSettings;
}

export const NOTIFICATION_EVENT_DEFINITIONS: {
  key: NotificationEventKey;
  label: string;
  description: string;
  audience: "admin" | "client" | "both";
}[] = [
  { key: "new_project_request", label: "New project request submitted", description: "Notifies admins when a client submits a new project.", audience: "admin" },
  { key: "preliminary_estimate_created", label: "Preliminary estimate created", description: "Notifies clients when an automatic preliminary estimate is ready.", audience: "client" },
  { key: "official_proposal_sent", label: "Official proposal sent", description: "Notifies clients when an official proposal is sent.", audience: "client" },
  { key: "proposal_approved", label: "Proposal approved", description: "Notifies admins when a client approves a proposal.", audience: "admin" },
  { key: "proposal_changes_requested", label: "Proposal changes requested", description: "Notifies admins when a client requests proposal changes.", audience: "admin" },
  { key: "shoot_time_proposed", label: "Shoot time proposed", description: "Shoot scheduling proposals and counter-proposals.", audience: "both" },
  { key: "shoot_time_confirmed", label: "Shoot time confirmed", description: "When a shoot date is confirmed.", audience: "both" },
  { key: "shoot_time_declined", label: "Shoot time declined", description: "When a proposed shoot time is declined.", audience: "both" },
  { key: "shoot_scheduled", label: "Shoot scheduled", description: "Project moves to scheduled status.", audience: "client" },
  { key: "shoot_rescheduled", label: "Shoot rescheduled", description: "When a shoot is moved to a new date.", audience: "both" },
  { key: "shoot_completed", label: "Shoot completed", description: "When field work is marked complete.", audience: "client" },
  { key: "deliverables_ready", label: "Deliverables ready for review", description: "When media is ready for client review.", audience: "client" },
  { key: "revision_requested", label: "Revision requested", description: "Notifies admins of a new revision request.", audience: "admin" },
  { key: "revision_completed", label: "Revision completed", description: "Notifies clients when a revision is completed.", audience: "client" },
  { key: "payment_link_sent", label: "Payment link sent", description: "When an invoice or payment link is sent.", audience: "client" },
  { key: "payment_received", label: "Payment received", description: "When a payment is successfully received.", audience: "admin" },
  { key: "payment_failed", label: "Payment failed", description: "When a payment attempt fails.", audience: "admin" },
  { key: "project_delivered", label: "Project delivered", description: "When a project is marked complete / delivered.", audience: "client" },
];

function defaultChannelSettings(overrides?: Partial<NotificationChannelSettings>): NotificationChannelSettings {
  return {
    inApp: true,
    email: true,
    push: true,
    ...overrides,
  };
}

function buildDefaultNotifications(): Record<NotificationEventKey, NotificationChannelSettings> {
  const entries = NOTIFICATION_EVENT_DEFINITIONS.map((def) => [def.key, defaultChannelSettings()] as const);
  return Object.fromEntries(entries) as Record<NotificationEventKey, NotificationChannelSettings>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  notifications: buildDefaultNotifications(),
  email: {
    fromName: "Swift Portal",
    senderEmail: "notification@swiftaerialmedia.com",
    replyTo: "jackson@swiftaerialmedia.com",
    footerText: "You received this email because you have a project with Swift Aerial Media.",
  },
  business: {
    businessName: SWIFT_BUSINESS_DEFAULTS.businessName,
    portalName: SWIFT_BUSINESS_DEFAULTS.portalName,
    adminDisplayName: SWIFT_BUSINESS_DEFAULTS.adminDisplayName,
    primaryContactEmail: SWIFT_BUSINESS_DEFAULTS.primaryContactEmail,
    phoneNumber: SWIFT_BUSINESS_DEFAULTS.phoneNumber,
    websiteUrl: SWIFT_BUSINESS_DEFAULTS.websiteUrl,
    logoUrl: LOGO_URL,
    brandPrimaryColor: SWIFT_BUSINESS_DEFAULTS.brandPrimaryColor,
    brandAccentColor: SWIFT_BUSINESS_DEFAULTS.brandAccentColor,
  },
  proposals: {
    autoPreliminaryEstimate: true,
    requireAdminReviewBeforeOfficial: false,
    showPreliminaryToClients: true,
    defaultEstimateExpirationDays: 30,
    defaultProposalExpirationDays: 14,
    allowClientProposalChanges: true,
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(
        (base[key] as Record<string, unknown>) ?? {},
        value as Record<string, unknown>
      ) as T[keyof T];
    } else if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

export function mergeAppSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  if (!stored) return structuredClone(DEFAULT_APP_SETTINGS);

  const notifications = { ...DEFAULT_APP_SETTINGS.notifications };
  if (stored.notifications) {
    for (const def of NOTIFICATION_EVENT_DEFINITIONS) {
      notifications[def.key] = {
        ...DEFAULT_APP_SETTINGS.notifications[def.key],
        ...(stored.notifications[def.key] ?? {}),
      };
    }
  }

  return {
    notifications,
    email: { ...DEFAULT_APP_SETTINGS.email, ...(stored.email ?? {}) },
    business: { ...DEFAULT_APP_SETTINGS.business, ...(stored.business ?? {}) },
    proposals: { ...DEFAULT_APP_SETTINGS.proposals, ...(stored.proposals ?? {}) },
  };
}

let cachedSettings: AppSettings | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateAppSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiresAt) return cachedSettings;

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn("[app-settings] load failed, using defaults:", error.message);
      return structuredClone(DEFAULT_APP_SETTINGS);
    }

    cachedSettings = mergeAppSettings((data?.settings as Partial<AppSettings>) ?? null);
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedSettings;
  } catch (error) {
    console.warn("[app-settings] unexpected load error, using defaults:", error);
    return structuredClone(DEFAULT_APP_SETTINGS);
  }
}

export async function saveAppSettings(
  patch: Partial<AppSettings>,
  updatedBy: string
): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged = mergeAppSettings({ ...current, ...patch });

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({
      id: 1,
      settings: merged,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });

  if (error) throw new Error(error.message);

  cachedSettings = merged;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return merged;
}

export function getBrandFromSettings(settings: AppSettings) {
  return getPortalBrandFromSettings(settings);
}

export function addProposalExpiration(
  baseDate: Date,
  days: number | null | undefined
): string | null {
  if (!days || days <= 0) return null;
  const expires = new Date(baseDate);
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}
