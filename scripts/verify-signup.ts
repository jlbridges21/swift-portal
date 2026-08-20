/**
 * One-shot verification for self-serve signup (prompt 2).
 * Run: npx tsx scripts/verify-signup.ts
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

// Avoid Supabase confirmation-email rate limits during automated verify.
process.env.SIGNUP_TEST_NO_EMAIL = "1";

import {
  allowSignupAttempt,
  resetSignupRateLimitsForTests,
} from "../src/lib/signup-rate-limit";
import { validateBusinessSlug } from "../src/lib/reserved-subdomains";
import {
  createBusinessForPlatform,
  SYSTEM_SIGNUP_ACTOR,
} from "../src/lib/platform-onboard";
import { createServiceClient } from "../src/lib/supabase/server";

async function countBizChildren(businessId: string) {
  const raw = await createServiceClient();
  const [settings, integ, services, biz] = await Promise.all([
    raw.from("business_settings").select("business_id", { count: "exact", head: true }).eq("business_id", businessId),
    raw.from("business_integrations").select("business_id", { count: "exact", head: true }).eq("business_id", businessId),
    raw.from("business_services").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    raw.from("businesses").select("id").eq("id", businessId).maybeSingle(),
  ]);
  return {
    settings: settings.count ?? 0,
    integ: integ.count ?? 0,
    services: services.count ?? 0,
    businessExists: Boolean(biz.data),
  };
}

async function main() {
  const results: string[] = [];

  // Reserved slugs
  for (const slug of ["www", "api", "admin"]) {
    const r = validateBusinessSlug(slug);
    if (r.ok) throw new Error(`expected reserved reject for ${slug}`);
  }
  results.push("ok reserved slugs rejected");

  // Rate limit attempts
  resetSignupRateLimitsForTests();
  let blocked = false;
  for (let i = 0; i < 12; i++) {
    if (!allowSignupAttempt("verify-ip")) {
      blocked = true;
      break;
    }
  }
  if (!blocked) throw new Error("expected attempt rate limit");
  results.push("ok attempt rate limit engages after 10");

  // Existing slug suggestion path is API-only; check uniqueness helper via DB
  const raw = await createServiceClient();
  const { data: existing } = await raw.from("businesses").select("slug").eq("slug", "swift-aerial-media").maybeSingle();
  if (!existing) throw new Error("swift slug missing");
  results.push("ok existing slug present for uniqueness checks");

  // Forced rollback: fail between business+deps and auth user
  const slug = `rollback-probe-${Date.now().toString(36)}`;
  process.env.SIGNUP_FORCE_FAIL_AFTER_BUSINESS = "1";
  let threw = false;
  try {
    await createBusinessForPlatform(
      {
        name: "Rollback Probe",
        slug,
        plan: "studio",
        adminEmail: `rollback-${Date.now().toString(36)}@shoottverify.test`,
        adminName: "Rollback Probe",
        password: "password-verify-123",
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );
  } catch (err) {
    threw = /Forced failure/.test(err instanceof Error ? err.message : "");
  } finally {
    delete process.env.SIGNUP_FORCE_FAIL_AFTER_BUSINESS;
  }
  if (!threw) throw new Error("expected forced mid-provision failure");

  const { data: orphan } = await raw.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (orphan) {
    const kids = await countBizChildren(orphan.id);
    throw new Error(`orphan business after rollback: ${JSON.stringify(kids)}`);
  }
  results.push("ok rollback after forced mid-provision failure — no orphan business");

  // Existing email must fail before insert (no orphan)
  const { data: list } = await raw.auth.admin.listUsers({ page: 1, perPage: 50 });
  const existingEmail = list.users.find((u) => u.email)?.email;
  if (!existingEmail) throw new Error("need an existing auth email");
  const slug2 = `rollback-email-${Date.now().toString(36)}`;
  let emailThrew = false;
  try {
    await createBusinessForPlatform(
      {
        name: "Rollback Email",
        slug: slug2,
        plan: "studio",
        adminEmail: existingEmail,
        adminName: "Rollback Email",
        password: "password-verify-123",
        source: "signup",
      },
      SYSTEM_SIGNUP_ACTOR
    );
  } catch {
    emailThrew = true;
  }
  if (!emailThrew) throw new Error("expected existing email to fail");
  const { data: orphan2 } = await raw.from("businesses").select("id").eq("slug", slug2).maybeSingle();
  if (orphan2) throw new Error("orphan after existing-email reject");
  results.push("ok existing email rejected before business insert");

  // Happy-path signup (will send confirmation email)
  const stamp = Date.now().toString(36);
  const trialSlug = `trial-${stamp}`;
  // Prefer SIGNUP_VERIFY_EMAIL; else a +alias on a known workspace inbox.
  const email =
    process.env.SIGNUP_VERIFY_EMAIL?.replace("@", `+${stamp}@`) ??
    `jackson.bridges21+sp${stamp}@gmail.com`;

  const created = await createBusinessForPlatform(
    {
      name: `Trial Studio ${stamp}`,
      slug: trialSlug,
      plan: "studio",
      adminEmail: email,
      adminName: "Trial Owner",
      password: "password-verify-123",
      source: "signup",
    },
    SYSTEM_SIGNUP_ACTOR
  );

  const { data: biz } = await raw
    .from("businesses")
    .select("id, created_via, subscription_status, trial_ends_at, plan")
    .eq("id", created.businessId)
    .single();
  if (!biz) throw new Error("created business missing");
  if (biz.created_via !== "signup") throw new Error(`created_via=${biz.created_via}`);
  if (biz.subscription_status !== "trialing") throw new Error(`status=${biz.subscription_status}`);
  if (biz.plan !== "studio") throw new Error(`plan=${biz.plan}`);
  const ends = biz.trial_ends_at ? new Date(biz.trial_ends_at).getTime() : 0;
  const days = (ends - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 29 || days > 31) throw new Error(`trial days=${days}`);

  const kids = await countBizChildren(created.businessId);
  if (kids.settings !== 1 || kids.integ !== 1 || kids.services < 4) {
    throw new Error(`dependents incomplete: ${JSON.stringify(kids)}`);
  }

  const { data: profile } = await raw
    .from("profiles")
    .select("id, business_id, role, email")
    .eq("email", email)
    .maybeSingle();
  if (!profile?.business_id || profile.business_id !== created.businessId) {
    throw new Error(`profile.business_id not set by trigger: ${JSON.stringify(profile)}`);
  }
  if (profile.role !== "admin") throw new Error(`role=${profile.role}`);

  results.push(`ok signup provisioned ${trialSlug} / ${email}`);
  results.push(`  businessId=${created.businessId}`);
  results.push(`  requiresEmailConfirmation=${created.requiresEmailConfirmation}`);

  // Soft-delete cleanup helper note (platform delete is UI); hard cleanup here for verify leftovers
  if (process.env.SIGNUP_VERIFY_KEEP !== "1") {
    await raw.from("business_services").delete().eq("business_id", created.businessId);
    await raw.from("business_integrations").delete().eq("business_id", created.businessId);
    await raw.from("business_settings").delete().eq("business_id", created.businessId);
    await raw.from("platform_audit_log").delete().eq("target_business_id", created.businessId);
    if (profile.id) {
      await raw.auth.admin.deleteUser(profile.id);
      await raw.from("profiles").delete().eq("id", profile.id);
    }
    await raw.from("businesses").delete().eq("id", created.businessId);
    results.push("ok cleaned up trial signup rows");
  } else {
    results.push("kept trial signup (SIGNUP_VERIFY_KEEP=1)");
  }

  // Swift unchanged
  const { data: swift } = await raw
    .from("businesses")
    .select("subscription_status, created_via, plan")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();
  if (swift?.subscription_status !== "comped") throw new Error("Swift no longer comped");
  if (swift?.created_via !== "platform") throw new Error("Swift created_via changed");
  results.push("ok Swift still comped / platform source");

  console.log(results.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
