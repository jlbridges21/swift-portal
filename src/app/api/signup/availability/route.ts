import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { validateBusinessSlug } from "@/lib/reserved-subdomains";
import { suggestSlugFromName, nextSlugSuggestion } from "@/lib/signup-validation";
import { getPlatformRootDomain } from "@/lib/site-metadata";

/** Live slug availability for the signup form (platform apex only). */
export async function GET(request: Request) {
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    return NextResponse.json({ error: "Unavailable" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  const rawSlug = searchParams.get("slug") ?? suggestSlugFromName(name);
  const check = validateBusinessSlug(rawSlug);
  if (!check.ok) {
    return NextResponse.json({
      ok: false,
      slug: typeof rawSlug === "string" ? rawSlug : "",
      error: check.error,
      preview: null,
    });
  }

  const raw = await createServiceClient();
  const { data: taken } = await raw.from("businesses").select("id").eq("slug", check.slug).maybeSingle();
  if (!taken) {
    return NextResponse.json({
      ok: true,
      slug: check.slug,
      preview: `${check.slug}.${getPlatformRootDomain()}`,
    });
  }

  let suggestion = check.slug;
  for (let i = 2; i <= 20; i++) {
    const candidate = nextSlugSuggestion(check.slug, i);
    const c = validateBusinessSlug(candidate);
    if (!c.ok) continue;
    const { data: hit } = await raw.from("businesses").select("id").eq("slug", c.slug).maybeSingle();
    if (!hit) {
      suggestion = c.slug;
      break;
    }
  }

  return NextResponse.json({
    ok: false,
    slug: check.slug,
    error: "That subdomain is already taken.",
    suggestion,
    preview: `${suggestion}.${getPlatformRootDomain()}`,
  });
}
