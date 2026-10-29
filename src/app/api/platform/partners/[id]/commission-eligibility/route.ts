import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { setPartnerCommissionEligibility } from "@/lib/partner-referral-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** Super admin only: turn a partner's commission eligibility on or off (audit logged). */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { eligible?: unknown; note?: unknown };
  if (typeof body.eligible !== "boolean") {
    return NextResponse.json({ error: "eligible must be true or false." }, { status: 400 });
  }
  try {
    const partner = await setPartnerCommissionEligibility({
      partnerId: id,
      eligible: body.eligible,
      note: typeof body.note === "string" ? body.note : null,
      actor: { id: auth.profile.id, email: auth.profile.email ?? null },
    });
    return NextResponse.json({ partner });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update eligibility." },
      { status: 400 }
    );
  }
}
