import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  loadActiveLifecycleTemplates,
  processBusinessLifecycle,
  type LifecycleBusinessRow,
  type BusinessLifecycleSummary,
} from "@/lib/platform-lifecycle";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";

/**
 * ShootPortal → business lifecycle emails (trial / billing).
 * Separate from /api/cron/workflow-reminders (business → client).
 *
 * Guard: Vercel Cron sends Authorization: Bearer CRON_SECRET when that env is set.
 * GET /api/cron/platform-lifecycle
 * GET /api/cron/platform-lifecycle?dryRun=1
 *
 * Idempotency: platform_email_sends unique (business_id, template_key, event_date) WHERE NOT is_test.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const dryRun = cronDryRunRequested(request);

  const supabase = await createServiceClient();
  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, status, deleted_at, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, billing_email, lifecycle_emails_suppressed"
    )
    .eq("status", "active")
    .is("deleted_at", null);

  if (businessesError) {
    console.error("[cron/platform-lifecycle] failed to list businesses:", businessesError.message);
    return NextResponse.json({ error: "Failed to list businesses" }, { status: 500 });
  }

  let templates;
  try {
    templates = await loadActiveLifecycleTemplates();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/platform-lifecycle] failed to load templates:", message);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }

  const summaries: BusinessLifecycleSummary[] = [];
  let sent = 0;
  let skippedComped = 0;

  for (const row of businesses ?? []) {
    const business = row as LifecycleBusinessRow;
    try {
      const summary = await processBusinessLifecycle({ business, templates, dryRun });
      summaries.push(summary);
      if (summary.actions.some((a) => a.action === "skipped" && a.reason === "comped")) {
        skippedComped += 1;
      }
      sent += summary.actions.filter((a) => a.action === "sent").length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cron/platform-lifecycle] business sweep failed", {
        businessId: business.id,
        error: message,
      });
      summaries.push({
        businessId: business.id,
        businessName: business.name,
        ok: false,
        actions: [],
        error: message,
      });
    }
  }

  return NextResponse.json({
    dryRun,
    processed: summaries.length,
    sent,
    skippedComped,
    templatesActive: templates.length,
    businesses: summaries,
  });
}
