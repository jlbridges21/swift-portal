import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  buildPartnerLandingDefaultsWithOffer,
  clearPartnerLandingPhoto,
  getPartnerLandingByPartnerId,
  getPartnerLandingUpdatedByLabel,
  setPartnerLandingActive,
  upsertPartnerLandingPage,
} from "@/lib/partner-landing";
import { getPartnerById } from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const landing = await getPartnerLandingByPartnerId(id);
  const defaults = await buildPartnerLandingDefaultsWithOffer(id, partner.brand_name);
  let updatedByLabel: string | null = null;
  if (landing?.updated_by) {
    updatedByLabel = await getPartnerLandingUpdatedByLabel(landing.updated_by);
  }
  return NextResponse.json({ landing, defaults, updatedByLabel });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json();
    if (body.clearPhoto === true) {
      const landing = await clearPartnerLandingPhoto(id, {
        id: auth.profile.id,
        email: auth.profile.email,
      });
      return NextResponse.json({ landing });
    }
    const landing = await upsertPartnerLandingPage(
      id,
      {
        slug: body.slug,
        headline: body.headline,
        subheadline: body.subheadline,
        description: body.description,
        benefits: body.benefits,
        photoUrl: body.photoUrl ?? body.photo_url,
        photoWidth: body.photoWidth ?? body.photo_width,
        photoHeight: body.photoHeight ?? body.photo_height,
        logoUrl: body.logoUrl ?? body.logo_url,
        brandPrimaryColor: body.brandPrimaryColor ?? body.brand_primary_color,
        brandAccentColor: body.brandAccentColor ?? body.brand_accent_color,
        testimonialQuote: body.testimonialQuote ?? body.testimonial_quote,
        testimonialAttribution: body.testimonialAttribution ?? body.testimonial_attribution,
        showOffer: body.showOffer ?? body.show_offer,
        ctaLabel: body.ctaLabel ?? body.cta_label,
        isActive: body.isActive ?? body.is_active,
      },
      { id: auth.profile.id, email: auth.profile.email }
    );
    return NextResponse.json({ landing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save landing page" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json();
    if (typeof body.isActive !== "boolean" && typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "isActive boolean required" }, { status: 400 });
    }
    const isActive = body.isActive ?? body.is_active;
    const landing = await setPartnerLandingActive(
      id,
      Boolean(isActive),
      { id: auth.profile.id, email: auth.profile.email }
    );
    return NextResponse.json({ landing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update landing page" },
      { status: 400 }
    );
  }
}
