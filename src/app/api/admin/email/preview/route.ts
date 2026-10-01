import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isSafeBrandAssetUrl } from "@/lib/brand-color";
import { renderDeliverablesEmailPreviewHtml } from "@/lib/client-email-notifications";
import type { EmailPreviewDraft } from "@/lib/email";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

const PREVIEW_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store, no-cache, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Pragma: "no-cache",
} as const;

function readString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, max);
}

function readLogo(value: unknown): string | undefined {
  const raw = readString(value, 2000);
  if (raw === undefined) return undefined;
  return isSafeBrandAssetUrl(raw) ? raw : undefined;
}

/**
 * Render the deliverables email with the caller's unsaved branding.
 * This route does not call Resend and does not write email_events.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOwnerAdmin(profile)) {
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

  const draft: EmailPreviewDraft = {
    primaryColor: readString(body.primaryColor, 64),
    accentColor: readString(body.accentColor, 64),
    emailLogoUrl: readLogo(body.emailLogoUrl),
    logoUrl: readLogo(body.logoUrl),
    businessName: readString(body.businessName, 200),
    portalName: readString(body.portalName, 200),
    footerText: readString(body.footerText, 4000),
  };

  const html = await renderDeliverablesEmailPreviewHtml(tenant.businessId, draft);
  return new NextResponse(html, { headers: PREVIEW_HEADERS });
}
