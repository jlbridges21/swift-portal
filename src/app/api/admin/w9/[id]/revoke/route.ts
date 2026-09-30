import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { w9CountryDecision } from "@/lib/w9-country";
import { revokeW9Send } from "@/lib/w9-send";
import { w9ErrorResponse } from "@/lib/w9-generate";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const country = await w9CountryDecision(tenant.businessId);
  if (!country.us) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await context.params;
  try {
    await revokeW9Send(tenant.businessId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return w9ErrorResponse(err);
  }
}
