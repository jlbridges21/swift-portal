import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  applyRolloutAction,
  loadRolloutAnalytics,
  loadRolloutConfig,
  RolloutSetupRequiredError,
  type RolloutAction,
} from "@/lib/ui-rollout-server";
import { effectivePhase } from "@/lib/ui-rollout";

export const dynamic = "force-dynamic";

/** Current rollout config, effective phase, and adoption counts. Super-admin only. */
export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const [config, analytics] = await Promise.all([loadRolloutConfig(), loadRolloutAnalytics()]);
  return NextResponse.json(
    { config, phase: effectivePhase(config), analytics },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function parseAction(body: Record<string, unknown> | null): RolloutAction | null {
  switch (body?.action) {
    case "activate":
    case "new_only":
    case "rollback":
    case "resume_optional":
    case "reset_classic":
      return { action: body.action };
    case "delay":
      return { action: "delay", days: Number(body.days) };
    case "set_transition":
      return typeof body.transitionAt === "string" ? { action: "set_transition", transitionAt: body.transitionAt } : null;
    default:
      return null;
  }
}

/** Change the global rollout. Super-admin only; every change is written to the audit log. */
export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = parseAction(body);
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  try {
    const { before, after } = await applyRolloutAction(action, auth.profile.id);
    await writePlatformAudit({
      actorUserId: auth.profile.id,
      actorEmail: auth.profile.email ?? null,
      action: `ui_rollout.${action.action}`,
      targetType: "ui_rollout",
      targetId: "global",
      metadata: { before, after, ...(action.action === "delay" ? { days: action.days } : {}) },
    });
    const config = await loadRolloutConfig();
    return NextResponse.json({ config: { ...config, ...after }, phase: effectivePhase({ ...config, ...after }) });
  } catch (err) {
    if (err instanceof RolloutSetupRequiredError) {
      return NextResponse.json({ error: err.message, setupRequired: true }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the rollout." }, { status: 400 });
  }
}
