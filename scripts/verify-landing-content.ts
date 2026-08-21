/**
 * Abuse + entitlement checks for landing content sanitization.
 * Run: npx tsx scripts/verify-landing-content.ts
 */
import assert from "node:assert/strict";
import {
  sanitizePlainText,
  sanitizeSocialUrl,
  mergeLandingSettings,
  resolveLandingPage,
  LANDING_LIMITS,
  DEFAULT_HERO_HEADLINE,
} from "../src/lib/landing-content";

function main() {
  assert.equal(sanitizePlainText("<script>x</script>Hello", 80), "Hello");
  assert.equal(sanitizePlainText("a".repeat(500), LANDING_LIMITS.headline).length, LANDING_LIMITS.headline);
  assert.equal(sanitizePlainText("x".repeat(500), 80).length, 80);
  assert.ok(sanitizePlainText("Hello 👋 café", 80).includes("Hello"));
  assert.ok(sanitizePlainText("שלום", 80).length > 0);

  assert.equal(sanitizeSocialUrl("instagram", "javascript:alert(1)"), "");
  assert.equal(sanitizeSocialUrl("instagram", "https://evil.com/phish"), "");
  assert.ok(
    sanitizeSocialUrl("instagram", "https://www.instagram.com/swift/").startsWith("https://")
  );
  assert.equal(sanitizeSocialUrl("website", "http://example.com/ok"), "https://example.com/ok");

  const merged = mergeLandingSettings({
    hero: {
      headline: "<b>" + "W".repeat(200),
      subheadline: "",
      ctaPrimaryLabel: "",
      ctaSecondaryLabel: "",
      showreelUrl: "javascript:alert(1)",
    },
    social: { instagram: "javascript:x", facebook: "", youtube: "", website: "", linkedin: "" },
  } as never);
  assert.ok(merged.hero.headline.length <= LANDING_LIMITS.headline);
  assert.ok(!merged.hero.headline.includes("<"));
  assert.equal(merged.hero.showreelUrl, "");
  assert.equal(merged.social.instagram, "");

  const page = resolveLandingPage({
    landing: mergeLandingSettings({
      hero: {
        headline: DEFAULT_HERO_HEADLINE,
        subheadline: "",
        ctaPrimaryLabel: "",
        ctaSecondaryLabel: "",
        showreelUrl: "https://www.youtube.com/watch?v=OdLRhe5nNmw",
      },
      sections: { showreel: true, industries: true, social: false, services: false },
    }),
    businessName: "Swift Aerial Media",
    portalName: "Swift Aerial Media",
    serviceNames: ["Aerial Photography"],
    services: [],
  });
  assert.equal(page.headline, DEFAULT_HERO_HEADLINE);
  assert.equal(page.showServices, false);
  assert.equal(page.showShowreel, true);
  assert.equal(page.showreelVideoId, "OdLRhe5nNmw");

  const emptyTenant = resolveLandingPage({
    landing: mergeLandingSettings(null),
    businessName: "Test Pilot Drones",
    portalName: "Test Pilot Drones",
    serviceNames: ["Aerial Photography"],
    services: [{ name: "Aerial Photography", startingLabel: "From $249", description: "" }],
  });
  assert.equal(emptyTenant.headline, "Test Pilot Drones Client Portal");
  assert.ok(!/ShootPortal/i.test(emptyTenant.subheadline));
  assert.ok(!/ShootPortal/i.test(emptyTenant.businessDescription));
  assert.equal(emptyTenant.showServices, true);
  assert.equal(emptyTenant.showShowreel, false);

  console.log("verify-landing-content: PASS");
}

main();
