import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/app-settings";
import { teamPayActor, teamPayFailure } from "@/lib/team-pay/access";
import { hideClientPrices } from "@/lib/team-pay/my-pay";
import { buildPeriodOverview } from "@/lib/team-pay/server";
import { buildPayStubPdf } from "@/lib/team-pay/stub-pdf";

export const runtime = "nodejs";

/**
 * GET ?start=YYYY-MM-DD[&user=<id>] → a pay statement PDF.
 * A team member gets their own; the owner (or staff who approve pay) can ask for anyone's.
 */
export async function GET(request: Request) {
  const ctx = await teamPayActor("member");
  if ("error" in ctx) return ctx.error;
  const url = new URL(request.url);
  const requested = url.searchParams.get("user");
  const userId = requested && requested !== ctx.profile.id ? requested : ctx.profile.id;
  if (userId !== ctx.profile.id && !ctx.manager) {
    return NextResponse.json({ error: "You can only open your own pay stub." }, { status: 403 });
  }
  try {
    const [overview, settings] = await Promise.all([
      buildPeriodOverview(ctx.businessId, { start: url.searchParams.get("start"), onlyUserId: userId }),
      getAppSettings(ctx.businessId),
    ]);
    const found = overview.settings.enabled ? overview.people.find((p) => p.person.userId === userId) : null;
    if (!found) return NextResponse.json({ error: "No pay statement for that pay period." }, { status: 404 });
    // The copy a team member opens never shows what the client paid.
    const entry = ctx.manager ? found : hideClientPrices(found);
    const pdf = await buildPayStubPdf({
      businessName: settings.business.businessName || ctx.tenant.business.name || "",
      personName: entry.person.name,
      workerType: entry.person.workerType,
      planSummary: entry.planSummary,
      statement: entry.statement,
    });
    const name = entry.person.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="pay-statement_${name}_${overview.period.start}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return teamPayFailure(err);
  }
}
