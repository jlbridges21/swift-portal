import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  approvePartnerApplication,
  declinePartnerApplication,
} from "@/lib/partners";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (action === "approve") {
      const result = await approvePartnerApplication(
        id,
        {
          referralCode: String(body.referralCode ?? body.referral_code ?? ""),
          commissionRatePct:
            body.commissionRatePct != null
              ? Number(body.commissionRatePct)
              : body.commission_rate_pct != null
                ? Number(body.commission_rate_pct)
                : undefined,
          reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : typeof body.review_note === "string" ? body.review_note : null,
        },
        { id: auth.profile.id, email: auth.profile.email }
      );
      return NextResponse.json(result);
    }

    if (action === "decline") {
      const application = await declinePartnerApplication(
        id,
        typeof body.reviewNote === "string"
          ? body.reviewNote
          : typeof body.review_note === "string"
            ? body.review_note
            : null,
        { id: auth.profile.id, email: auth.profile.email }
      );
      return NextResponse.json({ application });
    }

    return NextResponse.json({ error: "action must be approve or decline" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review failed" },
      { status: 400 }
    );
  }
}
