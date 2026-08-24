import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { createBusinessForPlatform } from "@/lib/platform-onboard";
import { loadPlatformBusinesses } from "@/lib/platform-dashboard";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const businesses = await loadPlatformBusinesses();
    return NextResponse.json({ businesses });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list businesses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      customDomain?: string | null;
      plan?: string;
      adminEmail?: string;
      adminName?: string;
      referredByPartnerId?: string | null;
    };
    const result = await createBusinessForPlatform(
      {
        name: body.name ?? "",
        slug: body.slug ?? "",
        customDomain: body.customDomain,
        plan: body.plan,
        adminEmail: body.adminEmail ?? "",
        adminName: body.adminName,
        referredByPartnerId: body.referredByPartnerId || null,
      },
      { id: auth.profile.id, email: auth.profile.email }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create business" },
      { status: 400 }
    );
  }
}
