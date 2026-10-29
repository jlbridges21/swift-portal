import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { previewReferralRemoval, removePartnerReferral } from "@/lib/partner-referral-admin";

type RouteParams = { params: Promise<{ id: string; businessId: string }> };

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Super admin: what removing this referral will do (commissions, Stripe discount, timing). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id, businessId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(businessId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const preview = await previewReferralRemoval(id, businessId);
  if (!preview) {
    return NextResponse.json({ error: "This business is not referred by this partner." }, { status: 404 });
  }
  return NextResponse.json({ preview });
}

/**
 * Super admin: Remove Referral Attribution. Requires { confirm: true }.
 * Idempotent — repeating returns already_removed and changes nothing (except finishing a
 * Stripe discount removal that previously failed).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id, businessId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(businessId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown; reason?: unknown };
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }
  try {
    const result = await removePartnerReferral({
      partnerId: id,
      businessId,
      reason: typeof body.reason === "string" ? body.reason : null,
      actor: { id: auth.profile.id, email: auth.profile.email ?? null },
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not remove referral." },
      { status: 400 }
    );
  }
}
