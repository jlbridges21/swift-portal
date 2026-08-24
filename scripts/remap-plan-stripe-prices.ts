/**
 * One-shot: remap plan Stripe prices for current mode to match catalog.
 * Usage: npx tsx scripts/remap-plan-stripe-prices.ts [planKey]
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

async function main() {
  const key = process.argv[2] || "studio";
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (secret.startsWith("sk_live")) {
    throw new Error("Refusing live remap without explicit confirmation — use setup:stripe-billing --confirm-live");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const { syncPlanStripePricesAfterCatalogChange } = await import(
    "../src/lib/sync-plan-stripe-prices"
  );
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: plan, error } = await sb.from("plans").select("id, key").eq("key", key).single();
  if (error || !plan) throw new Error(error?.message || "plan not found");
  console.log("Remapping", plan.key, plan.id);
  const result = await syncPlanStripePricesAfterCatalogChange(plan.id);
  console.log(result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
