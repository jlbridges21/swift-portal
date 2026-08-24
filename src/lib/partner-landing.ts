/**
 * Partner custom landing pages (phase 6) — apex /{slug} only.
 * Plain-text fields; no HTML / page builder.
 * Empty stored fields resolve at render time from partner + program data.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";
import { sanitizePlainText } from "@/lib/landing-content";
import { validateLandingSlug } from "@/lib/reserved-subdomains";
import { getPartnerById } from "@/lib/partners";
import {
  deriveBrandTheme,
  isSafeBrandAssetUrl,
  isSafeCssColor,
  sanitizeCssColor,
} from "@/lib/brand-color";
import {
  DEFAULT_PARTNER_CTA_LABEL,
  DEFAULT_PARTNER_LANDING_BENEFITS,
  DEFAULT_PARTNER_SUBHEADLINE,
  PARTNER_LANDING_LIMITS,
  SHOOTPORTAL_LANDING_ACCENT,
  SHOOTPORTAL_LANDING_PRIMARY,
  defaultPartnerLandingHeadline,
  type PartnerLandingDefaults,
} from "@/lib/partner-landing.constants";
import {
  formatPartnerReferralLandingOffer,
  resolveReferralDiscountForPartner,
} from "@/lib/partner-referral-discount";

export type PartnerLandingPageRow = {
  id: string;
  partner_id: string;
  slug: string;
  headline: string;
  description: string;
  photo_url: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  subheadline: string | null;
  benefits: string[];
  testimonial_quote: string | null;
  testimonial_attribution: string | null;
  show_offer: boolean;
  cta_label: string;
  offer_text: string | null;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerLandingPublic = PartnerLandingPageRow & {
  partner: {
    id: string;
    brand_name: string;
    referral_code: string;
    status: string;
  };
};

export type { PartnerLandingDefaults } from "@/lib/partner-landing.constants";

export type ResolvedPartnerLandingContent = {
  brandName: string;
  slug: string;
  headline: string;
  subheadline: string;
  description: string;
  benefits: string[];
  ctaLabel: string;
  offerText: string | null;
  showOffer: boolean;
  logoUrl: string | null;
  photoUrl: string | null;
  testimonialQuote: string | null;
  testimonialAttribution: string | null;
  accentColor: string;
  accentForeground: string;
  accentHover: string;
  primaryColor: string;
};

export type PartnerLandingContentInput = {
  headline?: string | null;
  subheadline?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  ctaLabel?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  testimonialQuote?: string | null;
  testimonialAttribution?: string | null;
  showOffer?: boolean;
};

export type PartnerLandingAdminInput = PartnerLandingContentInput & {
  slug: string;
  isActive?: boolean;
};

export const PARTNER_LANDING_UPLOAD_BUCKET = "business-logos";
export const PARTNER_LANDING_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

function rowBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function sanitizeMultilinePlain(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen);
}

function sanitizeHttpsUrl(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) throw new Error("URL is too long.");
  if (!isSafeBrandAssetUrl(trimmed)) {
    throw new Error("URL must be https with no scripts or unsafe characters.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("URL must be a valid https URL.");
  }
  if (url.protocol !== "https:") throw new Error("URL must use https.");
  return url.toString();
}

function sanitizeBrandColor(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw new Error("Invalid brand color.");
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!isSafeCssColor(trimmed)) throw new Error("Invalid brand color.");
  return trimmed;
}

function sanitizeBenefits(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error("Benefits must be a list.");
  const items = raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => sanitizePlainText(x, PARTNER_LANDING_LIMITS.benefitItem))
    .filter(Boolean);
  if (items.length === 0) return [];
  if (items.length < PARTNER_LANDING_LIMITS.benefitsMin) {
    throw new Error(
      `Provide at least ${PARTNER_LANDING_LIMITS.benefitsMin} benefits or clear all to use defaults.`
    );
  }
  if (items.length > PARTNER_LANDING_LIMITS.benefitsMax) {
    throw new Error(`At most ${PARTNER_LANDING_LIMITS.benefitsMax} benefits.`);
  }
  return items;
}

function normalizeRow(data: Record<string, unknown>): PartnerLandingPageRow {
  return {
    id: data.id as string,
    partner_id: data.partner_id as string,
    slug: data.slug as string,
    headline: (data.headline as string) ?? "",
    description: (data.description as string) ?? "",
    photo_url: (data.photo_url as string | null) ?? null,
    logo_url: (data.logo_url as string | null) ?? null,
    brand_primary_color: (data.brand_primary_color as string | null) ?? null,
    brand_accent_color: (data.brand_accent_color as string | null) ?? null,
    subheadline: (data.subheadline as string | null) ?? null,
    benefits: rowBenefits(data.benefits),
    testimonial_quote: (data.testimonial_quote as string | null) ?? null,
    testimonial_attribution: (data.testimonial_attribution as string | null) ?? null,
    show_offer: data.show_offer !== false,
    cta_label: (data.cta_label as string) ?? "",
    offer_text: (data.offer_text as string | null) ?? null,
    is_active: data.is_active !== false,
    updated_by: (data.updated_by as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

export function buildPartnerLandingDefaults(brandName: string): PartnerLandingDefaults {
  return {
    headline: defaultPartnerLandingHeadline(brandName),
    subheadline: DEFAULT_PARTNER_SUBHEADLINE,
    description: "",
    benefits: [...DEFAULT_PARTNER_LANDING_BENEFITS],
    ctaLabel: DEFAULT_PARTNER_CTA_LABEL,
    offerText: null,
    brandPrimaryColor: SHOOTPORTAL_LANDING_PRIMARY,
    brandAccentColor: SHOOTPORTAL_LANDING_ACCENT,
  };
}

export async function buildPartnerLandingDefaultsWithOffer(
  partnerId: string,
  brandName: string
): Promise<PartnerLandingDefaults> {
  const base = buildPartnerLandingDefaults(brandName);
  const discount = await resolveReferralDiscountForPartner(partnerId);
  return {
    ...base,
    offerText: formatPartnerReferralLandingOffer(discount),
  };
}

function resolveStoredBenefits(stored: string[]): string[] {
  if (!stored.length) return [...DEFAULT_PARTNER_LANDING_BENEFITS];
  return stored.map((b) => sanitizePlainText(b, PARTNER_LANDING_LIMITS.benefitItem)).filter(Boolean);
}

export async function resolvePartnerLandingContent(
  landing: PartnerLandingPublic
): Promise<ResolvedPartnerLandingContent> {
  const brandName = landing.partner.brand_name.trim() || "Our studio";
  const defaults = buildPartnerLandingDefaults(brandName);

  const headline = sanitizePlainText(landing.headline, PARTNER_LANDING_LIMITS.headline) || defaults.headline;
  const subheadline =
    sanitizePlainText(landing.subheadline ?? "", PARTNER_LANDING_LIMITS.subheadline) ||
    defaults.subheadline;
  const description =
    sanitizeMultilinePlain(landing.description, PARTNER_LANDING_LIMITS.description) ||
    defaults.description;
  const benefits = resolveStoredBenefits(rowBenefits(landing.benefits));
  const ctaLabel =
    sanitizePlainText(landing.cta_label, PARTNER_LANDING_LIMITS.ctaLabel) || defaults.ctaLabel;

  const primaryRaw =
    landing.brand_primary_color?.trim() || defaults.brandPrimaryColor;
  const accentRaw = landing.brand_accent_color?.trim() || defaults.brandAccentColor;
  const theme = deriveBrandTheme(
    sanitizeCssColor(primaryRaw, SHOOTPORTAL_LANDING_PRIMARY),
    sanitizeCssColor(accentRaw, SHOOTPORTAL_LANDING_ACCENT)
  );

  const discount = await resolveReferralDiscountForPartner(landing.partner.id);
  const generatedOffer = formatPartnerReferralLandingOffer(discount);
  const showOffer = landing.show_offer && Boolean(generatedOffer);
  const offerText = showOffer ? generatedOffer : null;

  const logoUrl =
    landing.logo_url && isSafeBrandAssetUrl(landing.logo_url) ? landing.logo_url.trim() : null;
  const photoUrl =
    landing.photo_url && isSafeBrandAssetUrl(landing.photo_url) ? landing.photo_url.trim() : null;

  const testimonialQuote = landing.testimonial_quote
    ? sanitizeMultilinePlain(landing.testimonial_quote, PARTNER_LANDING_LIMITS.testimonialQuote)
    : null;
  const testimonialAttribution = landing.testimonial_attribution
    ? sanitizePlainText(
        landing.testimonial_attribution,
        PARTNER_LANDING_LIMITS.testimonialAttribution
      )
    : null;

  return {
    brandName,
    slug: landing.slug,
    headline,
    subheadline,
    description,
    benefits,
    ctaLabel,
    offerText,
    showOffer,
    logoUrl,
    photoUrl,
    testimonialQuote: testimonialQuote || null,
    testimonialAttribution: testimonialAttribution || null,
    accentColor: theme.accent,
    accentForeground: theme.accentForeground,
    accentHover: theme.accentHover,
    primaryColor: theme.primary,
  };
}

function buildContentPayload(input: PartnerLandingContentInput) {
  return {
    headline: sanitizePlainText(input.headline ?? "", PARTNER_LANDING_LIMITS.headline),
    subheadline: (() => {
      const v = sanitizePlainText(input.subheadline ?? "", PARTNER_LANDING_LIMITS.subheadline);
      return v || null;
    })(),
    description: sanitizeMultilinePlain(input.description ?? "", PARTNER_LANDING_LIMITS.description),
    benefits: sanitizeBenefits(input.benefits ?? []),
    cta_label: sanitizePlainText(input.ctaLabel ?? "", PARTNER_LANDING_LIMITS.ctaLabel),
    photo_url:
      input.photoUrl === null || input.photoUrl === ""
        ? null
        : sanitizeHttpsUrl(input.photoUrl),
    logo_url:
      input.logoUrl === null || input.logoUrl === ""
        ? null
        : sanitizeHttpsUrl(input.logoUrl),
    brand_primary_color: sanitizeBrandColor(input.brandPrimaryColor),
    brand_accent_color: sanitizeBrandColor(input.brandAccentColor),
    testimonial_quote: (() => {
      const v = sanitizeMultilinePlain(
        input.testimonialQuote ?? "",
        PARTNER_LANDING_LIMITS.testimonialQuote
      );
      return v || null;
    })(),
    testimonial_attribution: (() => {
      const v = sanitizePlainText(
        input.testimonialAttribution ?? "",
        PARTNER_LANDING_LIMITS.testimonialAttribution
      );
      return v || null;
    })(),
    show_offer: input.showOffer !== false,
  };
}

export async function getPartnerLandingByPartnerId(
  partnerId: string
): Promise<PartnerLandingPageRow | null> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_landing_pages")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeRow(data as Record<string, unknown>) : null;
}

/** Active landing for apex /{slug}. Null → caller should 404. */
export async function getActivePartnerLandingBySlug(
  slug: string
): Promise<PartnerLandingPublic | null> {
  const validated = validateLandingSlug(slug);
  if (!validated.ok) return null;

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_landing_pages")
    .select("*")
    .eq("slug", validated.slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const partner = await getPartnerById(data.partner_id as string);
  if (!partner || partner.status !== "active") return null;

  const row = normalizeRow(data as Record<string, unknown>);
  return {
    ...row,
    partner: {
      id: partner.id,
      brand_name: partner.brand_name,
      referral_code: partner.referral_code,
      status: partner.status,
    },
  };
}

export async function getPartnerLandingUpdatedByLabel(
  updatedBy: string | null
): Promise<string | null> {
  if (!updatedBy) return null;
  const raw = await createServiceClient();
  const { data } = await raw
    .from("profiles")
    .select("email, full_name")
    .eq("id", updatedBy)
    .maybeSingle();
  if (!data) return updatedBy;
  const name = (data.full_name as string | null)?.trim();
  const email = (data.email as string | null)?.trim();
  return name || email || updatedBy;
}

/** Partner-facing save — slug and is_active cannot change. */
export async function updatePartnerLandingContent(
  partnerId: string,
  input: PartnerLandingContentInput,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  const existing = await getPartnerLandingByPartnerId(partnerId);
  if (!existing) throw new Error("Your landing page has not been activated yet. Contact ShootPortal support.");

  const raw = await createServiceClient();
  const payload = {
    ...buildContentPayload(input),
    updated_by: actor.id,
  };

  const { data, error } = await raw
    .from("partner_landing_pages")
    .update(payload)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not update landing page.");
  const row = normalizeRow(data as Record<string, unknown>);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.landing_content_update",
    targetType: "partner",
    targetId: partnerId,
    metadata: { landingId: row.id },
  });

  return row;
}

export async function upsertPartnerLandingPage(
  partnerId: string,
  input: PartnerLandingAdminInput,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  const partner = await getPartnerById(partnerId);
  if (!partner) throw new Error("Partner not found.");

  const slugResult = validateLandingSlug(input.slug);
  if (!slugResult.ok) throw new Error(slugResult.error);

  const raw = await createServiceClient();

  const { data: slugTaken } = await raw
    .from("partner_landing_pages")
    .select("id, partner_id")
    .eq("slug", slugResult.slug)
    .maybeSingle();
  if (slugTaken && slugTaken.partner_id !== partnerId) {
    throw new Error("That landing slug is already in use.");
  }

  const existing = await getPartnerLandingByPartnerId(partnerId);
  const content = buildContentPayload(input);
  const isActive = input.isActive !== false;

  const payload = {
    partner_id: partnerId,
    slug: slugResult.slug,
    ...content,
    is_active: isActive,
    updated_by: actor.id,
  };

  let row: PartnerLandingPageRow;
  if (existing) {
    const { data, error } = await raw
      .from("partner_landing_pages")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not update landing page.");
    row = normalizeRow(data as Record<string, unknown>);
  } else {
    const { data, error } = await raw
      .from("partner_landing_pages")
      .insert(payload)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not create landing page.");
    row = normalizeRow(data as Record<string, unknown>);
  }

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.landing_upsert",
    targetType: "partner",
    targetId: partnerId,
    metadata: {
      landingId: row.id,
      slug: row.slug,
      isActive: row.is_active,
    },
  });

  return row;
}

export async function setPartnerLandingActive(
  partnerId: string,
  isActive: boolean,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  const existing = await getPartnerLandingByPartnerId(partnerId);
  if (!existing) throw new Error("No landing page configured for this partner.");

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_landing_pages")
    .update({ is_active: isActive, updated_by: actor.id })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not update landing page.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.landing_active",
    targetType: "partner",
    targetId: partnerId,
    metadata: { landingId: existing.id, isActive },
  });

  return normalizeRow(data as Record<string, unknown>);
}

export function partnerLandingStoragePath(
  partnerId: string,
  kind: "logo" | "photo",
  ext: string
): string {
  return `partner-landing/${partnerId}/${kind}.${ext}`;
}

export async function uploadPartnerLandingAsset(args: {
  partnerId: string;
  kind: "logo" | "photo";
  buffer: Buffer;
  contentType: string;
  ext: string;
}): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Storage URL not configured.");

  const path = partnerLandingStoragePath(args.partnerId, args.kind, args.ext);
  const raw = await createServiceClient();
  const { error: uploadError } = await raw.storage
    .from(PARTNER_LANDING_UPLOAD_BUCKET)
    .upload(path, args.buffer, {
      upsert: true,
      contentType: args.contentType || "application/octet-stream",
    });
  if (uploadError) throw new Error(uploadError.message);

  return `${supabaseUrl}/storage/v1/object/public/${PARTNER_LANDING_UPLOAD_BUCKET}/${path}?v=${Date.now()}`;
}
