/**
 * Classic / New interface rollout verification (no database, no network).
 * Exercises the pure rules in src/lib/ui-rollout.ts — phases, the automatic 14-day transition,
 * defaults, banners, super-admin previews, safe return paths — plus static checks that the
 * global controls are super-admin only and the preference routes save only the session user.
 *
 * Run: npx tsx scripts/verify-ui-rollout.ts
 */

import { readFileSync } from "node:fs";
import {
  DEFAULT_ROLLOUT_CONFIG,
  EMPTY_USER_UI_PREFERENCE,
  effectivePhase,
  resolveUiExperience,
  safeReturnPath,
  transitionAtFrom,
  UI_ROLLOUT_DAYS,
  type RolloutConfig,
  type UserUiPreference,
} from "../src/lib/ui-rollout";

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

const user = { isSuperAdmin: false };
const admin = { isSuperAdmin: true };
const pref = (p: Partial<UserUiPreference>): UserUiPreference => ({ ...EMPTY_USER_UI_PREFERENCE, ...p });

const activated = new Date("2026-11-11T15:00:00.000Z");
const transition = transitionAtFrom(activated);
const optional: RolloutConfig = { status: "optional", activatedAt: activated.toISOString(), transitionAt: transition.toISOString() };
const day = (n: number) => new Date(activated.getTime() + n * 86_400_000);

console.log("Phase 1 — Classic Only (default / not activated)");
{
  const e = resolveUiExperience(DEFAULT_ROLLOUT_CONFIG, pref({}), user);
  assert(e.mode === "classic" && !e.canSwitch && e.banner === null, "customers: Classic, no switch, no banner");
  const saved = resolveUiExperience(DEFAULT_ROLLOUT_CONFIG, pref({ interface: "new" }), user);
  assert(saved.mode === "classic", "a saved New choice does not leak before activation");
  const sa = resolveUiExperience(DEFAULT_ROLLOUT_CONFIG, pref({ interface: "new" }), admin);
  assert(sa.mode === "new" && sa.canSwitch && sa.banner === null, "super-admin can preview New (no banner)");
}

console.log("Phase 2 — Optional (days 1–14)");
{
  assert(transition.getTime() - activated.getTime() === UI_ROLLOUT_DAYS * 86_400_000, "transition is exactly 14 days after activation");
  const fresh = resolveUiExperience(optional, pref({}), user, day(1));
  assert(fresh.mode === "classic" && fresh.canSwitch && fresh.banner === "try_new", "default Classic + Try New banner + switch");
  const chose = resolveUiExperience(optional, pref({ interface: "new" }), user, day(3));
  assert(chose.mode === "new" && chose.banner === "welcome_new", "chose New → New + welcome banner");
  const back = resolveUiExperience(optional, pref({ interface: "classic" }), user, day(5));
  assert(back.mode === "classic" && back.banner === "try_new", "switched back → Classic");
  const dismissed = resolveUiExperience(optional, pref({ tryNewBannerDismissed: true }), user, day(2));
  assert(dismissed.banner === null && dismissed.canSwitch && dismissed.mode === "classic", "dismissal hides banner, keeps switch + mode");
  const otherBanner = resolveUiExperience(optional, pref({ tryNewBannerDismissed: true, interface: "new" }), user, day(2));
  assert(otherBanner.banner === "welcome_new", "dismissing one banner does not hide the other");
  const lastMinute = resolveUiExperience(optional, pref({}), user, new Date(transition.getTime() - 1));
  assert(lastMinute.phase === "optional", "still optional one millisecond before the transition");
}

console.log("Phase 3 — automatic transition (day 15)");
{
  assert(effectivePhase(optional, transition) === "new_default", "exactly at transition_at → New Interface Default");
  const e = resolveUiExperience(optional, pref({ interface: "classic" }), user, day(15));
  assert(e.mode === "new" && !e.canSwitch && e.banner === null, "Classic preference overridden; no banner, no switch");
  const sa = resolveUiExperience(optional, pref({ interface: "classic" }), admin, day(15));
  assert(sa.mode === "classic" && sa.canSwitch, "super-admin can still preview Classic for rollback checks");
}

console.log("Super-admin overrides");
{
  const forced: RolloutConfig = { ...optional, status: "new_default" };
  assert(resolveUiExperience(forced, pref({ interface: "classic" }), user, day(2)).mode === "new", "New-only applies before day 14");
  const rollback: RolloutConfig = { ...optional, status: "classic_rollback" };
  const r = resolveUiExperience(rollback, pref({ interface: "new" }), user, day(20));
  assert(r.mode === "classic" && !r.canSwitch && r.banner === null, "rollback restores Classic for everyone, even after day 14");
  const delayed: RolloutConfig = { ...optional, transitionAt: day(17).toISOString() };
  assert(effectivePhase(delayed, day(15)) === "optional", "delayed transition keeps the optional period open");
  const noDate: RolloutConfig = { status: "optional", activatedAt: null, transitionAt: null };
  assert(effectivePhase(noDate, day(100)) === "optional", "optional with no date never auto-transitions");
}

console.log("Return paths");
{
  assert(safeReturnPath("/admin/projects/abc?x=1#y") === "/admin/projects/abc?x=1#y", "same-origin path kept");
  assert(safeReturnPath("//evil.example/x") === "/admin", "protocol-relative URL refused");
  assert(safeReturnPath("https://evil.example") === "/admin", "absolute URL refused");
  assert(safeReturnPath("/\\evil") === "/admin", "backslash path refused");
  assert(safeReturnPath(undefined) === "/admin", "missing → /admin");
}

console.log("Static checks");
{
  const platformRoute = readFileSync("src/app/api/platform/ui-rollout/route.ts", "utf8");
  assert((platformRoute.match(/requireSuperAdminApi\(\)/g) ?? []).length >= 2, "global rollout API: GET and POST require super-admin");
  assert(/writePlatformAudit/.test(platformRoute), "rollout changes are audit-logged");
  const page = readFileSync("src/app/platform/ui-rollout/page.tsx", "utf8");
  assert(/requireSuperAdminPage\(\)/.test(page), "rollout page requires super-admin");
  for (const f of ["src/app/api/ui-preference/switch/route.ts", "src/app/api/ui-preference/dismiss/route.ts"]) {
    const src = readFileSync(f, "utf8");
    assert(/profile\.id/.test(src) && !/user_id|userId/.test(src), `${f.split("/").slice(-2).join("/")}: writes only the session user's row`);
    assert(/isOwnerAdmin\(profile\) \|\| isActiveStaff\(profile\)/.test(src), `${f.split("/").slice(-2).join("/")}: business users only`);
  }
  const lib = readFileSync("src/lib/ui-rollout.ts", "utf8");
  assert(!/^["']use client["']/.test(lib) && !/^import /m.test(lib), "shared rules module has no imports (safe on client and server)");
  const shell = readFileSync("src/components/admin/app-shell/admin-app-shell.tsx", "utf8");
  assert(/isStaff/.test(shell) && /caps\.showPartner/.test(shell), "New sidebar still filters by role and partner capability");
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll UI rollout checks passed");
