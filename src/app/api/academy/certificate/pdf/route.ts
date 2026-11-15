import { NextResponse } from "next/server";
import { academyApiUser } from "@/lib/academy/api-auth";
import { loadAcademyProgress } from "@/lib/academy/server";
import { academyVerifyUrl, buildAcademyCertificatePdf } from "@/lib/academy/certificate-pdf";
import { getPlatformApexOrigin } from "@/lib/portal-url";

export const dynamic = "force-dynamic";

/** Download the signed-in user's certificate as a PDF. */
export async function GET() {
  const auth = await academyApiUser();
  if (!auth.ok) return auth.response;
  const state = await loadAcademyProgress(auth.profile.id);
  if (!state.certificate) return NextResponse.json({ error: "No certificate yet." }, { status: 404 });
  const pdf = await buildAcademyCertificatePdf(state.certificate, academyVerifyUrl(getPlatformApexOrigin(), state.certificate.code));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ShootPortal-Certificate-${state.certificate.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
