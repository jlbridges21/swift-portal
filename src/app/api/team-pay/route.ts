import { NextResponse } from "next/server";
import { notifyTeamMember } from "@/lib/notifications";
import { teamPayActor, teamPayFailure } from "@/lib/team-pay/access";
import { formatPeriod } from "@/lib/team-pay/periods";
import {
  addAdjustment,
  approveStatement,
  buildPeriodOverview,
  decideTimeRequest,
  deleteAdjustment,
  markStatementPaid,
  reopenStatement,
  saveShootEdit,
} from "@/lib/team-pay/server";
import { formatCents, formatMinutes } from "@/lib/team-pay/types";

/**
 * Team pay — review and approve (owner, or staff with "Review & approve team pay").
 *
 * GET  ?start=YYYY-MM-DD  → the pay period that date falls in (default: today's), everyone's statement
 * POST { action, ... }    → the same overview after the change
 *   edit_shoot        { proposalId, onsiteMinutes?, driveMinutes?, miles?, amountCents?, note? }  (null = back to planned)
 *   add_adjustment    { userId, dateKey, kind, label, amountCents }
 *   delete_adjustment { adjustmentId }
 *   decide_request    { requestId, approve }
 *   approve | reopen  { userId }
 *   mark_paid         { userId, method?, reference? }   ·   undo_paid { userId }
 */
export async function GET(request: Request) {
  const ctx = await teamPayActor("manager");
  if ("error" in ctx) return ctx.error;
  try {
    const start = new URL(request.url).searchParams.get("start");
    return NextResponse.json(await buildPeriodOverview(ctx.businessId, { start }));
  } catch (err) {
    return teamPayFailure(err);
  }
}

export async function POST(request: Request) {
  const ctx = await teamPayActor("manager", true);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { businessId } = ctx;
  const actorId = ctx.profile.id;
  const start = typeof body.start === "string" ? body.start : null;
  const userId = typeof body.userId === "string" ? body.userId : "";
  // Notifications never block the change itself.
  const tell = (to: string, title: string, text: string) =>
    notifyTeamMember({ businessId, userId: to, type: "team_pay_statement", title, body: text, link: "/admin/my-pay" }).catch(() => null);

  try {
    switch (body.action) {
      case "edit_shoot":
        await saveShootEdit(businessId, actorId, String(body.proposalId ?? ""), body);
        break;
      case "add_adjustment":
        await addAdjustment(businessId, actorId, body);
        break;
      case "delete_adjustment":
        await deleteAdjustment(businessId, String(body.adjustmentId ?? ""));
        break;
      case "decide_request": {
        const decided = await decideTimeRequest(businessId, actorId, String(body.requestId ?? ""), body.approve === true);
        if (decided && decided.userId !== actorId) {
          await tell(
            decided.userId,
            body.approve === true ? "Your time change was approved" : "Your time change wasn't approved",
            body.approve === true
              ? `Your shoot now counts ${formatMinutes(decided.onsiteMinutes)} on site.`
              : "Your shoot stays at its booked time. Ask your manager if that looks wrong."
          );
        }
        break;
      }
      case "approve": {
        if (!start) return NextResponse.json({ error: "Missing pay period." }, { status: 400 });
        const entry = await approveStatement(businessId, actorId, userId, start);
        if (userId !== actorId) {
          await tell(
            userId,
            "Your pay was approved",
            `${formatCents(entry.statement.totals.amountCents)} for ${formatPeriod(entry.statement.period)}.`
          );
        }
        break;
      }
      case "reopen":
        if (!start) return NextResponse.json({ error: "Missing pay period." }, { status: 400 });
        await reopenStatement(businessId, userId, start);
        break;
      case "mark_paid":
      case "undo_paid": {
        if (!start) return NextResponse.json({ error: "Missing pay period." }, { status: 400 });
        const paid = body.action === "mark_paid";
        await markStatementPaid(businessId, userId, start, { method: body.method, reference: body.reference, paid });
        if (paid && userId !== actorId) {
          const method = typeof body.method === "string" && body.method.trim() ? ` by ${body.method.trim()}` : "";
          await tell(userId, "You've been paid", `Your pay for this period was sent${method}.`);
        }
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(await buildPeriodOverview(businessId, { start }));
  } catch (err) {
    return teamPayFailure(err);
  }
}
