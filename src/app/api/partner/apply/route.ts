import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canAccessPartnerEntry, getCapabilities } from "@/lib/capabilities";
import { submitAuthenticatedPartnerApplication } from "@/lib/partners";

const GENERIC_ERR = { error: "Unable to submit application. Please try again later." };

/**
 * Authenticated partner application from inside the app.
 * Auto-approves immediately; redirects client to partner dashboard.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const caps = await getCapabilities();
  if (!canAccessPartnerEntry(caps)) {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }

  if (caps.partner.active) {
    return NextResponse.json({ success: true, redirectTo: "/partner/dashboard" });
  }

  const { resolvePartnerEntryState } = await import("@/lib/partner-entry");
  const entryState = await resolvePartnerEntryState();
  if (entryState?.kind === "application_declined") {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }
  if (entryState?.kind === "suspended") {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(GENERIC_ERR, { status: 400 });
  }

  try {
    const result = await submitAuthenticatedPartnerApplication(profile.id, profile.email, {
      name: typeof body.name === "string" ? body.name : "",
      email: profile.email,
      brandName:
        typeof body.brandName === "string"
          ? body.brandName
          : typeof body.brand_name === "string"
            ? body.brand_name
            : "",
      website: typeof body.website === "string" ? body.website : null,
      socialLinks:
        body.socialLinks && typeof body.socialLinks === "object" && !Array.isArray(body.socialLinks)
          ? (body.socialLinks as Record<string, unknown>)
          : {},
      audienceSize: typeof body.audienceSize === "string" ? body.audienceSize : null,
      promotionPlan: typeof body.promotionPlan === "string" ? body.promotionPlan : null,
    });
    return NextResponse.json({
      success: true,
      autoApproved: result.autoApproved,
      redirectTo: result.autoApproved ? "/partner/dashboard" : undefined,
      alreadyExisted: result.alreadyExisted,
      linkedExistingUser: result.linkedExistingUser,
      referralCode: result.partner?.referral_code ?? null,
    });
  } catch (err) {
    console.error("[api/partner/apply]", err instanceof Error ? err.message : err);
    return NextResponse.json(GENERIC_ERR, { status: 400 });
  }
}
