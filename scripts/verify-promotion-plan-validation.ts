/**
 * Promotion plan validation smoke — one char ok, empty rejected.
 */
import { submitPartnerApplication } from "../src/lib/partners";

async function main() {
  const stamp = Date.now().toString(36);

  try {
    await submitPartnerApplication({
      name: "Test",
      email: `promo-empty-${stamp}@example.test`,
      brandName: "Brand",
      promotionPlan: "",
    });
    console.log("FAIL empty promotionPlan should throw");
    process.exit(1);
  } catch (e) {
    console.log("ok empty rejected:", (e as Error).message);
  }

  await submitPartnerApplication({
    name: "Test",
    email: `promo-one-${stamp}@example.test`,
    brandName: "Brand",
    promotionPlan: "x",
  });
  console.log("ok one-character promotionPlan accepted for", `promo-one-${stamp}@example.test`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
