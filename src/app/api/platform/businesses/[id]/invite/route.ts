import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { inviteBusinessAdmin } from "@/lib/platform-onboard";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { email?: string; fullName?: string; resend?: boolean };
    if (!body.email) return NextResponse.json({ error: "email is required" }, { status: 400 });
    const result = await inviteBusinessAdmin(
      id,
      body.email,
      body.fullName || body.email,
      { id: auth.profile.id, email: auth.profile.email },
      { resend: Boolean(body.resend) }
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[platform-invite] reason=invite_route_failed", {
      event: "platform_invite_failure",
      businessId: id,
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invite failed" },
      { status: 400 }
    );
  }
}
