/**
 * Resolve live landing pages for Swift + Test Pilot and print a regression summary.
 * Run: npx tsx scripts/verify-landing-resolve.ts
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

import { getAppSettings, saveAppSettings } from "../src/lib/app-settings";
import { loadResolvedLandingPage } from "../src/lib/resolve-landing-page";
import { EntitlementError } from "../src/lib/entitlements";
import { DEFAULT_HERO_HEADLINE, DEFAULT_HERO_SUBHEADLINE } from "../src/lib/landing-content";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const TEST_PILOT = "00000000-0000-0000-0000-0000000000aa";

async function main() {
  const swiftSettings = await getAppSettings(SWIFT);
  const { page: swift } = await loadResolvedLandingPage(SWIFT, swiftSettings);
  console.log("--- Swift ---");
  console.log({
    businessName: swift.businessName,
    eyebrow: swift.eyebrow,
    headline: swift.headline,
    headlineAccent: swift.headlineAccent,
    subheadline: swift.subheadline.slice(0, 60) + "…",
    industries: swift.industries,
    showShowreel: swift.showShowreel,
    showreelVideoId: swift.showreelVideoId,
    showServices: swift.showServices,
    showSocial: swift.showSocial,
    howItWorks0: swift.howItWorks[0],
  });
  if (swift.headline !== DEFAULT_HERO_HEADLINE) throw new Error("Swift headline changed");
  if (swift.headlineAccent !== "All in one premium portal.") throw new Error("Swift accent missing");
  if (!swift.subheadline.startsWith(DEFAULT_HERO_SUBHEADLINE.slice(0, 40))) {
    throw new Error("Swift subheadline changed");
  }
  if (!swift.showShowreel || swift.showreelVideoId !== "OdLRhe5nNmw") {
    throw new Error("Swift showreel missing");
  }
  if (swift.showServices) throw new Error("Swift should hide services section for visual parity");
  if (/ShootPortal/i.test(JSON.stringify(swift))) throw new Error("Swift has ShootPortal refs");

  const tpSettings = await getAppSettings(TEST_PILOT);
  const { page: tp, businessName } = await loadResolvedLandingPage(TEST_PILOT, tpSettings);
  console.log("--- Test Pilot ---");
  console.log({
    businessName,
    headline: tp.headline,
    showShowreel: tp.showShowreel,
    showServices: tp.showServices,
    services: tp.services.map((s) => s.name),
    industries: tp.industries,
  });
  if (/ShootPortal/i.test(tp.headline + tp.subheadline + tp.businessDescription + tp.eyebrow)) {
    throw new Error("Test Pilot has ShootPortal copy");
  }
  if (tp.showShowreel) throw new Error("Test Pilot should not show empty showreel");

  // Entitlement gate: temporarily strip custom_branding from solo, move Test Pilot there,
  // attempt a landing save, then restore.
  const { createServiceClient } = await import("../src/lib/supabase/server");
  const raw = await createServiceClient();
  const { data: solo } = await raw.from("plans").select("entitlements").eq("key", "solo").single();
  const { data: tpBiz } = await raw.from("businesses").select("plan").eq("id", TEST_PILOT).single();
  const { data: admin } = await raw
    .from("profiles")
    .select("id")
    .eq("business_id", TEST_PILOT)
    .limit(1)
    .maybeSingle();
  if (!solo || !tpBiz || !admin?.id) throw new Error("missing solo/test-pilot for entitlement test");

  const priorEntitlements = solo.entitlements as Record<string, boolean>;
  const priorPlan = tpBiz.plan as string;
  await raw
    .from("plans")
    .update({ entitlements: { ...priorEntitlements, custom_branding: false } })
    .eq("key", "solo");
  await raw.from("businesses").update({ plan: "solo" }).eq("id", TEST_PILOT);

  let denied = false;
  try {
    const current = await getAppSettings(TEST_PILOT);
    await saveAppSettings(
      {
        landing: {
          ...current.landing,
          hero: { ...current.landing.hero, headline: "Blocked without entitlement" },
        },
      },
      admin.id,
      TEST_PILOT
    );
  } catch (err) {
    if (err instanceof EntitlementError) denied = true;
    else throw err;
  } finally {
    await raw.from("businesses").update({ plan: priorPlan }).eq("id", TEST_PILOT);
    await raw.from("plans").update({ entitlements: priorEntitlements }).eq("key", "solo");
  }
  if (!denied) throw new Error("expected EntitlementError when custom_branding missing");
  console.log("ok landing save denied without custom_branding");

  // Confirm page still resolves after restore
  const after = await loadResolvedLandingPage(TEST_PILOT, await getAppSettings(TEST_PILOT));
  if (/ShootPortal/i.test(after.page.headline)) throw new Error("ShootPortal leaked after restore");
  console.log("ok Test Pilot still resolves with derived defaults");

  console.log("verify-landing-resolve: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
