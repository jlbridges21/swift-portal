import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  sendBusinessAdminPasswordReset,
  setBusinessAdminTempPassword,
} from "@/lib/platform-admin-recovery";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const { id: businessId, userId } = await context.params;
  let body: { action?: string; confirm?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.action === "send_reset") {
      const result = await sendBusinessAdminPasswordReset(businessId, userId, {
        id: auth.profile.id,
        email: auth.profile.email,
      });
      return NextResponse.json(result);
    }
    if (body.action === "set_temp_password") {
      const result = await setBusinessAdminTempPassword(
        businessId,
        userId,
        { id: auth.profile.id, email: auth.profile.email },
        typeof body.confirm === "string" ? body.confirm : ""
      );
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery failed" },
      { status: 400 }
    );
  }
}
