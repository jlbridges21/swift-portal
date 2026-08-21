/**
 * Verify platform lifecycle email evaluation (comped skip, offsets, From header).
 * Run: npx tsx scripts/verify-platform-lifecycle.ts
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

import {
  daysRelativeToEvent,
  resolveEventIso,
  templateEventFamily,
  templateMatchesOffset,
  toEventDateIso,
  type LifecycleBusinessRow,
} from "../src/lib/platform-lifecycle";
import { getSubscriptionState } from "../src/lib/subscription";
import { getPlatformLifecycleFromHeader } from "../src/lib/platform-email";
import { SWIFT_COMP_PROTECTED_BUSINESS_ID } from "../src/lib/platform-session";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-08-21T15:00:00.000Z");

function biz(partial: Partial<LifecycleBusinessRow>): LifecycleBusinessRow {
  return {
    id: "b1",
    name: "Test Studio",
    slug: "test",
    status: "active",
    deleted_at: null,
    plan: "studio",
    subscription_status: "trialing",
    trial_ends_at: "2026-08-28T15:00:00.000Z",
    comped_until: null,
    comped_reason: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: null,
    billing_email: null,
    lifecycle_emails_suppressed: false,
    ...partial,
  };
}

assert(daysRelativeToEvent("2026-08-28T15:00:00.000Z", now) === -7, "7 days before");
assert(daysRelativeToEvent("2026-08-21T12:00:00.000Z", now) === 0, "day of");
assert(daysRelativeToEvent("2026-08-18T12:00:00.000Z", now) === 3, "3 days after");
assert(toEventDateIso("2026-08-28T15:00:00.000Z") === "2026-08-28", "event date");

const trialing = biz({});
assert(templateEventFamily("trial_ending_7d") === "trial_ending", "family");
assert(resolveEventIso("trial_ending", trialing, now) === trialing.trial_ends_at, "trial event");
assert(
  templateMatchesOffset({ key: "trial_ending_7d", send_offset_days: -7 }, trialing.trial_ends_at!, now),
  "matches -7"
);
assert(
  !templateMatchesOffset({ key: "trial_ending_3d", send_offset_days: -3 }, trialing.trial_ends_at!, now),
  "does not match -3"
);

const swift = biz({
  id: SWIFT_COMP_PROTECTED_BUSINESS_ID,
  subscription_status: "comped",
  trial_ends_at: "2026-08-28T15:00:00.000Z",
  comped_until: null,
});
assert(getSubscriptionState(swift, now).isComped === true, "Swift isComped");
assert(resolveEventIso("trial_ending", swift, now) == null, "comped skips trial_ending event");

const from = getPlatformLifecycleFromHeader();
assert(from.toLowerCase().includes("shootportal"), `From includes ShootPortal: ${from}`);
assert(!from.includes("@swiftaerialmedia"), `From must not be tenant domain: ${from}`);
console.log("Platform From header:", from);
console.log("verify-platform-lifecycle: ok");
