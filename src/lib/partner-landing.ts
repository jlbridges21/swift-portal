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
  isSafeBrandAssetUrl,
  isSafeCssColor,
} from "@/lib/brand-color";
import {
  DEFAULT_PARTNER_LANDING_BENEFITS,
  PARTNER_LANDING_LIMITS,
  buildPartnerLandingDefaultsFromConstants,
  type PartnerLandingDefaults,
} from "@/lib/partner-landing.constants";
import {
  PARTNER_LANDING_UPLOAD_MAX_BYTES,
  preparePartnerLandingImage,
} from "@/lib/partner-landing-image";
import { resolveReferralDiscountForPartner } from "@/lib/partner-referral-discount";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import {
  resolvePartnerLandingContentSync,
  type ResolvedPartnerLandingContent,
} from "@/lib/partner-landing-resolve";

export type { ResolvedPartnerLandingContent };
export { resolvePartnerLandingContentSync };

export type PartnerLandingPageRow = {
  id: string;
  partner_id: string;
  slug: string;
  headline: string;
  description: string;
  photo_url: string | null;
  photo_width: number | null;
  photo_height: number | null;
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

export type PartnerLandingContentInput = {
  headline?: string | null;
  subheadline?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  ctaLabel?: string | null;
  photoUrl?: string | null;
  photoWidth?: number | null;
  photoHeight?: number | null;
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
export { PARTNER_LANDING_UPLOAD_MAX_BYTES };

export { resolvePartnerLandingPhotoUrl, PARTNER_DEFAULT_PHOTO_PATH } from "@/lib/partner-landing.constants";

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
    photo_width:
      typeof data.photo_width === "number" && data.photo_width > 0
        ? Math.round(data.photo_width)
        : null,
    photo_height:
      typeof data.photo_height === "number" && data.photo_height > 0
        ? Math.round(data.photo_height)
        : null,
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
  return buildPartnerLandingDefaultsFromConstants(brandName);
}

export async function buildPartnerLandingDefaultsWithOffer(
  partnerId: string,
  brandName: string
): Promise<PartnerLandingDefaults> {
  const base = buildPartnerLandingDefaults(brandName);
  const discount = await resolveReferralDiscountForPartner(partnerId);
  return {
    ...base,
    offerText: discount.eligible ? discount.offerText ?? null : null,
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
  const discount = await resolveReferralDiscountForPartner(landing.partner.id);
  const generatedOffer = discount.eligible ? discount.offerText ?? null : null;

  return resolvePartnerLandingContentSync({
    brandName,
    slug: landing.slug,
    headline: landing.headline,
    subheadline: landing.subheadline,
    description: landing.description,
    benefits: landing.benefits,
    ctaLabel: landing.cta_label,
    logoUrl: landing.logo_url,
    photoUrl: landing.photo_url,
    photoWidth: landing.photo_width,
    photoHeight: landing.photo_height,
    brandPrimaryColor: landing.brand_primary_color,
    brandAccentColor: landing.brand_accent_color,
    testimonialQuote: landing.testimonial_quote,
    testimonialAttribution: landing.testimonial_attribution,
    showOffer: landing.show_offer,
    offerText: generatedOffer,
  });
}

function sanitizePhotoDimension(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 10000) {
    throw new Error("Invalid photo dimensions.");
  }
  return Math.round(n);
}

function buildContentPayload(input: PartnerLandingContentInput) {
  const photoUrl =
    input.photoUrl === null || input.photoUrl === ""
      ? null
      : sanitizeHttpsUrl(input.photoUrl);

  let photoWidth: number | null = null;
  let photoHeight: number | null = null;
  if (photoUrl) {
    photoWidth = sanitizePhotoDimension(input.photoWidth ?? null);
    photoHeight = sanitizePhotoDimension(input.photoHeight ?? null);
    if ((photoWidth == null) !== (photoHeight == null)) {
      throw new Error("photoWidth and photoHeight must both be set or both be empty.");
    }
  }

  return {
    headline: sanitizePlainText(input.headline ?? "", PARTNER_LANDING_LIMITS.headline),
    subheadline: (() => {
      const v = sanitizePlainText(input.subheadline ?? "", PARTNER_LANDING_LIMITS.subheadline);
      return v || null;
    })(),
    description: sanitizeMultilinePlain(input.description ?? "", PARTNER_LANDING_LIMITS.description),
    benefits: sanitizeBenefits(input.benefits ?? []),
    cta_label: sanitizePlainText(input.ctaLabel ?? "", PARTNER_LANDING_LIMITS.ctaLabel),
    photo_url: photoUrl,
    photo_width: photoWidth,
    photo_height: photoHeight,
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

/** Partner-facing: requires active PartnerAccess (structural ownership). */
export async function getPartnerLandingForAccess(
  access: import("@/lib/partner-dashboard").PartnerAccess
): Promise<PartnerLandingPageRow | null> {
  if (access.kind !== "active") {
    throw new Error("Active partner access required");
  }
  return getPartnerLandingByPartnerId(access.partner.id);
}

/**
 * Resolve landing row id from slug (primary or former alias). Null if unknown/inactive path.
 */
async function resolveActiveLandingIdBySlug(
  slug: string
): Promise<{ landingId: string; partnerId: string } | null> {
  const validated = validateLandingSlug(slug);
  if (!validated.ok) return null;

  const raw = await createServiceClient();
  const { data: landing } = await raw
    .from("partner_landing_pages")
    .select("id, partner_id")
    .eq("slug", validated.slug)
    .eq("is_active", true)
    .maybeSingle();
  if (landing?.id && landing.partner_id) {
    return { landingId: landing.id as string, partnerId: landing.partner_id as string };
  }

  const { data: alias } = await raw
    .from("partner_landing_slug_aliases")
    .select("landing_id, partner_id")
    .eq("slug", validated.slug)
    .maybeSingle();
  if (!alias?.landing_id) return null;

  const { data: aliasLanding } = await raw
    .from("partner_landing_pages")
    .select("id, partner_id")
    .eq("id", alias.landing_id as string)
    .eq("is_active", true)
    .maybeSingle();
  if (!aliasLanding?.id) return null;
  return {
    landingId: aliasLanding.id as string,
    partnerId: aliasLanding.partner_id as string,
  };
}

async function recordLandingSlugAlias(args: {
  slug: string;
  landingId: string;
  partnerId: string;
}): Promise<void> {
  const validated = validateLandingSlug(args.slug);
  if (!validated.ok) return;
  const raw = await createServiceClient();
  const { error } = await raw.from("partner_landing_slug_aliases").upsert(
    {
      slug: validated.slug,
      landing_id: args.landingId,
      partner_id: args.partnerId,
    },
    { onConflict: "slug" }
  );
  if (error) throw new Error(error.message);
}

export function partnerLandingApexUrl(slug: string): string {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  return `${apex}/${slug}`;
}

/** Active landing for apex /{slug}. Null → caller should 404. */
export async function getActivePartnerLandingBySlug(
  slug: string
): Promise<PartnerLandingPublic | null> {
  const validated = validateLandingSlug(slug);
  if (!validated.ok) return null;

  const resolved = await resolveActiveLandingIdBySlug(validated.slug);
  if (!resolved) return null;

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_landing_pages")
    .select("*")
    .eq("id", resolved.landingId)
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

/** Partner-facing: requires active PartnerAccess. */
export async function updatePartnerLandingContentForAccess(
  access: import("@/lib/partner-dashboard").PartnerAccess,
  input: PartnerLandingContentInput,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  if (access.kind !== "active") {
    throw new Error("Active partner access required");
  }
  return updatePartnerLandingContent(access.partner.id, input, actor);
}

/** Partner creates their first landing page (slug is permanent — aliases preserve old URLs if changed later by support). */
export async function createPartnerLandingPageForAccess(
  access: import("@/lib/partner-dashboard").PartnerAccess,
  slug: string,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  if (access.kind !== "active") {
    throw new Error("Active partner access required");
  }
  const existing = await getPartnerLandingByPartnerId(access.partner.id);
  if (existing) throw new Error("You already have a landing page.");

  return upsertPartnerLandingPage(
    access.partner.id,
    {
      slug,
      headline: "",
      description: "",
      isActive: true,
    },
    actor
  );
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
    if (existing.slug !== slugResult.slug) {
      await recordLandingSlugAlias({
        slug: existing.slug,
        landingId: existing.id,
        partnerId,
      });
    }
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
}): Promise<{ url: string; width: number; height: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Storage URL not configured.");

  const prepared = await preparePartnerLandingImage({
    kind: args.kind,
    buffer: args.buffer,
    contentType: args.contentType,
    ext: args.ext,
  });

  const path = partnerLandingStoragePath(args.partnerId, args.kind, prepared.ext);
  const raw = await createServiceClient();
  const { error: uploadError } = await raw.storage
    .from(PARTNER_LANDING_UPLOAD_BUCKET)
    .upload(path, prepared.buffer, {
      upsert: true,
      contentType: prepared.contentType,
    });
  if (uploadError) throw new Error(uploadError.message);

  const url = `${supabaseUrl}/storage/v1/object/public/${PARTNER_LANDING_UPLOAD_BUCKET}/${path}?v=${Date.now()}`;

  // Store photo URL + intrinsic dims at upload time (eliminates CLS on the public page).
  if (args.kind === "photo") {
    const { error: updateError } = await raw
      .from("partner_landing_pages")
      .update({
        photo_url: url,
        photo_width: prepared.width,
        photo_height: prepared.height,
        updated_at: new Date().toISOString(),
      })
      .eq("partner_id", args.partnerId);
    if (updateError) throw new Error(updateError.message);
  }

  return { url, width: prepared.width, height: prepared.height };
}

/** Clear personal photo + dims (settings Remove). Logo untouched. */
export async function clearPartnerLandingPhoto(
  partnerId: string,
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  const existing = await getPartnerLandingByPartnerId(partnerId);
  if (!existing) throw new Error("Landing page not found.");

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_landing_pages")
    .update({
      photo_url: null,
      photo_width: null,
      photo_height: null,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not clear photo.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.landing_photo_clear",
    targetType: "partner",
    targetId: partnerId,
    metadata: { landingId: existing.id },
  });

  return normalizeRow(data as Record<string, unknown>);
}

/** Partner-facing upload — requires active PartnerAccess (ignores any other partnerId). */
export async function uploadPartnerLandingAssetForAccess(
  access: import("@/lib/partner-dashboard").PartnerAccess,
  args: Omit<Parameters<typeof uploadPartnerLandingAsset>[0], "partnerId">
): Promise<{ url: string; width: number; height: number }> {
  if (access.kind !== "active") {
    throw new Error("Active partner access required");
  }
  return uploadPartnerLandingAsset({ ...args, partnerId: access.partner.id });
}
