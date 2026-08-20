import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { validateBusinessSlug } from "@/lib/reserved-subdomains";
import { createBusinessForPlatform, SYSTEM_SIGNUP_ACTOR } from "@/lib/platform-onboard";
import { allowSignupAttempt, allowSignupSuccess } from "@/lib/signup-rate-limit";
import {
  isPlausibleEmail,
  isValidSignupPassword,
  nextSlugSuggestion,
  suggestSlugFromName,
} from "@/lib/signup-validation";
import { getPlatformRootDomain } from "@/lib/site-metadata";

const GENERIC_ERROR = "We couldn’t create your account. Check your details and try again.";

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
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    return NextResponse.json(
      { error: "Sign up is only available on shootportal.app." },
      { status: 403 }
    );
  }

  const h = await headers();
  const ip = clientIp(h);
  if (!allowSignupAttempt(ip)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (!isValidSignupPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const slugCheck = validateBusinessSlug(slugRaw);
  if (!slugCheck.ok) {
    return NextResponse.json({ error: slugCheck.error }, { status: 400 });
  }

  const raw = await createServiceClient();

  // Slug uniqueness with suggestion
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
    return NextResponse.json(
      {
        error: "That subdomain is already taken.",
        suggestion,
        preview: `${suggestion}.${getPlatformRootDomain()}`,
      },
      { status: 409 }
    );
  }

  // Do not reveal whether email already exists — generic failure
  const { data: list } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailTaken = list.users.some((u) => u.email?.toLowerCase() === email);
  if (emailTaken) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Soft-check success quota before create; only increment after success.
  if (!allowSignupSuccess(ip, { peek: true })) {
    return NextResponse.json(
      { error: "Too many accounts created from this network. Try again later." },
      { status: 429 }
    );
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
      message:
        "Check your email to confirm your account, then sign in to open your portal.",
    });
  } catch (error) {
    console.error("[signup]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}
