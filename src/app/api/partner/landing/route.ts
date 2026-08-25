import { NextResponse } from "next/server";
import {
  buildPartnerLandingDefaultsWithOffer,
  createPartnerLandingPageForAccess,
  getPartnerLandingForAccess,
  getPartnerLandingUpdatedByLabel,
  updatePartnerLandingContentForAccess,
} from "@/lib/partner-landing";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { getPlatformApexOrigin } from "@/lib/portal-url";

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  const landing = await getPartnerLandingForAccess(access);
  const defaults = await buildPartnerLandingDefaultsWithOffer(
    access.partner.id,
    access.partner.brand_name
  );
  const previewPath = landing?.slug ? `/${landing.slug}` : null;
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const previewUrl = previewPath ? `${apex}${previewPath}` : null;

  let updatedByLabel: string | null = null;
  if (landing?.updated_by) {
    updatedByLabel = await getPartnerLandingUpdatedByLabel(landing.updated_by);
  }

  return NextResponse.json({
    landing,
    defaults,
    previewUrl,
    brandName: access.partner.brand_name,
    updatedByLabel,
  });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  try {
    const body = await request.json();
    if ("slug" in body || "isActive" in body || "is_active" in body) {
      return NextResponse.json(
        { error: "Slug and active status cannot be changed here." },
        { status: 403 }
      );
    }
    // Ignore any attacker-supplied partner_id in the body.
    void body.partner_id;
    void body.partnerId;

    const landing = await updatePartnerLandingContentForAccess(
      access,
      {
        headline: body.headline,
        subheadline: body.subheadline,
        description: body.description,
        benefits: body.benefits,
        ctaLabel: body.ctaLabel ?? body.cta_label,
        photoUrl: body.photoUrl ?? body.photo_url,
        logoUrl: body.logoUrl ?? body.logo_url,
        brandPrimaryColor: body.brandPrimaryColor ?? body.brand_primary_color,
        brandAccentColor: body.brandAccentColor ?? body.brand_accent_color,
        testimonialQuote: body.testimonialQuote ?? body.testimonial_quote,
        testimonialAttribution: body.testimonialAttribution ?? body.testimonial_attribution,
        showOffer: body.showOffer ?? body.show_offer,
      },
      { id: profile.id, email: profile.email }
    );
    return NextResponse.json({ landing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save landing page" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner suspended", suspended: true }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { slug?: string };
    const slug = typeof body.slug === "string" ? body.slug : "";
    const landing = await createPartnerLandingPageForAccess(access, slug, {
      id: profile.id,
      email: profile.email,
    });
    return NextResponse.json({ landing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create landing page" },
      { status: 400 }
    );
  }
}
