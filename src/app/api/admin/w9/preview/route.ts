import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { w9CountryDecision } from "@/lib/w9-country";
import { sanitizeTaxInformation } from "@/lib/w9-settings";
import {
  createW9PreviewPdf,
  readPreviewSignature,
  w9ErrorResponse,
  w9SignatureDate,
} from "@/lib/w9-generate";
import { assertNoTinInPreview } from "@/lib/w9-tin";

const PREVIEW_HEADERS = {
  "Content-Type": "application/pdf",
  "Content-Disposition": 'inline; filename="w-9-preview.pdf"',
  "Cache-Control": "private, no-store, no-cache, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Pragma: "no-cache",
} as const;

/**
 * In-memory preview. The bytes are returned once and are not written to
 * storage. A taxpayer identification number is refused before the PDF is built.
 */
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
    assertNoTinInPreview(body);
    const country = await w9CountryDecision(tenant.businessId);
    if (!country.us) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = await getAppSettings(tenant.businessId);
    const tax = sanitizeTaxInformation(body.tax, false);
    const signature = readPreviewSignature(body, w9SignatureDate(settings.workflow.businessDefaults.timezone));
    const pdf = await createW9PreviewPdf({ businessId: tenant.businessId, tax, signature });
    return new NextResponse(Buffer.from(pdf), { headers: PREVIEW_HEADERS });
  } catch (err) {
    return w9ErrorResponse(err);
  }
}
