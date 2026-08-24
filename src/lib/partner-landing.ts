/**
 * Partner custom landing pages (phase 6) — apex /{slug} only.
 * Plain-text fields; no HTML / page builder.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";
import { sanitizePlainText } from "@/lib/landing-content";
import { validateLandingSlug } from "@/lib/reserved-subdomains";
import { getPartnerById } from "@/lib/partners";

export type PartnerLandingPageRow = {
  id: string;
  partner_id: string;
  slug: string;
  headline: string;
  description: string;
  photo_url: string | null;
  cta_label: string;
  offer_text: string | null;
  is_active: boolean;
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

function sanitizeHttpsUrl(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) throw new Error("Photo URL is too long.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Photo URL must be a valid https URL.");
  }
  if (url.protocol !== "https:") throw new Error("Photo URL must use https.");
  return url.toString();
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
  return (data as PartnerLandingPageRow | null) ?? null;
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

  return {
    ...(data as PartnerLandingPageRow),
    partner: {
      id: partner.id,
      brand_name: partner.brand_name,
      referral_code: partner.referral_code,
      status: partner.status,
    },
  };
}

export async function upsertPartnerLandingPage(
  partnerId: string,
  input: {
    slug: string;
    headline: string;
    description?: string | null;
    photoUrl?: string | null;
    ctaLabel?: string | null;
    offerText?: string | null;
    isActive?: boolean;
  },
  actor: { id: string; email: string | null }
): Promise<PartnerLandingPageRow> {
  const partner = await getPartnerById(partnerId);
  if (!partner) throw new Error("Partner not found.");

  const slugResult = validateLandingSlug(input.slug);
  if (!slugResult.ok) throw new Error(slugResult.error);

  const headline = sanitizePlainText(input.headline, 200);
  if (!headline) throw new Error("Headline is required.");

  const description = sanitizePlainText(input.description ?? "", 2000);
  const ctaLabel = sanitizePlainText(input.ctaLabel ?? "Start free trial", 80) || "Start free trial";
  const offerTextRaw = sanitizePlainText(input.offerText ?? "", 500);
  const offerText = offerTextRaw || null;
  const photoUrl =
    input.photoUrl === null || input.photoUrl === ""
      ? null
      : sanitizeHttpsUrl(input.photoUrl);
  const isActive = input.isActive !== false;

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
  const payload = {
    partner_id: partnerId,
    slug: slugResult.slug,
    headline,
    description,
    photo_url: photoUrl,
    cta_label: ctaLabel,
    offer_text: offerText,
    is_active: isActive,
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
    row = data as PartnerLandingPageRow;
  } else {
    const { data, error } = await raw
      .from("partner_landing_pages")
      .insert(payload)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not create landing page.");
    row = data as PartnerLandingPageRow;
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
    .update({ is_active: isActive })
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

  return data as PartnerLandingPageRow;
}
