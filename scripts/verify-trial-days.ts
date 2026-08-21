/**
 * Verify editable plan trial_days (migration v51).
 * Run: npx tsx scripts/verify-trial-days.ts
 *
 * Snapshots an existing trialing business, provisions signups at 14 / 21 / 0,
 * confirms existing trial_ends_at is unchanged, then restores studio to 14
 * and deletes test rows.
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
process.env.SIGNUP_TEST_NO_EMAIL = "1";

import {
  createBusinessForPlatform,
  SYSTEM_SIGNUP_ACTOR,
} from "../src/lib/platform-onboard";
import { createServiceClient } from "../src/lib/supabase/server";
import { getSubscriptionState } from "../src/lib/subscription";
import { PROTECTED_PRODUCTION_BUSINESS_IDS } from "../src/lib/platform-session";

function daysFromNow(iso: string | null): number {
  if (!iso) return NaN;
  return (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
}

async function setStudioTrialDays(days: number) {
  const raw = await createServiceClient();
  const { error } = await raw.from("plans").update({ trial_days: days }).eq("key", "studio");
  if (error) throw new Error(error.message);
}

async function cleanupBusiness(businessId: string, email: string) {
  const raw = await createServiceClient();
  const { data: profile } = await raw
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  await raw.from("business_services").delete().eq("business_id", businessId);
  await raw.from("business_integrations").delete().eq("business_id", businessId);
  await raw.from("business_settings").delete().eq("business_id", businessId);
  await raw.from("platform_audit_log").delete().eq("target_business_id", businessId);
  if (profile?.id) {
    try {
      await raw.auth.admin.deleteUser(profile.id);
    } catch {
      /* best-effort */
    }
    await raw.from("profiles").delete().eq("id", profile.id);
  }
  await raw.from("businesses").delete().eq("id", businessId);
}

async function main() {
  const raw = await createServiceClient();
  const stamp = Date.now().toString(36);
  const created: Array<{ id: string; email: string }> = [];

  const { data: plans } = await raw.from("plans").select("key, trial_days").order("key");
  if (!plans?.length) throw new Error("no plans");
  for (const p of plans) {
    if (p.trial_days !== 14 && p.key === "studio") {
      // may already be mid-test; we'll set explicitly
    }
  }
  console.log(
    "plans trial_days:",
    plans.map((p) => `${p.key}=${p.trial_days}`).join(", ")
  );

  // Snapshot an existing trialing business (if any) — must not change when we edit plan.
  const { data: existingTrial } = await raw
    .from("businesses")
    .select("id, slug, trial_ends_at, subscription_status")
    .eq("subscription_status", "trialing")
    .not("trial_ends_at", "is", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const existingSnapshot = existingTrial?.trial_ends_at ?? null;
  if (existingTrial) {
    console.log(
      `snapshot existing trialing ${existingTrial.slug} trial_ends_at=${existingSnapshot}`
    );
  } else {
    console.log("no existing trialing business to snapshot (ok)");
  }

  // Swift / Test Pilot untouched checks
  for (const id of PROTECTED_PRODUCTION_BUSINESS_IDS) {
    const { data: biz } = await raw
      .from("businesses")
      .select("id, slug, name, subscription_status, trial_ends_at, comped_until, plan")
      .eq("id", id)
      .maybeSingle();
    if (!biz) {
      console.log(`protected id ${id}: not found (skip)`);
      continue;
    }
    console.log(
      `protected ${biz.slug}: status=${biz.subscription_status} plan=${biz.plan} comped_until=${biz.comped_until}`
    );
  }

  await setStudioTrialDays(14);
  {
    const email = `trial14-${stamp}@example.com`;
    const slug = `trial14-${stamp}`;
    const createdBiz = await createBusinessForPlatform(
      {
        name: `Trial 14 ${stamp}`,
        slug,
        adminEmail: email,
        password: "VerifyTrial14!",
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );
    created.push({ id: createdBiz.businessId, email });
    const { data: biz } = await raw
      .from("businesses")
      .select("subscription_status, trial_ends_at")
      .eq("id", createdBiz.businessId)
      .single();
    const d = daysFromNow(biz!.trial_ends_at);
    if (biz!.subscription_status !== "trialing") throw new Error(`14: status=${biz!.subscription_status}`);
    if (d < 13 || d > 15) throw new Error(`14: days=${d}`);
    console.log(`ok signup@14 → trialing ~${d.toFixed(2)} days`);
  }

  await setStudioTrialDays(21);
  {
    const email = `trial21-${stamp}@example.com`;
    const slug = `trial21-${stamp}`;
    const createdBiz = await createBusinessForPlatform(
      {
        name: `Trial 21 ${stamp}`,
        slug,
        adminEmail: email,
        password: "VerifyTrial21!",
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );
    created.push({ id: createdBiz.businessId, email });
    const { data: biz } = await raw
      .from("businesses")
      .select("subscription_status, trial_ends_at")
      .eq("id", createdBiz.businessId)
      .single();
    const d = daysFromNow(biz!.trial_ends_at);
    if (biz!.subscription_status !== "trialing") throw new Error(`21: status=${biz!.subscription_status}`);
    if (d < 20 || d > 22) throw new Error(`21: days=${d}`);
    console.log(`ok signup@21 → trialing ~${d.toFixed(2)} days (no deploy)`);
  }

  if (existingTrial && existingSnapshot) {
    const { data: after } = await raw
      .from("businesses")
      .select("trial_ends_at")
      .eq("id", existingTrial.id)
      .single();
    if (after!.trial_ends_at !== existingSnapshot) {
      throw new Error(
        `EXISTING trial_ends_at CHANGED: was ${existingSnapshot} now ${after!.trial_ends_at}`
      );
    }
    console.log("ok existing trialing business trial_ends_at UNCHANGED after plan edit");
  }

  // First signup at 14 should still be ~14, not rewritten to 21
  {
    const first = created[0];
    const { data: biz } = await raw
      .from("businesses")
      .select("trial_ends_at")
      .eq("id", first.id)
      .single();
    const d = daysFromNow(biz!.trial_ends_at);
    if (d < 13 || d > 15) throw new Error(`first signup rewritten? days=${d}`);
    console.log("ok prior signup @14 still ~14 after studio→21");
  }

  await setStudioTrialDays(0);
  {
    const email = `trial0-${stamp}@example.com`;
    const slug = `trial0-${stamp}`;
    const createdBiz = await createBusinessForPlatform(
      {
        name: `Trial 0 ${stamp}`,
        slug,
        adminEmail: email,
        password: "VerifyTrial0!",
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );
    created.push({ id: createdBiz.businessId, email });
    const { data: biz } = await raw
      .from("businesses")
      .select("subscription_status, trial_ends_at, plan")
      .eq("id", createdBiz.businessId)
      .single();
    if (biz!.subscription_status !== "trial_expired") {
      throw new Error(`0: expected trial_expired got ${biz!.subscription_status}`);
    }
    if (biz!.trial_ends_at != null) {
      throw new Error(`0: expected null trial_ends_at got ${biz!.trial_ends_at}`);
    }
    const state = getSubscriptionState({
      subscription_status: biz!.subscription_status,
      trial_ends_at: biz!.trial_ends_at,
      plan: biz!.plan,
    });
    if (!state.requiresPayment) throw new Error("0: expected requiresPayment");
    console.log("ok signup@0 → trial_expired, trial_ends_at=null, requiresPayment");
  }

  await setStudioTrialDays(14);
  const { data: studio } = await raw.from("plans").select("trial_days").eq("key", "studio").single();
  if (studio!.trial_days !== 14) throw new Error("failed to restore studio trial_days=14");
  console.log("ok studio trial_days restored to 14");

  for (const row of created) {
    await cleanupBusiness(row.id, row.email);
  }
  console.log(`ok cleaned ${created.length} test signups`);
  console.log("verify-trial-days: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
