import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { w9CountryDecision } from "@/lib/w9-country";
import { createW9Pdf, w9ErrorResponse } from "@/lib/w9-generate";
import { W9_DOWNLOAD_HEADERS } from "@/lib/w9-link";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const country = await w9CountryDecision(tenant.businessId);
    if (!country.us) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = await getAppSettings(tenant.businessId);
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.workflow.businessDefaults.timezone || "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(new Date());
    const pdf = await createW9Pdf({ businessId: tenant.businessId, body, date });
    return new NextResponse(Buffer.from(pdf), { headers: W9_DOWNLOAD_HEADERS });
  } catch (err) {
    return w9ErrorResponse(err);
  }
}
