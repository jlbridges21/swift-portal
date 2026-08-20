import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getPublicHostContext, lookupBusinessById } from "@/lib/host-resolution";
import { getLoginRedirectOrigin, joinPortalPath } from "@/lib/portal-url";

export async function POST() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.role === "super_admin") {
    return NextResponse.json({ redirect: "/platform" });
  }

  const own = profile.business_id ? await lookupBusinessById(profile.business_id) : null;
  if (!own || own.status !== "active") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "This portal is unavailable. Your business is suspended or no longer active. Contact support if you need access restored.",
      },
      { status: 403 }
    );
  }

  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.trim() ?? "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;
  const publicHost = await getPublicHostContext();

  const destPath = profile.role === "admin" ? "/admin" : "/dashboard";
  // Already on this business's tenant host → relative path is fine.
  // Apex / other hosts → send to canonical {slug}.shootportal.app (prompt 18 + signup).
  const onOwnTenant =
    publicHost.kind === "tenant" && publicHost.businessId === own.id;
  const destOrigin = getLoginRedirectOrigin(
    own,
    { hostname: host, origin },
    { foreignTenantHost: !onOwnTenant }
  );
  const redirect = joinPortalPath(destOrigin, destPath);
  return NextResponse.json({ redirect });
}
