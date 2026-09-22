/**
 * Portal origin guards + Swift/Test Pilot URL shape.
 * Run: npx tsx scripts/verify-portal-url.ts
 */
import {
  assertPublicPortalOrigin,
  getBusinessPortalOrigin,
  getBusinessSubdomainOrigin,
  getLoginRedirectOrigin,
  isCustomDomainHealthy,
  isLocalOrRelativeOrigin,
} from "../src/lib/portal-url";

const SWIFT_HEALTHY = {
  slug: "swift-aerial-media",
  custom_domain: "portal.swiftaerialmedia.com",
  custom_domain_status: "connected",
  custom_domain_vercel_verified: true,
  custom_domain_misconfigured: false,
};

const SWIFT_BROKEN = {
  slug: "swift-aerial-media",
  custom_domain: "portal.swiftaerialmedia.com",
  custom_domain_status: "pending",
  custom_domain_vercel_verified: false,
  custom_domain_misconfigured: true,
};

const SWIFT_FIELD_ONLY = {
  slug: "swift-aerial-media",
  custom_domain: "portal.swiftaerialmedia.com",
};

const PILOT = { slug: "test-pilot-drones", custom_domain: null as string | null };

const CVD = {
  slug: "creative-visuals-drone-photo",
  custom_domain: "www.cvdroneandphoto.com",
  custom_domain_status: "error",
  custom_domain_vercel_verified: false,
  custom_domain_misconfigured: true,
};

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

expect("healthy custom is healthy", isCustomDomainHealthy(SWIFT_HEALTHY));
expect("broken custom is not healthy", !isCustomDomainHealthy(SWIFT_BROKEN));
expect("field-only custom is not healthy", !isCustomDomainHealthy(SWIFT_FIELD_ONLY));

expect(
  "Swift healthy custom_domain origin",
  getBusinessPortalOrigin(SWIFT_HEALTHY) === "https://portal.swiftaerialmedia.com"
);
expect(
  "Swift broken custom falls back to subdomain",
  getBusinessPortalOrigin(SWIFT_BROKEN) === "https://swift-aerial-media.shootportal.app"
);
expect(
  "Swift field-only (no health cols) falls back to subdomain",
  getBusinessPortalOrigin(SWIFT_FIELD_ONLY) === "https://swift-aerial-media.shootportal.app"
);
expect(
  "cvdrone unhealthy falls back to subdomain",
  getBusinessPortalOrigin(CVD) === "https://creative-visuals-drone-photo.shootportal.app"
);
expect(
  "Test Pilot subdomain origin",
  getBusinessPortalOrigin(PILOT) === "https://test-pilot-drones.shootportal.app"
);
expect(
  "subdomain helper",
  getBusinessSubdomainOrigin("creative-visuals-drone-photo") ===
    "https://creative-visuals-drone-photo.shootportal.app"
);
expect("localhost is local", isLocalOrRelativeOrigin("http://localhost:3000"));
expect("relative is local", isLocalOrRelativeOrigin("/dashboard"));
expect("custom domain is public", !isLocalOrRelativeOrigin("https://portal.swiftaerialmedia.com"));

const guarded = assertPublicPortalOrigin("http://localhost:3000", "test", true);
expect("production localhost falls back to platform apex", guarded === "https://www.shootportal.app");

expect(
  "apex login sends healthy custom-domain business home",
  getLoginRedirectOrigin(
    SWIFT_HEALTHY,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://portal.swiftaerialmedia.com"
);
expect(
  "apex login sends broken custom-domain business to subdomain",
  getLoginRedirectOrigin(
    SWIFT_BROKEN,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://swift-aerial-media.shootportal.app"
);
expect(
  "apex login sends subdomain-only business home",
  getLoginRedirectOrigin(
    PILOT,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://test-pilot-drones.shootportal.app"
);
expect(
  "bare apex login also sends healthy custom-domain business home",
  getLoginRedirectOrigin(
    SWIFT_HEALTHY,
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
  "Swift on Test Pilot subdomain goes to healthy custom domain",
  getLoginRedirectOrigin(
    SWIFT_HEALTHY,
    { hostname: "test-pilot-drones.shootportal.app", origin: "https://test-pilot-drones.shootportal.app" },
    { foreignTenantHost: true }
  ) === "https://portal.swiftaerialmedia.com"
);
expect(
  "broken Swift on own dead custom host escapes to subdomain",
  getLoginRedirectOrigin(
    SWIFT_BROKEN,
    { hostname: "portal.swiftaerialmedia.com", origin: "https://portal.swiftaerialmedia.com" }
  ) === "https://swift-aerial-media.shootportal.app"
);
expect(
  "cvdrone lockout escape from apex",
  getLoginRedirectOrigin(
    CVD,
    { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" }
  ) === "https://creative-visuals-drone-photo.shootportal.app"
);

console.log("\nAll portal-url cases passed.");
