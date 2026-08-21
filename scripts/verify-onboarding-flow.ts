/**
 * End-to-end onboarding actions for a throwaway signup business.
 * Run: npx tsx scripts/verify-onboarding-flow.ts
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

import assert from "node:assert/strict";
import {
  createBusinessForPlatform,
  SYSTEM_SIGNUP_ACTOR,
} from "../src/lib/platform-onboard";
import { createServiceClient } from "../src/lib/supabase/server";
import { applyOnboardingAction, getOnboardingSnapshot } from "../src/lib/onboarding-server";
import { adminHomePath, needsOnboardingRedirect } from "../src/lib/onboarding";
import { saveAppSettings } from "../src/lib/app-settings";
import { listBusinessServices } from "../src/lib/business-services";

async function cleanup(businessId: string, email: string) {
  const raw = await createServiceClient();
  const { data: profile } = await raw.from("profiles").select("id").eq("email", email).maybeSingle();
  await raw.from("business_services").delete().eq("business_id", businessId);
  await raw.from("business_integrations").delete().eq("business_id", businessId);
  await raw.from("business_settings").delete().eq("business_id", businessId);
  await raw.from("platform_audit_log").delete().eq("target_business_id", businessId);
  if (profile?.id) {
    try {
      await raw.auth.admin.deleteUser(profile.id);
    } catch {
      /* */
    }
    await raw.from("profiles").delete().eq("id", profile.id);
  }
  await raw.from("businesses").delete().eq("id", businessId);
}

async function main() {
  const stamp = Date.now().toString(36);
  const email = `onboard-${stamp}@example.com`;
  const slug = `onboard-${stamp}`;

  const created = await createBusinessForPlatform(
    {
      name: `Onboard Co ${stamp}`,
      slug,
      adminEmail: email,
      password: "OnboardTest123!",
      source: "signup",
    },
    SYSTEM_SIGNUP_ACTOR
  );

  const raw = await createServiceClient();
  const { data: biz } = await raw
    .from("businesses")
    .select("onboarding_completed_at, onboarding_state, name")
    .eq("id", created.businessId)
    .single();

  assert.equal(biz?.onboarding_completed_at, null);
  assert.equal(
    needsOnboardingRedirect({
      onboardingCompletedAt: biz?.onboarding_completed_at,
      onboardingState: biz?.onboarding_state,
      role: "admin",
    }),
    true
  );
  assert.equal(
    adminHomePath({
      onboardingCompletedAt: biz?.onboarding_completed_at,
      onboardingState: biz?.onboarding_state,
    }),
    "/onboarding"
  );
  console.log("ok new signup lands in onboarding");

  // Resume at step 4 after saving earlier progress
  let snap = await applyOnboardingAction(created.businessId, {
    type: "complete",
    step: "welcome",
  });
  assert.equal(snap.state.currentStep, "identity");

  // Identity incomplete without email
  await assert.rejects(
    () => applyOnboardingAction(created.businessId, { type: "complete", step: "identity" }),
    /contact email/i
  );

  const { data: profile } = await raw.from("profiles").select("id").eq("email", email).single();
  await saveAppSettings(
    {
      business: {
        businessName: `Onboard Co ${stamp}`,
        portalName: `Onboard Co ${stamp}`,
        legalName: `Onboard Co ${stamp}`,
        primaryContactEmail: email,
        phoneNumber: "555-0100",
      },
    },
    profile!.id,
    created.businessId
  );

  snap = await applyOnboardingAction(created.businessId, {
    type: "complete",
    step: "identity",
  });
  assert.equal(snap.state.currentStep, "branding");
  console.log("ok identity saved");

  snap = await applyOnboardingAction(created.businessId, {
    type: "skip",
    step: "branding",
  });
  assert.equal(snap.state.currentStep, "services");
  assert.ok(snap.state.skippedSteps.includes("branding"));

  // Simulate close tab: state persisted at services
  const mid = await getOnboardingSnapshot(created.businessId);
  assert.equal(mid.state.currentStep, "services");
  console.log("ok resume would open at services");

  // Block finish without... services already seeded with prices
  const services = await listBusinessServices(created.businessId);
  assert.ok(services.some((s) => s.is_active && (s.preliminary_estimate_cents ?? 0) > 0));

  // Deactivate all → services step blocked
  for (const s of services) {
    await raw.from("business_services").update({ is_active: false }).eq("id", s.id);
  }
  await assert.rejects(
    () => applyOnboardingAction(created.businessId, { type: "complete", step: "services" }),
    /at least one active service/i
  );
  console.log("ok zero active services blocked");

  // Reactivate one
  await raw
    .from("business_services")
    .update({ is_active: true })
    .eq("id", services[0].id);

  snap = await applyOnboardingAction(created.businessId, {
    type: "complete",
    step: "services",
  });
  assert.equal(snap.state.currentStep, "payments");

  // Defer escape hatch
  snap = await applyOnboardingAction(created.businessId, { type: "defer" });
  assert.equal(snap.state.deferred, true);
  assert.equal(
    adminHomePath({
      onboardingCompletedAt: null,
      onboardingState: snap.state,
    }),
    "/admin"
  );
  console.log("ok defer → admin with banner path");

  snap = await applyOnboardingAction(created.businessId, { type: "resume" });
  assert.equal(snap.state.deferred, false);

  snap = await applyOnboardingAction(created.businessId, {
    type: "skip",
    step: "payments",
  });
  snap = await applyOnboardingAction(created.businessId, {
    type: "skip",
    step: "landing",
  });
  assert.equal(snap.state.currentStep, "finish");

  snap = await applyOnboardingAction(created.businessId, { type: "finish" });
  assert.ok(snap.completedAt);
  assert.equal(
    needsOnboardingRedirect({
      onboardingCompletedAt: snap.completedAt,
      onboardingState: snap.state,
      role: "admin",
    }),
    false
  );
  console.log("ok finish sets onboarding_completed_at");

  await cleanup(created.businessId, email);
  console.log("ok cleaned test business");
  console.log("verify-onboarding-flow: PASS");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
