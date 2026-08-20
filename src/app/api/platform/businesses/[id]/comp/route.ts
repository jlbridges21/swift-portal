import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { grantCompedAccess, revokeCompedAccess } from "@/lib/platform-comp";

/**
 * POST /api/platform/businesses/[id]/comp
 * Super-admin only (requireSuperAdminApi + /api/platform middleware).
 * Body: { action: "grant" | "revoke", ... }
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      action?: string;
      reason?: string;
      compedUntil?: string | null;
      nextStatus?: "trialing" | "canceled";
      trialEndsAt?: string | null;
      confirm?: string | null;
    };

    if (body.action === "grant") {
      const data = await grantCompedAccess(
        id,
        { reason: body.reason ?? "", compedUntil: body.compedUntil },
        { id: auth.profile.id, email: auth.profile.email }
      );
      return NextResponse.json({ business: data });
    }

    if (body.action === "revoke") {
      const data = await revokeCompedAccess(
        id,
        {
          nextStatus: body.nextStatus ?? "canceled",
          trialEndsAt: body.trialEndsAt,
          confirm: body.confirm,
        },
        { id: auth.profile.id, email: auth.profile.email }
      );
      return NextResponse.json({ business: data });
    }

    return NextResponse.json({ error: "action must be grant or revoke." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Comp update failed";
    const status =
      message.includes("confirm") || message.includes("Super admin")
        ? 400
        : message.includes("not found")
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
