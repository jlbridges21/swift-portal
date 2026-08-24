import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  PARTNER_ADJUST_DEBIT_CONFIRM,
  createPartnerAdjustment,
} from "@/lib/partner-payouts";
import { getPartnerById } from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const dollars = Number(body.amount);
    const amountCents =
      body.amountCents != null
        ? Math.round(Number(body.amountCents))
        : Number.isFinite(dollars)
          ? Math.round(dollars * 100)
          : NaN;

    const result = await createPartnerAdjustment({
      partnerId: id,
      amountCents,
      note: String(body.note ?? ""),
      confirm:
        body.confirm === PARTNER_ADJUST_DEBIT_CONFIRM
          ? PARTNER_ADJUST_DEBIT_CONFIRM
          : body.confirm,
      actor: { id: auth.profile.id, email: auth.profile.email },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Adjustment failed" },
      { status: 400 }
    );
  }
}
