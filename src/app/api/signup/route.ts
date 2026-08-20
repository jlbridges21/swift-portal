import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { validateBusinessSlug, isReservedPlatformSubdomain } from "@/lib/reserved-subdomains";
import { createBusinessForPlatform, SYSTEM_SIGNUP_ACTOR } from "@/lib/platform-onboard";
import { allowSignupAttempt, allowSignupSuccess } from "@/lib/signup-rate-limit";
import {
  isDisposableEmail,
  isPlausibleEmail,
  isValidSignupPassword,
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

function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Public self-serve signup. Platform apex only.
 * Creates business first, then password user with business_id in metadata.
 */
export async function POST(request: Request) {
  const requestId = newSignupRequestId();
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    return signupErrorResponse("forbidden_host", requestId, {
      status: 403,
      message: "Sign up is only available on shootportal.app.",
    });
  }

  const h = await headers();
  const ip = clientIp(h);
  if (!allowSignupAttempt(ip)) {
    return signupErrorResponse("rate_limited", requestId, {
      ip,
      message: "Too many signup attempts. Try again later.",
    });
  }

  let body: {
    name?: string;
    slug?: string;
    email?: string;
    password?: string;
    ownerName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      detail: "invalid_json",
    });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ownerName =
    typeof body.ownerName === "string" && body.ownerName.trim()
      ? body.ownerName.trim()
      : name;
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

  if (email && isDisposableEmail(email)) {
    return signupErrorResponse("disposable_email", requestId, {
      ip,
      slug: slugRaw || null,
      detail: "disposable_domain",
    });
  }
  if (!isPlausibleEmail(email)) {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      slug: slugRaw || null,
      detail: "invalid_email",
    });
  }
  if (!isValidSignupPassword(password)) {
    return signupErrorResponse("validation_failed", requestId, {
      ip,
      slug: slugRaw || null,
      detail: "invalid_password",
      message: "Password must be at least 8 characters.",
      status: 400,
    });
  }

  const slugCheck = validateBusinessSlug(slugRaw);
  if (!slugCheck.ok) {
    const reserved = isReservedPlatformSubdomain(slugRaw);
    return signupErrorResponse(reserved ? "reserved_slug" : "validation_failed", requestId, {
      ip,
      slug: typeof slugRaw === "string" ? slugRaw : null,
      detail: slugCheck.error,
      // Reserved / format errors are safe to show (no account enumeration).
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

  const { data: list } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailTaken = list.users.some((u) => u.email?.toLowerCase() === email);
  if (emailTaken) {
    return signupErrorResponse("email_exists", requestId, {
      ip,
      slug: slugCheck.slug,
      detail: "auth_user_exists",
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
        password,
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );

    allowSignupSuccess(ip);

    return NextResponse.json({
      ok: true,
      slug: result.slug,
      portalUrl: result.portalUrl,
      requiresEmailConfirmation: result.requiresEmailConfirmation !== false,
      requestId,
      message:
        "Check your email to confirm your account, then sign in to open your portal.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const authFailed =
      /could not create account|email rate limit|signups not allowed|user already|invalid.*email/i.test(
        msg
      );
    logSignupFailure({
      reason: authFailed ? "auth_create_failed" : "provisioning_failed",
      requestId,
      slug: slugCheck.slug,
      detail: msg.slice(0, 240),
      ip,
    });
    return NextResponse.json(
      {
        error: SIGNUP_GENERIC_ERROR,
        code: authFailed ? "auth_create_failed" : "provisioning_failed",
        requestId,
      },
      { status: 400 }
    );
  }
}
