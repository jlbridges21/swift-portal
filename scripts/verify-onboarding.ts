/**
 * Onboarding state + backfill sanity checks.
 * Run: npx tsx scripts/verify-onboarding.ts
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

import assert from "node:assert/strict";
import { createServiceClient } from "../src/lib/supabase/server";
import {
  adminHomePath,
  needsOnboardingRedirect,
  parseOnboardingState,
  canCompleteStep,
  markStepSkipped,
} from "../src/lib/onboarding";
import { getAppSettings } from "../src/lib/app-settings";
import { listBusinessServices } from "../src/lib/business-services";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const TEST_PILOT = "00000000-0000-0000-0000-0000000000aa";

async function main() {
  const raw = await createServiceClient();

  for (const id of [SWIFT, TEST_PILOT]) {
    const { data } = await raw
      .from("businesses")
      .select("slug, onboarding_completed_at, onboarding_state")
      .eq("id", id)
      .single();
    assert.ok(data?.onboarding_completed_at, `${data?.slug} must be backfilled complete`);
    assert.equal(
      needsOnboardingRedirect({
        onboardingCompletedAt: data.onboarding_completed_at,
        onboardingState: data.onboarding_state,
        role: "admin",
      }),
      false
    );
    assert.equal(
      adminHomePath({
        onboardingCompletedAt: data.onboarding_completed_at,
        onboardingState: data.onboarding_state,
      }),
      "/admin"
    );
    console.log(`ok ${data.slug} never sees wizard`);
  }

  // Fresh incomplete state → onboarding
  assert.equal(
    adminHomePath({ onboardingCompletedAt: null, onboardingState: {} }),
    "/onboarding"
  );
  assert.equal(
    adminHomePath({
      onboardingCompletedAt: null,
      onboardingState: { version: 1, deferred: true, currentStep: "branding" },
    }),
    "/admin"
  );

  // Required step cannot be skipped
  const state = parseOnboardingState({});
  assert.throws(() => markStepSkipped(state, "services"));

  // Swift services gate passes
  const settings = await getAppSettings(SWIFT);
  const services = await listBusinessServices(SWIFT);
  assert.equal(canCompleteStep("services", { settings, services }).ok, true);

  // Zero services blocked
  assert.equal(
    canCompleteStep("services", { settings, services: [] }).ok,
    false
  );

  console.log("verify-onboarding: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
