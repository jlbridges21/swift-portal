/**
 * Reproduce /billing data path for a trialing business without Next request ALS.
 * Run: npx tsx scripts/repro-billing.ts
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

import { createClient } from "@supabase/supabase-js";
import { getSubscriptionState } from "../src/lib/subscription";
import { formatPlanPrice } from "../src/lib/plan-catalog";
import { getAppSettings } from "../src/lib/app-settings";
import { getPortalBrandFromSettings } from "../src/lib/portal-brand";
import { listActivePlans } from "../src/lib/entitlements";
import { metadataFromBusiness } from "../src/lib/site-metadata";

async function main() {
  const bid = "d449e8ef-c294-4d58-9c3a-787db458dee9";
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: business, error } = await raw
    .from("businesses")
    .select(
      "id, slug, name, status, custom_domain, subscription_status, trial_ends_at, comped_until, comped_reason, plan"
    )
    .eq("id", bid)
    .single();
  if (error || !business) throw error || new Error("no business");

  console.log("business.plan=", business.plan);

  try {
    const settings = await getAppSettings(bid);
    console.log("settings ok", settings.business.businessName);
    const brand = getPortalBrandFromSettings(settings);
    console.log("brand ok", brand.portalName, brand.logoUrl?.slice(0, 40));
    const meta = metadataFromBusiness(settings.business);
    console.log("meta ok", meta.title);
  } catch (e) {
    console.error("settings/brand THROW", e);
  }

  try {
    const plans = await listActivePlans();
    console.log("plans", plans.length, plans.map((p) => p.key));
    const currentPlan = plans.find((p) => p.key === business.plan) ?? null;
    console.log("currentPlan", currentPlan?.name ?? null);
    console.log("price", formatPlanPrice(currentPlan?.price_monthly_cents));
  } catch (e) {
    console.error("plans THROW", e);
  }

  try {
    const sub = getSubscriptionState(business);
    console.log("sub", sub);
  } catch (e) {
    console.error("sub THROW", e);
  }

  // Simulate missing plan field (HOST_BUSINESS_SELECT bug)
  const withoutPlan = { ...business, plan: undefined };
  const sub2 = getSubscriptionState(withoutPlan);
  console.log("sub without plan field still ok", sub2.status);
  const plans = await listActivePlans();
  const currentPlanMissing = plans.find((p) => p.key === withoutPlan.plan) ?? null;
  console.log("currentPlan when plan undefined", currentPlanMissing);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
