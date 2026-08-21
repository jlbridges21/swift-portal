/**
 * Shared portal setup completeness checks.
 *
 * Used by SetupChecklistCard and the /onboarding wizard so "is branding done?"
 * never drifts between two implementations.
 */

import type { AppSettings, SetupAcceptDefaultKey } from "@/lib/app-settings";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { BRAND } from "@/lib/brand";

/** Starter catalog from createBusinessForPlatform — seeded at signup. */
export const STARTER_SERVICE_SLUGS = new Set([
  "aerial_photography",
  "aerial_videography",
  "drone_mapping",
  "custom_project",
]);

export type ServiceCompletenessRow = {
  slug?: string | null;
  is_active?: boolean | null;
  hide_pricing?: boolean | null;
  preliminary_estimate_cents?: number | null;
};

export function isBusinessNameConfigured(settings: AppSettings): boolean {
  const name = settings.business.businessName.trim();
  return Boolean(name) && name !== PLATFORM_BUSINESS_DEFAULTS.businessName;
}

/** Reply-to / footer contact — email is what client email needs. */
export function isContactEmailConfigured(settings: AppSettings): boolean {
  return Boolean(settings.business.primaryContactEmail.trim());
}

/** Checklist "Contact info" — email or phone (legacy checklist item). */
export function isContactInfoConfigured(settings: AppSettings): boolean {
  return Boolean(
    settings.business.primaryContactEmail.trim() || settings.business.phoneNumber.trim()
  );
}

function acceptedDefault(settings: AppSettings, key: SetupAcceptDefaultKey): boolean {
  return settings.setupAcceptedDefaults?.[key] === true;
}

export function isLogoConfigured(settings: AppSettings): boolean {
  if (acceptedDefault(settings, "logo")) return true;
  const logo = settings.business.logoUrl;
  return Boolean(logo) && logo !== PLATFORM_BUSINESS_DEFAULTS.logoUrl && logo !== BRAND.logoUrl;
}

export function isBrandColorsConfigured(settings: AppSettings): boolean {
  if (acceptedDefault(settings, "colors")) return true;
  const b = settings.business;
  return (
    b.brandPrimaryColor !== PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor ||
    b.brandAccentColor !== PLATFORM_BUSINESS_DEFAULTS.brandAccentColor
  );
}

export function isEmailSenderConfigured(settings: AppSettings): boolean {
  // Platform sender (default) is a complete, intentional configuration.
  if (settings.email.senderMode === "platform") return true;
  return (
    settings.email.senderMode === "custom_domain" &&
    settings.email.domainVerificationStatus === "verified"
  );
}

/**
 * Portal can accept requests when there is at least one active service that
 * either has a price or is explicitly hide-pricing (e.g. custom project).
 * Seeded starters already satisfy this.
 */
export function hasActivePricedService(services: ServiceCompletenessRow[]): boolean {
  return services.some((s) => {
    if (s.is_active === false) return false;
    if (s.hide_pricing) return true;
    const cents = s.preliminary_estimate_cents;
    return typeof cents === "number" && Number.isFinite(cents) && cents > 0;
  });
}

/**
 * Checklist "Services" — catalog moved beyond the four untouched starters.
 * Strongly recommended polish; not the same as hasActivePricedService.
 */
export function hasCustomizedServices(services: ServiceCompletenessRow[]): boolean {
  const active = services.filter((s) => s.is_active !== false);
  if (active.length === 0) return false;
  const onlyStarters =
    active.length === STARTER_SERVICE_SLUGS.size &&
    active.every((s) => typeof s.slug === "string" && STARTER_SERVICE_SLUGS.has(s.slug));
  return !onlyStarters;
}

export function isStripeConnected(
  stripeOk: boolean | null | undefined,
  settings?: AppSettings
): boolean {
  if (settings && acceptedDefault(settings, "stripe")) return true;
  return stripeOk === true;
}

/**
 * Required before onboarding_completed_at can be set / portal is "ready".
 * Matches product reality: name, contact email, ≥1 active priced service.
 */
export function requiredSetupComplete(input: {
  settings: AppSettings;
  services: ServiceCompletenessRow[];
}): boolean {
  return (
    isBusinessNameConfigured(input.settings) &&
    isContactEmailConfigured(input.settings) &&
    hasActivePricedService(input.services)
  );
}

export type ChecklistItemId =
  | "name"
  | "logo"
  | "colors"
  | "contact"
  | "email"
  | "stripe"
  | "services";

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  hash: string;
  done: boolean;
  /** Optional setup — studio may acknowledge ShootPortal defaults. */
  acceptDefaultKey?: SetupAcceptDefaultKey;
};

/** Same items the SetupChecklistCard renders — single source of truth. */
export function buildSetupChecklistItems(input: {
  settings: AppSettings;
  stripeOk: boolean | null;
  services: ServiceCompletenessRow[] | null;
}): ChecklistItem[] {
  const { settings } = input;
  return [
    {
      id: "name",
      label: "Business name",
      hash: "settings-business-name",
      done: isBusinessNameConfigured(settings),
    },
    {
      id: "logo",
      label: "Logo",
      hash: "settings-logo",
      done: isLogoConfigured(settings),
      acceptDefaultKey: "logo",
    },
    {
      id: "colors",
      label: "Brand colors",
      hash: "settings-colors",
      done: isBrandColorsConfigured(settings),
      acceptDefaultKey: "colors",
    },
    {
      id: "contact",
      label: "Contact info",
      hash: "settings-contact",
      done: isContactInfoConfigured(settings),
    },
    {
      id: "email",
      label: "Email sender",
      hash: "settings-email",
      done: isEmailSenderConfigured(settings),
    },
    {
      id: "stripe",
      label: "Client payments",
      hash: "settings-payments",
      done: isStripeConnected(input.stripeOk, settings),
      acceptDefaultKey: "stripe",
    },
    {
      id: "services",
      label: "Services",
      hash: "settings-services",
      // Seeded starters with prices already satisfy this — no permanent nag.
      done: input.services == null ? false : hasActivePricedService(input.services),
    },
  ];
}
