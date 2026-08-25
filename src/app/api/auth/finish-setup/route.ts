import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getPublicHostContext } from "@/lib/host-resolution";
import { validateBusinessSlug, isReservedPlatformSubdomain } from "@/lib/reserved-subdomains";
import { createBusinessForPlatform } from "@/lib/platform-onboard";
import { allowSignupAttempt, allowSignupSuccess } from "@/lib/signup-rate-limit";
import {
  isDisposableEmail,
  isPlausibleEmail,
  nextSlugSuggestion,
  suggestSlugFromName,
} from "@/lib/signup-validation";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import {
  newSignupRequestId,
  signupErrorResponse,
  SIGNUP_GENERIC_ERROR,
  logSignupFailure,
} from "@/lib/signup-errors";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { lookupBusinessById } from "@/lib/host-resolution";
import { adminHomePath } from "@/lib/onboarding";
import { getBusinessPortalOrigin, joinPortalPath } from "@/lib/portal-url";

function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Complete OAuth studio setup for an authenticated user with no business_id.
 * Apex only. Reuses createBusinessForPlatform with existingUserId.
 */
export async function POST(request: Request) {
  const requestId = newSignupRequestId();
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    return signupErrorResponse("forbidden_host", requestId, {
      status: 403,
      message: "Finish setup is only available on shootportal.app.",
    });
  }

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  if (profile.role === "super_admin") {
    return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
  }

  if (profile.business_id) {
    const biz = await lookupBusinessById(profile.business_id);
    const path = adminHomePath({
      onboardingCompletedAt: biz?.onboarding_completed_at,
      onboardingState: biz?.onboarding_state,
    });
    const portalUrl = biz
      ? getBusinessPortalOrigin(biz)
      : `https://${getPlatformRootDomain()}`;
    return NextResponse.json({
      ok: true,
      alreadyProvisioned: true,
      redirect: joinPortalPath(portalUrl, path),
      requestId,
    });
  }

  const partnerAccess = await resolvePartnerAccess(profile.id);
  if (partnerAccess.kind === "active" || partnerAccess.kind === "suspended") {
    return NextResponse.json(
      {
        error: "This account is a partner account. Open the partner dashboard instead.",
        code: "is_partner",
        redirect: "/partner",
        requestId,
      },
      { status: 409 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  const h = await headers();
  const ip = clientIp(h);
  if (!allowSignupAttempt(ip)) {
    return signupErrorResponse("rate_limited", requestId, {
      ip,
      message: "Too many signup attempts. Try again later.",
    });
  }

  let body: { name?: string; slug?: string; ownerName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      detail: "invalid_json",
    });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = user.email.trim().toLowerCase();
  const ownerName =
    typeof body.ownerName === "string" && body.ownerName.trim()
      ? body.ownerName.trim()
      : profile.full_name?.trim() || name;
  const slugRaw =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : suggestSlugFromName(name);

  if (!name || name.length < 2 || name.length > 120) {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      slug: slugRaw || null,
      detail: "invalid_name",
    });
  }

  if (isDisposableEmail(email) || !isPlausibleEmail(email)) {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      slug: slugRaw || null,
      detail: "invalid_email",
    });
  }

  const slugCheck = validateBusinessSlug(slugRaw);
  if (!slugCheck.ok) {
    const reserved = isReservedPlatformSubdomain(slugRaw);
    return signupErrorResponse(reserved ? "reserved_slug" : "validation_failed", requestId, {
      ip,
      slug: typeof slugRaw === "string" ? slugRaw : null,
      detail: slugCheck.error,
      message: slugCheck.error,
    });
  }

  const raw = await createServiceClient();
  const { data: slugTaken } = await raw
    .from("businesses")
    .select("id")
    .eq("slug", slugCheck.slug)
    .maybeSingle();
  if (slugTaken) {
    let suggestion = slugCheck.slug;
    for (let i = 2; i <= 20; i++) {
      const candidate = nextSlugSuggestion(slugCheck.slug, i);
      const check = validateBusinessSlug(candidate);
      if (!check.ok) continue;
      const { data: hit } = await raw.from("businesses").select("id").eq("slug", check.slug).maybeSingle();
      if (!hit) {
        suggestion = check.slug;
        break;
      }
    }
    return signupErrorResponse("slug_taken", requestId, {
      ip,
      slug: slugCheck.slug,
      status: 409,
      message: "That subdomain is already taken.",
      extra: {
        suggestion,
        preview: `${suggestion}.${getPlatformRootDomain()}`,
      },
    });
  }

  if (!allowSignupSuccess(ip, { peek: true })) {
    return signupErrorResponse("rate_limited", requestId, {
      ip,
      slug: slugCheck.slug,
      message: "Too many accounts created from this network. Try again later.",
      detail: "success_quota",
    });
  }

  try {
    const result = await createBusinessForPlatform(
      {
        name,
        slug: slugCheck.slug,
        plan: "studio",
        adminEmail: email,
        adminName: ownerName,
        source: "signup",
        existingUserId: user.id,
      },
      { id: user.id, email }
    );

    allowSignupSuccess(ip);

    const path = "/onboarding";
    return NextResponse.json({
      ok: true,
      slug: result.slug,
      portalUrl: result.portalUrl,
      redirect: joinPortalPath(result.portalUrl, path),
      requestId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logSignupFailure({
      reason: "provisioning_failed",
      requestId,
      slug: slugCheck.slug,
      detail: msg.slice(0, 240),
      ip,
    });
    return NextResponse.json(
      {
        error: SIGNUP_GENERIC_ERROR,
        code: "provisioning_failed",
        requestId,
        message: msg.slice(0, 160),
      },
      { status: 400 }
    );
  }
}
