import { NextResponse } from "next/server";
import { notifyTeamMember } from "@/lib/notifications";
import { getBusinessOwnerUserId } from "@/lib/staff";
import { teamPayActor, teamPayFailure } from "@/lib/team-pay/access";
import { buildMyPay } from "@/lib/team-pay/my-pay";
import { checkIn, createTimeRequest } from "@/lib/team-pay/server";
import { formatMinutes } from "@/lib/team-pay/types";

/**
 * My pay — a team member's own pay (never anyone else's, never client prices).
 *
 * GET  ?start=YYYY-MM-DD → my statement for that pay period, plus my past statements
 * POST { action: "request_time", proposalId, onsiteMinutes, note? }
 *      { action: "check_in", proposalId, step: "arrive" | "done" }
 */
export async function GET(request: Request) {
  const ctx = await teamPayActor("member");
  if ("error" in ctx) return ctx.error;
  try {
    return NextResponse.json(await buildMyPay(ctx.businessId, ctx.profile.id, new URL(request.url).searchParams.get("start")));
  } catch (err) {
    return teamPayFailure(err);
  }
}

export async function POST(request: Request) {
  const ctx = await teamPayActor("member", true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = ctx.profile.id;
  try {
    if (body.action === "request_time") {
      await createTimeRequest(ctx.businessId, userId, body);
      const ownerId = await getBusinessOwnerUserId(ctx.businessId).catch(() => null);
      if (ownerId && ownerId !== userId) {
        const minutes = Math.round(Number(body.onsiteMinutes)) || 0;
        await notifyTeamMember({
          businessId: ctx.businessId,
          userId: ownerId,
          type: "team_pay_time_request",
          title: `${ctx.profile.full_name || "A team member"} asked for a time change`,
          body: `They were on site ${formatMinutes(minutes)}. Review it in Team pay.`,
          link: "/admin/team-pay",
        }).catch(() => null);
      }
    } else if (body.action === "check_in") {
      await checkIn(ctx.businessId, userId, body);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(await buildMyPay(ctx.businessId, userId, typeof body.start === "string" ? body.start : null));
  } catch (err) {
    return teamPayFailure(err);
  }
}
