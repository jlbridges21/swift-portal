import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { loadEconomicsSettings, saveEconomicsSettings } from "@/lib/platform-economics";
import { writePlatformAudit } from "@/lib/platform-audit";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await loadEconomicsSettings());
}

/** Cost assumptions used by Platform Economics. Analysis only — never touches billing. */
export async function PUT(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { assumptions?: unknown };
    const assumptions = await saveEconomicsSettings(body.assumptions, auth.profile.email ?? null);
    await writePlatformAudit({
      actorUserId: auth.profile.id,
      actorEmail: auth.profile.email,
      action: "economics.assumptions_updated",
      targetBusinessId: null,
      targetType: "platform",
      targetId: null,
      metadata: { assumptions },
    });
    return NextResponse.json({ assumptions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}
