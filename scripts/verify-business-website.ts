/**
 * Business Website — pure logic checks (no database, no network).
 *   npx tsx scripts/verify-business-website.ts
 */
import assert from "node:assert/strict";
import { classifyWebsiteDomainPath, websitePagePath } from "../src/lib/host-resolution";
import {
  alternateWebsiteDomain,
} from "../src/lib/custom-domain";
import {
  legacyLandingCustomized,
  mergePortfolioSettings,
  mergeWebsiteSettings,
  normalizeRedirectPath,
  resolveWebsiteRedirect,
  uniquePortfolioSlug,
} from "../src/lib/website/settings";
import { buildSiteView } from "../src/lib/website/view";
import { composePortalDomainInput } from "../src/lib/custom-domain-input";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

t("friendly website paths map to /site", () => {
  assert.equal(websitePagePath("/portfolio"), "/site/portfolio");
  assert.equal(websitePagePath("/portfolio/"), "/site/portfolio");
  assert.equal(websitePagePath("/portfolio/modern-coastal-residence"), "/site/portfolio/modern-coastal-residence");
  assert.equal(websitePagePath("/services"), "/site/services");
  assert.equal(websitePagePath("/contact"), "/site/contact");
  assert.equal(websitePagePath("/"), null);
  assert.equal(websitePagePath("/request"), null);
  assert.equal(websitePagePath("/dashboard"), null);
  assert.equal(websitePagePath("/portfolio/../admin"), null);
  assert.equal(websitePagePath("/portfolio/a/b"), null);
});

t("website domain: public pages stay, portal paths move, private APIs blocked", () => {
  assert.deepEqual(classifyWebsiteDomainPath("/"), { kind: "page", rewrite: null });
  assert.deepEqual(classifyWebsiteDomainPath("/contact"), { kind: "page", rewrite: "/site/contact" });
  assert.deepEqual(classifyWebsiteDomainPath("/request"), { kind: "page", rewrite: null });
  for (const p of ["/login", "/dashboard", "/dashboard/projects/x", "/admin", "/admin/settings", "/auth/confirm", "/photo/abc", "/v/abc", "/l/123-main", "/request/thank-you", "/billing", "/b/other-studio"]) {
    assert.equal(classifyWebsiteDomainPath(p).kind, "portal", p);
  }
  for (const p of ["/api/request", "/api/catalog/services", "/api/public/portfolio/x/img/y", "/api/public/website/logo", "/api/public/website/hero/x"]) {
    assert.equal(classifyWebsiteDomainPath(p).kind, "page", p);
  }
  for (const p of ["/api/admin/website/media/x", "/api/admin/settings", "/api/projects", "/api/public/listing/x/img/y", "/api/auth/session-continue", "/api/request/logged-in"]) {
    assert.equal(classifyWebsiteDomainPath(p).kind, "api_blocked", p);
  }
  assert.equal(classifyWebsiteDomainPath("/about-us").kind, "unknown");
  assert.equal(classifyWebsiteDomainPath("/blog/old-post").kind, "unknown");
  assert.equal(classifyWebsiteDomainPath("/_next/static/x.js").kind, "page");
});

t("old-website redirects: business rules first, then aliases", () => {
  const w = mergeWebsiteSettings({ redirects: [{ from: "/Our-Story", to: "/" }, { from: "https://old.com/gallery-2?x=1", to: "/portfolio" }, { from: "javascript:alert(1)", to: "/" }] });
  assert.deepEqual(w.redirects, [{ from: "/our-story", to: "/" }, { from: "/gallery-2", to: "/portfolio" }]);
  assert.equal(resolveWebsiteRedirect(w, "/our-story/"), "/");
  assert.equal(resolveWebsiteRedirect(w, "/gallery"), "/portfolio");
  assert.equal(resolveWebsiteRedirect(w, "/book-now"), "/request");
  assert.equal(resolveWebsiteRedirect(w, "/unknown"), null);
  assert.equal(normalizeRedirectPath("//evil.com"), "/evil.com");
});

t("classic landing customization detection", () => {
  assert.equal(legacyLandingCustomized(null), false);
  assert.equal(legacyLandingCustomized({ hero: { headline: "Demo Client Portal" } } as never), false);
  assert.equal(legacyLandingCustomized({ hero: { mediaType: "showreel" } } as never), false);
  assert.equal(legacyLandingCustomized({ hero: { subheadline: "Premium listing videos" } } as never), true);
  assert.equal(legacyLandingCustomized({ hero: { showreelUrl: "https://youtu.be/0_Qm1kTaKvI" } } as never), true);
  assert.equal(legacyLandingCustomized({ heroVideoId: "OdLRhe5nNmw" } as never), true);
});

t("existing businesses: launch state + carried-over content", () => {
  const fresh = mergeWebsiteSettings(undefined, null);
  assert.equal(fresh.launched, true);
  const custom = mergeWebsiteSettings(undefined, { hero: { subheadline: "Aerial footage for builders", showreelUrl: "https://youtu.be/0_Qm1kTaKvI", mediaType: "showreel", ctaPrimaryLabel: "Get Instant Estimate" }, social: { instagram: "https://instagram.com/x" } } as never);
  assert.equal(custom.launched, false, "customized classic page stays live");
  assert.equal(custom.intro, "Aerial footage for builders");
  assert.equal(custom.heroSource, "video");
  assert.equal(custom.ctaLabel, "", "portal CTA copy is not carried over");
  assert.equal(custom.social.instagram, "https://instagram.com/x");
  const boiler = mergeWebsiteSettings(undefined, { hero: { headline: "Swift Client Portal" } } as never);
  assert.equal(boiler.headline, "");
  const saved = mergeWebsiteSettings({ launched: true, template: "luxury" }, { hero: { subheadline: "x" } } as never);
  assert.equal(saved.launched, true);
  assert.equal(saved.template, "luxury");
  assert.equal(mergeWebsiteSettings({ template: "bogus" as never }).template, "modern");
});

t("portfolio entries are sanitized", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const p = mergePortfolioSettings({
    entries: [
      { projectId: id, slug: "home-1", title: "<b>Nice</b> Home", mediaIds: [id, "nope", id], coverId: "x", featured: true },
      { projectId: "bad", slug: "x" },
      { projectId: id, slug: "dupe" },
    ],
  });
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0]!.title, "Nice Home");
  assert.deepEqual(p.entries[0]!.mediaIds, [id]);
  assert.equal(p.entries[0]!.coverId, id);
  assert.equal(uniquePortfolioSlug("Modern Coastal Residence", ["modern-coastal-residence"]), "modern-coastal-residence-2");
});

t("view: empty business still gets a complete site, no empty sections", () => {
  const v = buildSiteView({
    website: mergeWebsiteSettings(null),
    business: { name: "Swift Aerial Media", tagline: "", logoUrl: "", primaryColor: "#111", accentColor: "#4F46E5", email: "", phone: "", websiteUrl: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", legalName: "", termsUrl: "", privacyUrl: "" },
    services: [],
    portfolio: [],
    links: { clientLogin: "/login", request: "/request" },
  });
  assert.deepEqual(v.nav.map((n) => n.key), ["home", "contact"]);
  assert.equal(v.hero.media.kind, "design");
  assert.ok(v.hero.headline.includes("Swift Aerial Media"));
  assert.ok(!/shootportal/i.test(v.hero.headline + v.hero.intro + v.cta.heading));
  assert.equal(v.business.social.length, 0);
});

t("view: drone services drive niche copy; pricing respects hide_pricing", () => {
  const v = buildSiteView({
    website: mergeWebsiteSettings(null),
    business: { name: "Swift", tagline: "", logoUrl: "", primaryColor: "#111", accentColor: "#4F46E5", email: "a@b.co", phone: "251-555-0100", websiteUrl: "", addressLine1: "1 Main", addressLine2: "", city: "Mobile", state: "AL", postalCode: "36602", legalName: "", termsUrl: "", privacyUrl: "" },
    services: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Drone Photography", description: "", startingLabel: "", priceCents: 14900, hidePricing: false, includes: [] },
      { id: "22222222-2222-4222-8222-222222222222", name: "Aerial Video", description: "", startingLabel: "", priceCents: 39900, hidePricing: true, includes: [] },
    ],
    portfolio: [],
    links: { clientLogin: "/login", request: "/request" },
  });
  assert.match(v.hero.headline, /aerial/i);
  assert.equal(v.services[0]!.priceLabel, "Starting at $149");
  assert.equal(v.services[1]!.priceLabel, null);
  assert.deepEqual(v.business.addressLines, [], "address hidden by default");
  assert.equal(v.business.phoneHref, "tel:2515550100");
});

t("services: up to 9 featured cards (3×3)", () => {
  const svc = Array.from({ length: 12 }, (_, i) => ({ id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, name: `S${i}`, description: "", startingLabel: "", priceCents: null, hidePricing: false, includes: [] }));
  const v = buildSiteView({
    website: mergeWebsiteSettings(null),
    business: { name: "X", tagline: "", logoUrl: "https://x.example/logo.png", primaryColor: "#111", accentColor: "#4F46E5", email: "", phone: "", websiteUrl: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", legalName: "", termsUrl: "", privacyUrl: "" },
    services: svc,
    portfolio: [],
    links: { clientLogin: "/login", request: "/request" },
  });
  assert.equal(v.services.length, 9);
  assert.equal(v.allServices.length, 12);
  assert.ok(v.business.logoUrl.startsWith("/api/public/website/logo?u="));
});

t("hero media picked from ShootPortal media", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const base = { business: { name: "X", tagline: "", logoUrl: "", primaryColor: "#111", accentColor: "#4F46E5", email: "", phone: "", websiteUrl: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", legalName: "", termsUrl: "", privacyUrl: "" }, services: [], portfolio: [], links: { clientLogin: "/login", request: "/request" } };
  const img = buildSiteView({ ...base, website: mergeWebsiteSettings({ heroSource: "image", heroImageMedia: { id, source: "upload", youtubeId: "" } }) });
  assert.deepEqual(img.hero.media, { kind: "image", url: `/api/public/website/hero/${id}?s=large`, alt: "X photography" });
  const vid = buildSiteView({ ...base, website: mergeWebsiteSettings({ heroSource: "video", heroVideoMedia: { id, source: "upload", youtubeId: "" } }) });
  assert.equal(vid.hero.media.kind, "file-video");
  const yt = buildSiteView({ ...base, website: mergeWebsiteSettings({ heroSource: "video", heroVideoMedia: { id, source: "youtube", youtubeId: "aqz-KE-bpKQ" } }) });
  assert.equal(yt.hero.media.kind, "video");
  assert.equal(mergeWebsiteSettings({ heroImageMedia: { id: "nope" } as never }).heroImageMedia, null);
});

t("Business Website domain input allows www; portal input still refuses it", () => {
  const w = composePortalDomainInput({ mode: "subdomain", subdomain: "www", rootDomain: "photobusiness.com", allowWww: true });
  assert.ok(w.ok && w.domain === "www.photobusiness.com");
  const pasted = composePortalDomainInput({ mode: "subdomain", subdomain: "www", rootDomain: "https://www.photobusiness.com/about", allowWww: true });
  assert.ok(pasted.ok && pasted.domain === "www.photobusiness.com");
  assert.equal(composePortalDomainInput({ mode: "subdomain", subdomain: "www", rootDomain: "photobusiness.com" }).ok, false);
  assert.equal(alternateWebsiteDomain("www.photobusiness.com"), "photobusiness.com");
  assert.equal(alternateWebsiteDomain("photobusiness.com"), "www.photobusiness.com");
  assert.equal(alternateWebsiteDomain("site.photobusiness.com"), null);
});

console.log(`\n${n} checks passed`);
