import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { recordConversionEvent, recordTrialModalAction, type TrialModalAction } from "@/lib/billing-journey";
import { isTrialMilestone } from "@/lib/trial-conversion";

export const runtime = "nodejs";

const ACTIONS: ReadonlySet<TrialModalAction> = new Set(["viewed", "dismissed", "cta"]);

/** Persist trial modal view / dismiss / CTA so a milestone shows at most once per trial. */
export async function POST(request: Request) {
  try {
    const profile = await requireAdmin({ adminOnly: true });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    // Support impersonation must never consume a customer's milestone.
    if (tenant.impersonating) return NextResponse.json({ ok: true, skipped: "impersonating" });

    const body = (await request.json().catch(() => ({}))) as {
      milestone?: unknown;
      action?: unknown;
      trialDay?: unknown;
    };
    if (!isTrialMilestone(body.milestone) || typeof body.action !== "string" || !ACTIONS.has(body.action as TrialModalAction)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const action = body.action as TrialModalAction;
    const milestone = body.milestone;
    await recordTrialModalAction({ businessId: tenant.businessId, userId: profile.id, milestone, action });

    const trialDay = typeof body.trialDay === "number" && body.trialDay > 0 && body.trialDay < 400 ? Math.floor(body.trialDay) : null;
    if (action === "viewed" || action === "dismissed") {
      await recordConversionEvent({
        businessId: tenant.businessId,
        type: action === "viewed" ? "trial_modal_viewed" : "trial_modal_dismissed",
        dedupeKey: `trial_modal_${action}:${tenant.businessId}:${profile.id}:${milestone}`,
        properties: { milestone, trial_day: trialDay },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
