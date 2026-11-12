/**
 * Pure (no DB) check of the per-project client download override (v124).
 * Usage: npx tsx scripts/verify-project-download-access.ts
 */
import {
  clientDownloadLockMessage,
  effectiveRequireDeliveredForDownloads as eff,
  parseProjectDownloadAccess,
  resolveProjectDownloadAllowed as allowed,
} from "../src/lib/deliverables";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` (got ${String(got)}, want ${String(want)})`}`);
}
const client = (status: string, businessRequires: boolean, override: unknown) =>
  allowed({ projectStatus: status, isAdmin: false, requireDeliveredForDownloads: eff(businessRequires, override) });

// 1/2/10 — default (NULL / missing column) follows the business setting, both ways
check("default + business ON, awaiting_payment → locked", client("awaiting_payment", true, null), false);
check("default + business ON, delivered → open", client("delivered", true, null), true);
check("default + business OFF, awaiting_payment → open", client("awaiting_payment", false, null), true);
check("missing column (undefined) = default", client("awaiting_payment", true, undefined), false);
// 3 — allow unlocks before Delivered / payment
check("allow + business ON, awaiting_payment → open", client("awaiting_payment", true, "allow"), true);
check("allow + business ON, new_request → open", client("new_request", true, "allow"), true);
check("allow → no lock message", clientDownloadLockMessage("awaiting_payment", eff(true, "allow")), null);
// 5/6 — restrict overrides a permissive business default
check("restrict + business OFF, awaiting_payment → locked", client("awaiting_payment", false, "restrict"), false);
check("restrict + business OFF, delivered → open", client("delivered", false, "restrict"), true);
check("restrict shows lock message", typeof clientDownloadLockMessage("scheduled", eff(false, "restrict")), "string");
// junk values never unlock
check("unknown value parses to default", parseProjectDownloadAccess("yes"), "default");
check("unknown value + business ON → locked", client("awaiting_payment", true, "ALLOW"), false);
// admins unaffected
check("admin always downloads", allowed({ projectStatus: "new_request", isAdmin: true, requireDeliveredForDownloads: eff(true, "restrict") }), true);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll download-access checks passed.");
