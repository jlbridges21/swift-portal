/**
 * Integration: processBusinessLifecycle dry-run against live DB (no Resend sends).
 * Proves Swift/comped skip and offset matching.
 *
 *   npx tsx scripts/verify-platform-lifecycle-db.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

import { createServiceClient } from "../src/lib/supabase/server";
import {
  loadActiveLifecycleTemplates,
  processBusinessLifecycle,
  type LifecycleBusinessRow,
} from "../src/lib/platform-lifecycle";
import { getPlatformLifecycleFromHeader } from "../src/lib/platform-email";
import { SWIFT_COMP_PROTECTED_BUSINESS_ID } from "../src/lib/platform-session";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

async function main() {
  const supabase = await createServiceClient();
  const templates = await loadActiveLifecycleTemplates();
  assert(templates.length >= 7, `active templates (${templates.length})`);

  const { data: swift } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, status, deleted_at, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, billing_email, lifecycle_emails_suppressed"
    )
    .eq("id", SWIFT_COMP_PROTECTED_BUSINESS_ID)
    .single();

  assert(swift.subscription_status === "comped", "Swift is comped");

  // Bait: trial dates that would fire trial_ending_7d if not comped.
  const bait = {
    ...(swift as LifecycleBusinessRow),
    trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const swiftSummary = await processBusinessLifecycle({
    business: bait,
    templates,
    dryRun: true,
  });
  assert(swiftSummary.ok, "Swift sweep ok");
  assert(
    swiftSummary.actions.some((a) => a.action === "skipped" && a.reason === "comped"),
    `Swift skipped as comped: ${JSON.stringify(swiftSummary.actions)}`
  );
  assert(
    !swiftSummary.actions.some((a) => a.action === "sent"),
    "Swift must not send under any template"
  );

  const { count } = await supabase
    .from("platform_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("business_id", SWIFT_COMP_PROTECTED_BUSINESS_ID)
    .eq("is_test", false);
  assert((count ?? 0) === 0, `Swift zero real sends (count=${count})`);

  // Non-comped throwaway: pick first active non-comped non-Swift business
  const { data: candidate } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, status, deleted_at, plan, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end, billing_email, lifecycle_emails_suppressed"
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", SWIFT_COMP_PROTECTED_BUSINESS_ID)
    .neq("subscription_status", "comped")
    .limit(1)
    .maybeSingle();

  if (candidate) {
    const in7 = {
      ...(candidate as LifecycleBusinessRow),
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lifecycle_emails_suppressed: false,
    };
    const s7 = await processBusinessLifecycle({
      business: in7,
      templates,
      dryRun: true,
    });
    assert(
      s7.actions.some((a) => a.action === "sent" && a.templateKey === "trial_ending_7d"),
      `dry-run fires trial_ending_7d: ${JSON.stringify(s7.actions)}`
    );

    const suppressed = { ...in7, lifecycle_emails_suppressed: true };
    const sSup = await processBusinessLifecycle({
      business: suppressed,
      templates,
      dryRun: true,
    });
    assert(
      sSup.actions.some((a) => a.action === "skipped" && a.reason === "suppressed"),
      "suppressed skips sends"
    );
    assert(!sSup.actions.some((a) => a.action === "sent"), "suppressed sends nothing");
  } else {
    console.log("SKIP: no non-comped business for offset dry-run");
  }

  const from = getPlatformLifecycleFromHeader();
  assert(from.includes("noreply@") || from.toLowerCase().includes("shootportal"), `From=${from}`);
  console.log("Platform From header:", from);
  console.log("verify-platform-lifecycle-db: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
