import { NextResponse } from "next/server";
import { academyApiUser } from "@/lib/academy/api-auth";
import { AcademySetupRequiredError, issueAcademyCertificate } from "@/lib/academy/server";

export const dynamic = "force-dynamic";

/** Issue (or return) the signed-in user's certificate once every lesson is complete. */
export async function POST() {
  const auth = await academyApiUser();
  if (!auth.ok) return auth.response;
  if (auth.tenant.impersonating) return NextResponse.json({ ok: false, readOnly: true });
  try {
    const certificate = await issueAcademyCertificate({
      userId: auth.profile.id,
      businessId: auth.tenant.businessId,
      holderName: auth.profile.full_name?.trim() || auth.profile.email || "ShootPortal user",
      businessName: auth.tenant.business.name ?? null,
    });
    if (!certificate) return NextResponse.json({ ok: false, incomplete: true });
    return NextResponse.json({ ok: true, certificate });
  } catch (err) {
    if (err instanceof AcademySetupRequiredError) return NextResponse.json({ ok: false, setupRequired: true });
    console.error("[academy/certificate]", err);
    return NextResponse.json({ error: "Could not issue the certificate." }, { status: 500 });
  }
}
