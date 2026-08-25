import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  PARTNER_PAYOUT_DISCREPANCY_ACK,
  listPartnerPayoutsAsPlatform,
  recordPartnerPayout,
} from "@/lib/partner-payouts";
import { getPartnerById } from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payouts = await listPartnerPayoutsAsPlatform(id);
  return NextResponse.json({ payouts });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json();
    const dollars = Number(body.amount);
    const amountCents =
      body.amountCents != null
        ? Math.round(Number(body.amountCents))
        : Number.isFinite(dollars)
          ? Math.round(dollars * 100)
          : NaN;

    const result = await recordPartnerPayout({
      partnerId: id,
      amountCents,
      paidAt: body.paidAt ?? body.paid_at,
      method: body.method ?? null,
      reference: body.reference ?? null,
      note: body.note ?? null,
      idempotencyKey: String(body.idempotencyKey ?? body.idempotency_key ?? ""),
      discrepancyAck:
        body.discrepancyAck === true ||
        body.discrepancyAck === PARTNER_PAYOUT_DISCREPANCY_ACK ||
        body.acknowledgeDiscrepancy === true
          ? PARTNER_PAYOUT_DISCREPANCY_ACK
          : undefined,
      actor: { id: auth.profile.id, email: auth.profile.email },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payout failed" },
      { status: 400 }
    );
  }
}
