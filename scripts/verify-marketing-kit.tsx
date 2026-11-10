/**
 * Marketing Kit verification (pure — no database, no network writes).
 *
 *   npx tsx scripts/verify-marketing-kit.tsx [outDir]
 *
 * Checks: overrides sanitizing, offer/access resolution (included / paid / unavailable /
 * purchased / pending / price changes after purchase), slugs, listing-host routing, view
 * model (no invented facts), and renders every Social Media Kit export with the same
 * server pipeline as production — asserting exact pixel sizes and a valid flyer PDF.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildDefaults, classifyPhoto, draftDescription, slugCandidates, slugifyAddress } from "@/lib/marketing/defaults";
import { mergeContent, sanitizeOverrides, FORMAT_SIZE, type MediaIndexItem, type MarketingContent } from "@/lib/marketing/model";
import { mergeMarketingKitSettings, purchasePriceCents, resolveAccess, resolveOffer, sanitizeOfferOverrides, type PurchaseRow } from "@/lib/marketing/offers";
import { buildListingView, type UrlResolver } from "@/lib/marketing/view-model";
import { buildSocialItems } from "@/lib/marketing/social-inputs";
import { renderItem } from "@/lib/marketing/render";
import { listingHostRewrite } from "@/lib/host-resolution";
import { suggestListingDomain } from "@/lib/marketing/listing-url";

const out = process.argv[2] ?? join(tmpdir(), "marketing-kit-verify");
mkdirSync(out, { recursive: true });
let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

// ---------------------------------------------------------------------------
console.log("Model & defaults");
const BIZ = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const ids = Array.from({ length: 6 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-00000000000${i}`);
const names = ["front-exterior.jpg", "living-room.jpg", "kitchen.jpg", "primary-bedroom.jpg", "aerial-drone.jpg", "floor-plan.png"];
const media: MediaIndexItem[] = ids.map((id, i) => ({
  id, type: "photo", source: "upload", name: names[i]!, alt: "", width: 1600, height: 1067, category: classifyPhoto(names[i]!), youtubeUrl: null, embedUrl: null,
}));

ok("photo categories from file names", () => {
  assert.deepEqual(media.map((m) => m.category), ["exterior", "living", "kitchen", "bedroom", "aerial", "floorplan"]);
});

const defaults = buildDefaults({
  project: { property_address: "123 Main St, Austin, TX 78701", cover_image_id: null },
  property: { property_type: "Residential" },
  client: { name: "Jamie Rivera", email: "jamie@example.com", phone: "(512) 555-0100", company: "Hill Country Realty" },
  business: { name: "Lens & Light Media", primaryColor: "#1E293B", accentColor: "#C08B4F", hasLogo: false },
  brandProfile: null,
  settings: { defaultTemplate: "modern", photographerCredit: true },
  media,
});

ok("address split + no invented facts", () => {
  assert.equal(defaults.property.address, "123 Main St");
  assert.equal(defaults.property.locality, "Austin, TX 78701");
  assert.equal(defaults.property.price, null);
  assert.equal(defaults.property.beds, null);
  assert.equal(defaults.property.description, "");
  assert.equal(defaults.agent.name, "Jamie Rivera");
  assert.equal(defaults.agent.brokerage, "Hill Country Realty");
});

ok("sanitize rejects foreign uploads, bad colors, bad ids, long text", () => {
  const o = sanitizeOverrides(
    {
      property: { price: 1250000, beds: 4, baths: 3.5, sqft: -5, description: "x".repeat(9000), status: "bogus" },
      branding: { primaryColor: "red", accentColor: "#ABCDEF", logo: { kind: "upload", path: "other-biz/marketing/x.png" } },
      agent: { headshot: { kind: "upload", path: `${BIZ}/marketing/${PROJ}/headshot-1.jpg` } },
      media: { heroId: "not-a-uuid", gallery: { mode: "custom", ids: [ids[2], "nope", ids[1]] } },
      social: { disabled: ["sq_just_sold", "evil"], headlines: { sq_just_listed: "y".repeat(80) } },
    },
    `${BIZ}/marketing/`
  );
  assert.equal(o.property?.price, 1250000);
  assert.equal(o.property?.sqft, 0);
  assert.equal(o.property?.description?.length, 6000);
  assert.equal(o.property?.status, undefined);
  assert.equal(o.branding?.primaryColor, undefined);
  assert.equal(o.branding?.accentColor, "#ABCDEF");
  assert.equal(o.branding?.logo, undefined);
  assert.deepEqual(o.agent?.headshot, { kind: "upload", path: `${BIZ}/marketing/${PROJ}/headshot-1.jpg` });
  assert.equal(o.media?.heroId, undefined);
  assert.deepEqual(o.media?.gallery, { mode: "custom", ids: [ids[2], ids[1]] });
  assert.deepEqual(o.social?.disabled, ["sq_just_sold"]);
  assert.equal(o.social?.headlines?.sq_just_listed?.length, 40);
});

ok("description draft uses only confirmed facts", () => {
  const d = draftDescription({ ...defaults.property, beds: 4, baths: 3, sqft: 2450, highlights: ["Pool", "Chef's kitchen"] });
  assert.match(d, /4-bedroom, 3-bath single family home with 2,450 square feet in Austin/);
  assert.match(d, /pool and chef's kitchen/);
  assert.doesNotMatch(draftDescription(defaults.property), /bedroom|square feet|\$/);
});

ok("slugs + collision candidates", () => {
  assert.equal(slugifyAddress("123 Main St."), "123-main-st");
  assert.equal(slugifyAddress("Ünïcode Ave #4"), "unicode-ave-4");
  assert.equal(slugifyAddress("api"), "api-home");
  const c = slugCandidates("123 Main St", "Austin, TX");
  assert.deepEqual(c.slice(0, 3), ["123-main-st", "123-main-st-austin", "123-main-st-2"]);
});

ok("listing-domain suggestion + listing host routing", () => {
  assert.equal(suggestListingDomain("portal.photobusiness.com"), "listings.photobusiness.com");
  assert.equal(suggestListingDomain(null), null);
  assert.equal(listingHostRewrite("/"), "/l");
  assert.equal(listingHostRewrite("/123-main-st"), "/l/123-main-st");
  assert.equal(listingHostRewrite("/123-main-st/"), "/l/123-main-st");
  assert.equal(listingHostRewrite("/admin"), "/l/admin");
  assert.equal(listingHostRewrite("/dashboard/projects/x"), "/l/__not-found");
  assert.equal(listingHostRewrite("/api/admin/settings"), "/l/__not-found");
  assert.equal(listingHostRewrite("/api/public/listing/k/img/a"), null);
  assert.equal(listingHostRewrite("/_next/static/chunk.js"), null);
  assert.equal(listingHostRewrite("/marketing-fonts/Inter-400.ttf"), null);
});

// ---------------------------------------------------------------------------
console.log("Offers & access");
const settings = mergeMarketingKitSettings({});
const paid = (product: "website" | "social", status: PurchaseRow["status"], amount = 4900): PurchaseRow => ({
  id: `p-${product}-${status}`, product, status, amount_cents: amount, payment_id: "pay-1", purchase_method: "pay_now", granted_at: null, created_at: "",
});

ok("business defaults: paid $49 / $29, hidden from clients until turned on", () => {
  assert.deepEqual(resolveOffer("website", settings, {}), { mode: "paid", priceCents: 4900, source: "default" });
  assert.deepEqual(resolveOffer("social", settings, {}), { mode: "paid", priceCents: 2900, source: "default" });
  assert.equal(settings.showToClients, false);
});
ok("project override: included / paid custom price / unavailable", () => {
  const ov = sanitizeOfferOverrides({ website: { mode: "included" }, social: { mode: "paid", priceCents: 1999 } });
  assert.equal(resolveOffer("website", settings, ov).mode, "included");
  assert.deepEqual(resolveOffer("social", settings, ov), { mode: "paid", priceCents: 1999, source: "project" });
  assert.equal(resolveOffer("social", settings, sanitizeOfferOverrides({ social: { mode: "unavailable" } })).mode, "unavailable");
  assert.equal(sanitizeOfferOverrides({ social: { mode: "paid", priceCents: 5 } }).social?.priceCents, 100);
});
ok("disabled product is unavailable", () => {
  const s = mergeMarketingKitSettings({ social: { offered: false } });
  assert.equal(resolveAccess("social", resolveOffer("social", s, {}), []).state, "unavailable");
});
ok("access states: locked → pending → purchased; refund/cancel revoke", () => {
  const offer = resolveOffer("website", settings, {});
  assert.equal(resolveAccess("website", offer, []).state, "locked");
  assert.equal(resolveAccess("website", offer, [paid("website", "pending")]).state, "pending_payment");
  assert.equal(resolveAccess("website", offer, [paid("website", "pending")]).hasAccess, false);
  assert.equal(resolveAccess("website", offer, [paid("website", "paid")]).hasAccess, true);
  assert.equal(resolveAccess("website", offer, [paid("website", "refunded")]).hasAccess, false);
  assert.equal(resolveAccess("website", offer, [paid("website", "disputed")]).hasAccess, false);
  assert.equal(resolveAccess("website", offer, [paid("website", "cancelled")]).state, "locked");
});
ok("purchase survives later price change or 'not offered'", () => {
  const gone = resolveOffer("website", settings, sanitizeOfferOverrides({ website: { mode: "unavailable" } }));
  assert.equal(resolveAccess("website", gone, [paid("website", "paid")]).hasAccess, true);
  const pricier = resolveOffer("website", mergeMarketingKitSettings({ website: { priceCents: 9900 } }), {});
  assert.equal(resolveAccess("website", pricier, [paid("website", "comped", 0)]).hasAccess, true);
});
ok("independent products: buying the website doesn't unlock social", () => {
  const p = [paid("website", "paid")];
  assert.equal(resolveAccess("social", resolveOffer("social", settings, {}), p).hasAccess, false);
});
ok("server-side price: sum, bundle only when cheaper and both are default", () => {
  const offers = { website: resolveOffer("website", settings, {}), social: resolveOffer("social", settings, {}) };
  assert.equal(purchasePriceCents(["website", "social"], offers, settings), 7800);
  const withBundle = mergeMarketingKitSettings({ bundlePriceCents: 6900 });
  assert.equal(purchasePriceCents(["website", "social"], offers, withBundle), 6900);
  assert.equal(purchasePriceCents(["website"], offers, withBundle), 4900);
  const custom = { ...offers, social: resolveOffer("social", withBundle, sanitizeOfferOverrides({ social: { mode: "paid", priceCents: 1000 } })) };
  assert.equal(purchasePriceCents(["website", "social"], custom, withBundle), 5900);
});

// ---------------------------------------------------------------------------
console.log("View model");
const imgs = new Map(ids.map((id, i) => [id, i]));
const files = [
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-coast-skyline.jpg",
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-bay-park.jpg",
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-boat-sunset.jpg",
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-under-bridge.jpg",
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-sunset-water.jpg",
  "Landing Page Assets/07-Source-Frames/footage-stills/aerial-boat-close.jpg",
];
const dataUris = files.map((f) => `data:image/jpeg;base64,${readFileSync(join(process.cwd(), f)).toString("base64")}`);
const urls: UrlResolver = {
  image: (ref) => (ref.kind === "media" ? dataUris[imgs.get(ref.id) ?? 0]! : null),
  video: () => null,
  poster: () => null,
};
const content: MarketingContent = mergeContent(defaults, {
  property: { price: 1250000, beds: 4, baths: 3.5, sqft: 3120, yearBuilt: 2019, highlights: ["Resort-style pool", "Chef's kitchen", "Hill Country views", "3-car garage"], openHouse: { date: "2026-11-21", start: "13:00", end: "16:00", note: "" }, description: "Light-filled modern home with sweeping views." },
});
const view = buildListingView({ content, media, tours: [], coverId: null, businessName: "Lens & Light Media", urls });
ok("hero auto-pick prefers exterior; floor plan kept out of the gallery", () => {
  assert.equal(view.hero?.id, ids[0]);
  assert.equal(view.gallery.some((g) => g.id === ids[5]), false);
  assert.equal(view.floorPlans[0]?.id, ids[5]);
  assert.equal(view.priceText, "$1,250,000");
  assert.deepEqual(view.facts.map((f) => f.label), ["Beds", "Baths", "Sq Ft", "Built"]);
});
ok("missing price hides price; unbranded hides agent", () => {
  const v = buildListingView({ content: mergeContent(defaults, { branding: { unbranded: true } }), media, tours: [], coverId: null, businessName: "", urls });
  assert.equal(v.priceText, null);
  assert.equal(v.showAgent, false);
  assert.equal(v.branding.logoUrl, null);
});

// ---------------------------------------------------------------------------
async function renders() {
  console.log("Exports (same renderer as production)");
  const styles = ["modern", "luxury", "coastal"] as const;
  for (const style of styles) {
    const c = mergeContent(content, { social: { style } } as never);
    const items = buildSocialItems({ content: { ...c, social: { ...c.social, style } }, media, coverId: null, view, photoUrl: (id) => (id ? dataUris[imgs.get(id) ?? 0]! : null) });
    assert.ok(items.length >= 12, "expected squares, stories, carousel and flyer");
    for (const item of items) {
      const t0 = Date.now();
      const { body, contentType } = await renderItem(item, "Verify");
      const file = join(out, `${style}-${item.fileName}`);
      writeFileSync(file, body);
      if (contentType === "application/pdf") {
        const pdf = await PDFDocument.load(body);
        assert.equal(pdf.getPageCount(), 1);
        const { width, height } = pdf.getPage(0).getSize();
        assert.deepEqual([width, height], [612, 792]);
      } else {
        const meta = await sharp(body).metadata();
        const expected = FORMAT_SIZE[item.group === "square" ? "square" : item.group === "story" ? "story" : "carousel"];
        assert.deepEqual([meta.width, meta.height], [expected.width, expected.height], `${item.id} size`);
      }
      process.stdout.write(`    ${style} ${item.id} ${contentType.split("/")[1]} ${Date.now() - t0}ms\n`);
    }
    passed++;
    console.log(`  ✓ ${style}: ${items.length} assets at exact export sizes`);
  }
}

renders()
  .then(() => {
    console.log(`\nAll ${passed} checks passed. Renders in ${out}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
