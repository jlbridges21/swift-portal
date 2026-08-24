import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  getPartnerLandingByPartnerId,
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
  return NextResponse.json({ landing });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json();
    const landing = await upsertPartnerLandingPage(
      id,
      {
        slug: body.slug,
        headline: body.headline,
        description: body.description,
        photoUrl: body.photoUrl ?? body.photo_url,
        ctaLabel: body.ctaLabel ?? body.cta_label,
        offerText: body.offerText ?? body.offer_text,
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
