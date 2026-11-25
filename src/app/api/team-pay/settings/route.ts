import { NextResponse } from "next/server";
import { loadTeam } from "@/lib/booking/team";
import { teamPayActor, teamPayFailure } from "@/lib/team-pay/access";
import {
  deletePlan,
  listPayServices,
  loadTeamPayConfig,
  saveMember,
  savePlan,
  saveTeamPaySettings,
} from "@/lib/team-pay/server";

/**
 * Team pay setup (business owner only).
 *
 * GET   → { ready, settings, plans, members, team, services }
 * PATCH { ...settings fields }                       → { settings }
 * POST  { action: "save_plan", plan }                → { plan }
 *       { action: "delete_plan", planId }            → { ok }
 *       { action: "save_member", member }            → { member }
 */
export async function GET() {
  const ctx = await teamPayActor("owner");
  if ("error" in ctx) return ctx.error;
  try {
    const [config, team, services] = await Promise.all([
      loadTeamPayConfig(ctx.businessId),
      loadTeam(ctx.businessId),
      listPayServices(ctx.businessId),
    ]);
    return NextResponse.json({
      ...config,
      team: team.members.map((m) => ({ userId: m.userId, name: m.name || m.email, email: m.email, avatarUrl: m.avatarUrl, role: m.role })),
      services,
    });
  } catch (err) {
    return teamPayFailure(err);
  }
}

export async function PATCH(request: Request) {
  const ctx = await teamPayActor("owner", true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json({ settings: await saveTeamPaySettings(ctx.businessId, body) });
  } catch (err) {
    return teamPayFailure(err);
  }
}

export async function POST(request: Request) {
  const ctx = await teamPayActor("owner", true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "save_plan") {
      return NextResponse.json({ plan: await savePlan(ctx.businessId, (body.plan ?? {}) as Record<string, unknown>) });
    }
    if (body.action === "delete_plan") {
      await deletePlan(ctx.businessId, String(body.planId ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "save_member") {
      return NextResponse.json({ member: await saveMember(ctx.businessId, (body.member ?? {}) as Record<string, unknown>) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return teamPayFailure(err);
  }
}
