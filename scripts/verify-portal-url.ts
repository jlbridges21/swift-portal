/**
 * Portal origin guards + Swift/Test Pilot URL shape.
 * Run: npx tsx scripts/verify-portal-url.ts
 */
import {
  assertPublicPortalOrigin,
  getBusinessPortalOrigin,
  getLoginRedirectOrigin,
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
expect("production localhost falls back to platform apex", guarded === "https://www.shootportal.app");

expect(
  "apex login sends custom-domain business home",
  getLoginRedirectOrigin(
    SWIFT,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://portal.swiftaerialmedia.com"
);
expect(
  "apex login sends subdomain-only business home",
  getLoginRedirectOrigin(
    PILOT,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://test-pilot-drones.shootportal.app"
);
expect(
  "bare apex login also sends custom-domain business home",
  getLoginRedirectOrigin(
    SWIFT,
    { hostname: "shootportal.app", origin: "https://shootportal.app" }
  ) === "https://portal.swiftaerialmedia.com"
);

expect(
  "foreign custom-domain host sends slug-only tenant home",
  getLoginRedirectOrigin(
    PILOT,
    { hostname: "portal.swiftaerialmedia.com", origin: "https://portal.swiftaerialmedia.com" },
    { foreignTenantHost: true }
  ) === "https://test-pilot-drones.shootportal.app"
);
expect(
  "Swift on Test Pilot subdomain goes to custom domain",
  getLoginRedirectOrigin(
    SWIFT,
    { hostname: "test-pilot-drones.shootportal.app", origin: "https://test-pilot-drones.shootportal.app" },
    { foreignTenantHost: true }
  ) === "https://portal.swiftaerialmedia.com"
);

console.log("\nAll portal-url cases passed.");
