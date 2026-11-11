import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isActiveStaff, isOwnerAdmin } from "@/lib/staff-access";
import { dismissRolloutBanner, RolloutSetupRequiredError } from "@/lib/ui-rollout-server";

export const dynamic = "force-dynamic";

/** Remember that the signed-in business user dismissed a rollout banner. Body: { banner }. */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(isOwnerAdmin(profile) || isActiveStaff(profile))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { banner?: unknown } | null;
  const banner = body?.banner === "try_new" || body?.banner === "welcome_new" ? body.banner : null;
  if (!banner) return NextResponse.json({ error: "Unknown banner." }, { status: 400 });
  try {
    await dismissRolloutBanner(profile.id, banner);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RolloutSetupRequiredError) return NextResponse.json({ ok: false, setupRequired: true });
    console.error("[ui-preference/dismiss]", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
