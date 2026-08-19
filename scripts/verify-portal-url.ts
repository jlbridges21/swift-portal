/**
 * Portal origin guards + Swift/Test Pilot URL shape.
 * Run: npx tsx scripts/verify-portal-url.ts
 */
import {
  assertPublicPortalOrigin,
  getBusinessPortalOrigin,
  isLocalOrRelativeOrigin,
} from "../src/lib/portal-url";

const SWIFT = { slug: "swift-aerial-media", custom_domain: "portal.swiftaerialmedia.com" };
const PILOT = { slug: "test-pilot-drones", custom_domain: null as string | null };

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

expect(
  "Swift custom_domain origin",
  getBusinessPortalOrigin(SWIFT) === "https://portal.swiftaerialmedia.com"
);
expect(
  "Test Pilot subdomain origin",
  getBusinessPortalOrigin(PILOT) === "https://test-pilot-drones.shootportal.app"
);
expect("localhost is local", isLocalOrRelativeOrigin("http://localhost:3000"));
expect("relative is local", isLocalOrRelativeOrigin("/dashboard"));
expect("custom domain is public", !isLocalOrRelativeOrigin("https://portal.swiftaerialmedia.com"));

const guarded = assertPublicPortalOrigin("http://localhost:3000", "test", true);
expect("production localhost falls back to platform apex", guarded === "https://shootportal.app");

console.log("\nAll portal-url cases passed.");
