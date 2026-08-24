/**
 * Assert every plan catalog price matches its mapped Stripe Price unit_amount
 * for the active Stripe mode. Exit 1 on any mismatch.
 *
 *   npx tsx scripts/verify-plan-stripe-price-consistency.ts
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
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (secret.startsWith("sk_live")) {
    console.log("Checking LIVE mode (sk_live_ key active)");
  } else if (secret.startsWith("sk_test")) {
    console.log("Checking TEST mode (sk_test_ key active)");
  } else {
    throw new Error("STRIPE_SECRET_KEY missing or invalid");
  }

  const { checkPlanStripePriceConsistency } = await import(
    "../src/lib/sync-plan-stripe-prices"
  );
  const report = await checkPlanStripePriceConsistency();

  console.log(`\nRows checked: ${report.rowsChecked} (${report.modeChecked})`);
  console.log(`Checked at: ${report.checkedAt}\n`);

  if (!report.mismatches.length) {
    console.log("PASS — all catalog prices match mapped Stripe unit_amounts.");
    return;
  }

  console.error("FAIL — catalog ↔ Stripe mismatches:\n");
  for (const m of report.mismatches) {
    console.error(
      `  ${m.planKey} ${m.billingInterval}: catalog ${m.catalogCents}¢ vs Stripe ${m.stripeUnitAmountCents ?? "n/a"}¢ (${m.reason}) ${m.stripePriceId ?? ""}`
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
