/**
 * Offline checks for multiple services per project and the combined
 * preliminary estimate. No network, no database reads or writes.
 *
 *   npx tsx scripts/verify-multi-service-estimates.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  buildConsolidatedEstimatePayload,
  buildPreliminaryEstimatePayloadForTemplates,
  buildPreliminaryEstimatePayloadFromTemplate,
  getServicePaymentDescription,
  type ServiceTemplate,
} from "../src/lib/service-templates";
import {
  CUSTOM_QUOTE_LABEL,
  descriptionAsPlainText,
  estimateTotalPending,
  hasEstimateSections,
  parseEstimateDescription,
} from "../src/lib/estimate-sections";
import { getQuotePriceDisplay, getQuotePackageName } from "../src/lib/quote-display";
import {
  compactServiceLabel,
  formatServiceList,
  projectMatchesServices,
  projectServiceNames,
  projectTitleForServices,
  serviceTypeForNames,
} from "../src/lib/project-service-names";
import { defaultProjectName } from "../src/lib/utils";
import { rowToServiceTemplate } from "../src/lib/business-services";
import { resolveSelectedServicesFromRows } from "../src/lib/project-services";
import { insertRequestProject, parseRequestKey, findProjectByRequestKey } from "../src/lib/request-dedupe";
import { filterProjects, EMPTY_PROJECT_FILTERS } from "../src/lib/projects-workspace";
import { filterProjectsByService } from "../src/lib/client-view";
import { buildEstimatePdf, estimateInputFromFields, type EstimatePdfInput } from "../src/lib/estimate-pdf";
import { estimateFormTotalCents } from "../src/components/projects/estimate-editor";
import type { BusinessServiceRow, ProjectQuote } from "../src/lib/types";

const OUT_DIR = join(tmpdir(), "multi-service-estimate-samples");
const BIZ = "11111111-1111-4111-8111-111111111111";
const brand = { portalName: "Harbor Portal", businessName: "Harbor Studio" };

function row(overrides: Partial<BusinessServiceRow> & Pick<BusinessServiceRow, "id" | "name">): BusinessServiceRow {
  return {
    business_id: BIZ,
    slug: overrides.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    description: null,
    preliminary_estimate_cents: 0,
    starting_label: "",
    includes: [],
    line_items: [],
    notes: "",
    hide_pricing: false,
    is_recommended: false,
    display_order: 0,
    is_active: true,
    aliases: [],
    ...overrides,
  };
}

const PHOTO = row({
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  name: "Aerial Photography",
  preliminary_estimate_cents: 24900,
  starting_label: "Starting at $249",
  includes: ["FAA Part 107 licensed pilot", "20–30 edited aerial images", "Secure {{portalName}} delivery"],
  line_items: [{ description: "Aerial Photography", amount_cents: 24900 }],
  notes: "Final pricing depends on property size and airspace.",
  display_order: 0,
});
const VIDEO = row({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  name: "Aerial Videography",
  preliminary_estimate_cents: 39900,
  starting_label: "Starting at $399",
  includes: ["Cinematic drone flight", "Licensed music"],
  line_items: [{ description: "Aerial Videography", amount_cents: 39900 }],
  display_order: 1,
});
const GOLF = row({
  id: "aaaaaaaa-0000-4000-8000-000000000003",
  name: "Golf Course & Resort Marketing",
  // A hidden service that DOES have a configured price: it must never leak.
  preliminary_estimate_cents: 123456,
  starting_label: "Starting at $1,234.56",
  line_items: [{ description: "Golf", amount_cents: 123456 }],
  hide_pricing: true,
  description: "Custom proposal based on property size.",
  notes: "A custom official proposal will be prepared after review.",
  display_order: 2,
});
const ZERO = row({ id: "aaaaaaaa-0000-4000-8000-000000000004", name: "Free Consult", display_order: 3 });
const NOPRICE = row({
  id: "aaaaaaaa-0000-4000-8000-000000000005",
  name: "Mapping",
  preliminary_estimate_cents: null,
  includes: ["Orthomosaic"],
  display_order: 4,
});
const INACTIVE = row({
  id: "aaaaaaaa-0000-4000-8000-000000000006",
  name: "Retired Service",
  preliminary_estimate_cents: 10000,
  line_items: [{ description: "Retired Service", amount_cents: 10000 }],
  is_active: false,
  display_order: 5,
});
const ROWS = [PHOTO, VIDEO, GOLF, ZERO, NOPRICE, INACTIVE];
const T = (r: BusinessServiceRow): ServiceTemplate => rowToServiceTemplate(r);

function quoteFrom(payload: { title: string; description: string; line_items: { description: string; amount_cents: number }[]; total_cents: number; notes: string }): ProjectQuote {
  return {
    id: "q",
    project_id: "p",
    title: payload.title,
    description: payload.description,
    line_items: payload.line_items,
    total_cents: payload.total_cents,
    notes: payload.notes,
    expires_at: null,
    status: "sent",
    quote_kind: "preliminary",
    sent_at: null,
    approved_at: null,
    changes_feedback: null,
    created_by: null,
    created_at: "2026-11-12T00:00:00Z",
    updated_at: "2026-11-12T00:00:00Z",
  };
}

let checks = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    checks += 1;
    console.log(`  ✓ ${name}`);
  });
}

async function main() {
  console.log("Combined preliminary estimate");

  await check("Photography $249 + Videography $399 = $648.00, one line item each, integer cents", () => {
    const p = buildConsolidatedEstimatePayload([T(PHOTO), T(VIDEO)], brand);
    assert.deepEqual(p.line_items, [
      { description: "Aerial Photography", amount_cents: 24900 },
      { description: "Aerial Videography", amount_cents: 39900 },
    ]);
    assert.equal(p.total_cents, 64800);
    assert.ok(p.line_items.every((i) => Number.isInteger(i.amount_cents)));
    assert.equal(p.title, "Preliminary Estimate — Multiple Services");
    assert.equal(p.quote_kind, "preliminary");
    assert.equal(estimateTotalPending(p.notes), false);
    assert.equal(getQuotePriceDisplay(quoteFrom(p)).priceLabel, "$648.00");
    assert.equal(getQuotePriceDisplay(quoteFrom(p)).showPrice, true);
    assert.equal(getQuotePackageName(quoteFrom(p)), "Multiple Services");
  });

  await check("deliverables are grouped under each service heading, never merged", () => {
    const p = buildConsolidatedEstimatePayload([T(PHOTO), T(VIDEO)], brand);
    const parsed = parseEstimateDescription(p.description);
    assert.deepEqual(parsed.sections.map((s) => s.heading), ["Aerial Photography", "Aerial Videography"]);
    assert.deepEqual(parsed.sections[0].includes, ["FAA Part 107 licensed pilot", "20–30 edited aerial images", "Secure Harbor Portal delivery"]);
    assert.deepEqual(parsed.sections[1].includes, ["Cinematic drone flight", "Licensed music"]);
    assert.equal(parsed.sections[0].label, "Starting at $249", "starting-at language kept per service");
    assert.ok(parsed.sections[0].text.includes("Final pricing depends on property size and airspace."), "per-service notes kept");
    assert.ok(!descriptionAsPlainText(p.description).includes("## "));
  });

  await check("hidden-pricing service shows Custom Quote and never its price; others keep theirs", () => {
    const p = buildConsolidatedEstimatePayload([T(PHOTO), T(GOLF)], brand);
    const everything = JSON.stringify(p);
    assert.ok(!everything.includes("123456") && !everything.includes("1,234") && !everything.includes("1234.56"), "hidden price leaked");
    assert.deepEqual(p.line_items, [{ description: "Aerial Photography", amount_cents: 24900 }]);
    const golf = parseEstimateDescription(p.description).sections[1];
    assert.equal(golf.label, CUSTOM_QUOTE_LABEL);
    assert.equal(estimateTotalPending(p.notes), true, "partial total is flagged");
    const display = getQuotePriceDisplay(quoteFrom(p));
    assert.equal(display.showPrice, false, "a partial subtotal is never shown as the final price");
    assert.match(display.priceLabel, /\$249\.00 \+ Custom Quote/);
  });

  await check("$0 and missing-price services are Custom Quote; all-custom keeps the legacy $0 line", () => {
    const p = buildConsolidatedEstimatePayload([T(ZERO), T(NOPRICE)], brand);
    assert.deepEqual(p.line_items, [{ description: "Custom Proposal Required", amount_cents: 0 }]);
    assert.equal(p.total_cents, 0);
    assert.equal(p.hidePricing, true);
    assert.ok(parseEstimateDescription(p.description).sections.every((s) => s.label === CUSTOM_QUOTE_LABEL));
    assert.equal(getQuotePriceDisplay(quoteFrom(p)).showPrice, false);
  });

  await check("one service keeps the existing single-service estimate exactly", () => {
    const single = buildPreliminaryEstimatePayloadForTemplates([T(PHOTO)], brand);
    const legacy = buildPreliminaryEstimatePayloadFromTemplate(T(PHOTO), brand);
    assert.deepEqual({ ...single, services: undefined }, { ...legacy, services: undefined });
    assert.equal(hasEstimateSections(single.description), false);
  });

  await check("fractional configured prices are rounded to integer cents", () => {
    const odd = row({ id: "aaaaaaaa-0000-4000-8000-000000000009", name: "Odd", line_items: [{ description: "Odd", amount_cents: 1000.6 }] });
    const p = buildConsolidatedEstimatePayload([T(odd), T(PHOTO)], brand);
    assert.equal(p.line_items[0].amount_cents, 1001);
    assert.equal(p.total_cents, 1001 + 24900);
    assert.equal(estimateFormTotalCents([{ description: "a", amount_cents: 10.4 }, { description: "b", amount_cents: 0.6 }]), 11);
  });

  await check("snapshotted prices: changing Settings → Services later does not change a built payload", () => {
    const p = buildConsolidatedEstimatePayload([T(PHOTO), T(VIDEO)], brand);
    const before = JSON.stringify(p);
    PHOTO.line_items = [{ description: "Aerial Photography", amount_cents: 99900 }];
    assert.equal(JSON.stringify(p), before);
    PHOTO.line_items = [{ description: "Aerial Photography", amount_cents: 24900 }];
  });

  await check("legacy descriptions have no sections and keep the old renderers", () => {
    const legacy = "Intro line\n\nIncludes\n• One\n• Two";
    assert.equal(hasEstimateSections(legacy), false);
    assert.equal(parseEstimateDescription(legacy).sections.length, 0);
  });

  console.log("Service selection (server validation)");

  await check("valid ids → catalog order, joined service_type, primary id", () => {
    const r = resolveSelectedServicesFromRows(ROWS, { service_ids: JSON.stringify([VIDEO.id, PHOTO.id]) });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.services.map((s) => s.name), ["Aerial Photography", "Aerial Videography"]);
    assert.equal(r.serviceType, "Aerial Photography + Aerial Videography");
    assert.equal(r.primaryServiceId, PHOTO.id);
  });

  await check("another business's service id is rejected (tenant isolation)", () => {
    const r = resolveSelectedServicesFromRows(ROWS, { service_ids: [PHOTO.id, "bbbbbbbb-0000-4000-8000-000000000001"] });
    assert.equal(r.ok, false);
  });

  await check("inactive services cannot be newly selected, but stay when already linked", () => {
    assert.equal(resolveSelectedServicesFromRows(ROWS, { service_ids: [INACTIVE.id] }).ok, false);
    const kept = resolveSelectedServicesFromRows(ROWS, { service_ids: [INACTIVE.id, PHOTO.id] }, { keepInactiveIds: [INACTIVE.id] });
    assert.ok(kept.ok);
  });

  await check("prices sent by the browser are ignored", () => {
    const r = resolveSelectedServicesFromRows(ROWS, {
      service_ids: [PHOTO.id],
      total_cents: 1,
      line_items: [{ description: "Aerial Photography", amount_cents: 1 }],
      price: 1,
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    const p = buildPreliminaryEstimatePayloadForTemplates(r.services.map((s) => s.template), brand);
    assert.equal(p.total_cents, 24900);
  });

  await check("malformed ids, empty selection and too many services are rejected", () => {
    assert.equal(resolveSelectedServicesFromRows(ROWS, { service_ids: ["not-a-uuid"] }).ok, false);
    assert.equal(resolveSelectedServicesFromRows(ROWS, { service_ids: [] }).ok, false);
    const many = Array.from({ length: 13 }, (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`);
    assert.equal(resolveSelectedServicesFromRows(ROWS, { service_ids: many }).ok, false);
  });

  await check("legacy single string (API / website integrations) keeps fuzzy matching", () => {
    const r = resolveSelectedServicesFromRows(ROWS, { service_requested: "Aerial Photography" });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.serviceType, "Aerial Photography");
    assert.equal(r.primaryServiceId, PHOTO.id);
  });

  console.log("Naming, display and filters");

  await check("single keeps the auto-name; several read 'Street — Multiple Services'", () => {
    assert.equal(projectTitleForServices("9560 County Road 99, Lillian, AL", ["Aerial Photography"]), "9560 County Road 99 — Aerial Photography");
    assert.equal(
      projectTitleForServices("9560 County Road 99, Lillian, AL", ["Aerial Photography", "Aerial Videography"]),
      "9560 County Road 99 — Multiple Services"
    );
    assert.equal(defaultProjectName("9560 County Road 99", "Aerial Photography + Aerial Videography"), "9560 County Road 99 — Multiple Services");
    assert.equal(defaultProjectName("9560 County Road 99", "Aerial Photography"), "9560 County Road 99 — Aerial Photography");
  });

  await check("service list helpers", () => {
    assert.equal(formatServiceList(["A", "B", "C"]), "A, B, and C");
    assert.equal(serviceTypeForNames(["A", "B"]), "A + B");
    assert.deepEqual(projectServiceNames({ service_type: "A + B" }), ["A", "B"]);
    assert.equal(compactServiceLabel({ service_type: "A + B + C" }), "A +2");
    assert.match(getServicePaymentDescription("Aerial Photography + Aerial Videography"), /Aerial Photography and Aerial Videography/);
  });

  await check("project filters match when ANY service matches", () => {
    const base = { project_name: "x", property_address: "y", status: "new_request", shoot_date: null, created_at: "2026-01-01", updated_at: "2026-01-01", clients: null };
    const projects = [
      { ...base, id: "1", service_type: "Aerial Photography + Aerial Videography" },
      { ...base, id: "2", service_type: "Drone Mapping" },
    ];
    assert.equal(projectMatchesServices(projects[0], ["Aerial Videography"]), true);
    const filtered = filterProjects(projects as never, { ...EMPTY_PROJECT_FILTERS, services: ["Aerial Videography"] });
    assert.deepEqual(filtered.map((p: { id: string }) => p.id), ["1"]);
    assert.deepEqual(filterProjectsByService(projects, ["Drone Mapping"]).map((p) => p.id), ["2"]);
  });

  console.log("Duplicate submissions");

  await check("request keys are validated", () => {
    assert.equal(parseRequestKey("not a key"), null);
    assert.equal(parseRequestKey("AAAAAAAA-0000-4000-8000-000000000001"), "aaaaaaaa-0000-4000-8000-000000000001");
  });

  await check("a unique-key collision returns the first project instead of creating another", async () => {
    const existing = { id: "p1", client_id: "c1", project_name: "first" };
    const db = {
      from() {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }) };
      },
    } as never;
    const result = await insertRequestProject(db, { a: 1 }, "aaaaaaaa-0000-4000-8000-000000000001", async () => ({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_projects_request_key"' },
    }));
    assert.equal(result.kind, "duplicate");
    assert.deepEqual(await findProjectByRequestKey(db, "aaaaaaaa-0000-4000-8000-000000000001"), existing);
  });

  await check("before v127 the insert retries without request_key", async () => {
    const seen: Record<string, unknown>[] = [];
    const result = await insertRequestProject({} as never, { a: 1 }, "aaaaaaaa-0000-4000-8000-000000000001", async (r) => {
      seen.push(r);
      return "request_key" in r
        ? { data: null, error: { code: "PGRST204", message: "Could not find the 'request_key' column of 'projects'" } }
        : { data: { id: "new" }, error: null };
    });
    assert.equal(result.kind, "created");
    assert.equal(seen.length, 2);
    assert.ok(!("request_key" in seen[1]));
  });

  console.log("PDF (preview and generated PDF share one builder)");

  const regular = readFileSync("public/fonts/Inter-Regular.ttf");
  const bold = readFileSync("public/fonts/Inter-Bold.ttf");
  function pdfInput(description: string, notes: string, lineItems: { description: string; amount_cents: number }[]): EstimatePdfInput {
    return estimateInputFromFields({
      businessName: "Harbor Studio",
      legalName: "Harbor Studio LLC",
      addressLines: ["12 Pier Street", "Lillian AL 36549"],
      phone: "(251) 555-0100",
      email: "hello@example.com",
      website: "https://example.com",
      brandPrimaryColor: "#0f766e",
      quoteId: "7b3f9a2c-1111-2222-3333-444444444444",
      issuedAt: new Date("2026-11-12T15:00:00.000Z"),
      expiresAt: "2026-12-12",
      clientName: "Client",
      projectName: "9560 County Road 99 — Multiple Services",
      propertyAddress: "9560 County Road 99",
      title: "Preliminary Estimate — Multiple Services",
      description,
      notes,
      lineItems,
      depositMode: "percent",
      depositPercent: 50,
      depositAmountCents: null,
      depositFallback: { depositMode: "none", depositPercent: 50, depositAmountCents: 0 },
    });
  }

  await check("a combined estimate renders identically twice (preview bytes == PDF bytes)", async () => {
    const p = buildConsolidatedEstimatePayload([T(PHOTO), T(VIDEO), T(GOLF)], brand);
    const input = pdfInput(p.description, p.notes, p.line_items);
    assert.equal(input.totalCents, 24900 + 39900);
    const a = await buildEstimatePdf(input, { fontRegular: regular, fontBold: bold });
    const b = await buildEstimatePdf(input, { fontRegular: regular, fontBold: bold });
    assert.equal(createHash("sha256").update(a).digest("hex"), createHash("sha256").update(b).digest("hex"));
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "combined.pdf"), a);
  });

  await check("many services paginate (multi-page) without losing sections", async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      row({
        id: `aaaaaaaa-0000-4000-8000-1000000000${String(i).padStart(2, "0")}`,
        name: `Service ${i + 1}`,
        line_items: [{ description: `Service ${i + 1}`, amount_cents: 10000 + i }],
        includes: Array.from({ length: 6 }, (_, j) => `Deliverable ${j + 1} with a description long enough to wrap onto a second line in the PDF`),
        notes: "Per-service note.",
      })
    );
    const p = buildConsolidatedEstimatePayload(many.map(T), brand);
    const bytes = await buildEstimatePdf(pdfInput(p.description, p.notes, p.line_items), { fontRegular: regular, fontBold: bold });
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 2, `expected multiple pages, got ${doc.getPageCount()}`);
    assert.equal(parseEstimateDescription(p.description).sections.length, 10);
    writeFileSync(join(OUT_DIR, "combined-long.pdf"), bytes);
  });

  console.log("Source guards");

  await check("estimates are independent: no regeneration on service changes", () => {
    const projectsRoute = readFileSync("src/app/api/projects/route.ts", "utf8");
    const servicesRoute = readFileSync("src/app/api/projects/[id]/services/route.ts", "utf8");
    const prelim = readFileSync("src/lib/preliminary-estimates.ts", "utf8");
    assert.ok(!/upsertPreliminaryEstimate/.test(projectsRoute + prelim), "regenerate path must not exist");
    assert.ok(!/project_quotes|preliminary-estimates/.test(servicesRoute), "services route must not touch estimates");
    assert.ok(!/project_name/.test(servicesRoute.replace(/\/\*[\s\S]*?\*\//g, "")), "services route must not rename projects");
  });

  await check("the request form and service picker never show prices", () => {
    for (const file of [
      "src/components/forms/public-request-form.tsx",
      "src/components/forms/service-multi-select.tsx",
      "src/components/forms/logged-in-request-form.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      assert.ok(!/formatCurrency|_cents|EstimatePdfPreview|checkout/i.test(src), `${file} references pricing`);
    }
    const lib = readFileSync("src/lib/business-services.ts", "utf8");
    const options = lib.slice(lib.indexOf("export async function listActiveServiceOptions"));
    assert.ok(!/cents|price/i.test(options.slice(0, options.indexOf("\n}\n"))), "catalog options must not carry prices");
  });

  console.log(`\n${checks} checks passed. PDFs: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
