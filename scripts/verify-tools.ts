/**
 * Unit tests for the free pricing tools' math (src/lib/tools/pricing-math.ts).
 * Usage: npx tsx scripts/verify-tools.ts
 */
import {
  calculateDrone,
  calculateRealEstate,
  clampNumber,
  formatHours,
  formatMoney,
  marginOf,
  marginToMarkup,
  markupOf,
  overheadPerJob,
  priceFromCost,
  quoteTotals,
  realEstateTiers,
  roundUpTo,
  type DroneInputs,
  type RealEstateInputs,
} from "../src/lib/tools/pricing-math";
import { DRONE_DEFAULTS, droneInputs, REAL_ESTATE_DEFAULTS, realEstatePriceSheet, sanitizeDroneState, sanitizeRealEstateState } from "../src/lib/tools/defaults";
import { blankQuote, invoiceAmounts } from "../src/lib/tools/quote-model";
import { sanitizeBrand, EMPTY_BRAND } from "../src/lib/tools/brand";

let passed = 0;
let failed = 0;
function assert(cond: unknown, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}
const near = (a: number, b: number, eps = 0.005) => Math.abs(a - b) <= eps;
function section(name: string) {
  console.log(`• ${name}`);
}

section("Input sanitizing");
assert(clampNumber("12.5", 0, 100) === 12.5, "numeric strings parse");
assert(clampNumber("$1,250", 0, 5000) === 1250, "currency formatting stripped");
assert(clampNumber(-5, 0, 100) === 0, "negative clamped to min");
assert(clampNumber(NaN, 0, 100, 7) === 7, "NaN falls back");
assert(clampNumber("abc", 0, 100) === 0, "garbage → 0");
assert(clampNumber(1e12, 0, 100) === 100, "huge clamped to max");

section("Margin vs markup");
assert(near(priceFromCost(100, 30, "margin"), 142.857, 0.001), "30% margin on $100 cost = $142.86");
assert(near(priceFromCost(100, 30, "markup"), 130), "30% markup on $100 cost = $130");
assert(near(marginOf(142.857142857, 100), 0.3, 1e-6), "margin of result is 30%");
assert(near(markupOf(130, 100) as number, 0.3), "markup of result is 30%");
assert(markupOf(100, 0) === null, "markup undefined at zero cost");
assert(near(marginToMarkup(50), 100), "50% margin = 100% markup");
assert(near(marginToMarkup(20), 25), "20% margin = 25% markup");
assert(Number.isFinite(priceFromCost(100, 100, "margin")), "100% margin is capped, never infinite");
assert(near(priceFromCost(100, 99, "margin"), 2000), "margin capped at 95% → $2,000 on $100");
assert(priceFromCost(0, 40, "margin") === 0, "zero cost → zero price");
assert(priceFromCost(-50, 40, "margin") === 0, "negative cost treated as zero");

section("Rounding up");
assert(roundUpTo(142.86, 5) === 145, "round up to $5");
assert(roundUpTo(140, 5) === 140, "exact multiples stay put");
assert(roundUpTo(140.001, 5) === 140, "float noise does not jump a step");
assert(roundUpTo(101, 25) === 125, "round up to $25");
assert(roundUpTo(99.999, 0) === 100, "step 0 rounds to cents");

section("Overhead");
assert(overheadPerJob(12000, 120) === 100, "$12,000 / 120 jobs = $100");
assert(overheadPerJob(12000, 0) === 0, "zero jobs → no allocation (no divide by zero)");

const drone: DroneInputs = {
  planningHours: 1,
  flightHours: 2,
  editingHours: 3,
  travelHours: 1,
  travelMiles: 50,
  hourlyRate: 60,
  mileageRate: 0.5,
  jobCosts: 40,
  annualOverhead: 9000,
  jobsPerYear: 90,
  profitPct: 25,
  profitMode: "margin",
  rushPct: 0,
  depositPct: 50,
  roundTo: 0,
  extras: [
    { id: "a", label: "Extra edit", enabled: true, hours: 1, cost: 10 },
    { id: "b", label: "Off", enabled: false, hours: 9, cost: 999 },
  ],
};

section("Drone calculator");
const d = calculateDrone(drone);
// hours = 1+2+3+1 + 1 extra = 8; labor 480; travel 25; overhead 100; direct 40+10 = 50 → cost 655
assert(d.hours === 8, "hours include enabled extras only");
assert(d.laborCost === 480 && d.travelCost === 25 && d.overheadCost === 100 && d.directCosts === 50, "cost components");
assert(d.totalCost === 655, "total cost $655");
assert(near(d.price, 873.33), "25% margin → $873.33");
assert(near(d.marginPct, 25, 0.01), "realized margin 25%");
assert(near(d.profit, 218.33), "profit = price − cost");
assert(near(d.deposit, 436.67) && near(d.deposit + d.balance, d.price), "deposit + balance = price");
assert(d.effectiveHourly !== null && near(d.effectiveHourly, 873.33 / 8, 0.01), "effective hourly = price / hours");
const dMarkup = calculateDrone({ ...drone, profitMode: "markup" });
assert(near(dMarkup.price, 818.75), "25% markup → $818.75");
const dRush = calculateDrone({ ...drone, rushPct: 20, roundTo: 25 });
assert(near(dRush.rushAmount, 174.67, 0.01) && dRush.price === 1050, "rush 20% then round up to $25 → $1,050");
assert(dRush.marginPct >= 25, "rounding up never lowers the margin below target");
const dZero = calculateDrone({ ...drone, planningHours: 0, flightHours: 0, editingHours: 0, travelHours: 0, travelMiles: 0, jobCosts: 0, annualOverhead: 0, extras: [] });
assert(dZero.price === 0 && dZero.effectiveHourly === null && dZero.marginPct === 0, "all-zero inputs → $0, no NaN");
const dBad = calculateDrone({ ...drone, hourlyRate: -100 as number, flightHours: Number.NaN, profitPct: 500 });
assert(Number.isFinite(dBad.price) && dBad.laborCost >= 0, "invalid inputs never produce NaN or negatives");

const re: RealEstateInputs = {
  squareFeet: 2000,
  photoCount: 25,
  baseShootMinutes: 30,
  shootMinutesPer1000: 15,
  editMode: "inhouse",
  editMinutesPerPhoto: 3,
  outsourcedCostPerPhoto: 1.5,
  adminMinutes: 15,
  travelMinutes: 30,
  travelMiles: 20,
  hourlyRate: 60,
  mileageRate: 0.5,
  annualOverhead: 6000,
  jobsPerYear: 200,
  profitPct: 30,
  profitMode: "margin",
  roundTo: 5,
  addOns: [
    { id: "drone", label: "Drone stills", enabled: true, onSiteMinutes: 20, editMinutes: 10, cost: 0 },
    { id: "plan", label: "Floor plan", enabled: false, onSiteMinutes: 10, editMinutes: 0, cost: 20 },
  ],
};

section("Real estate calculator");
const r = calculateRealEstate(re);
// shoot 30 + 2*15 = 60 min; edit 25*3 = 75; admin 15; travel 30 → 180 min = 3 h → labor 180; travel 10; overhead 30 → cost 220
assert(r.shootMinutes === 60 && r.editMinutes === 75, "shoot and edit minutes");
assert(r.base.totalCost === 220, "base cost $220");
assert(r.base.price === 315, "30% margin → $314.29 → rounded up to $315");
const droneAddOn = r.addOns.find((a) => a.id === "drone")!;
assert(droneAddOn.cost === 30 && droneAddOn.price === 45, "drone add-on: 30 min × $60 = $30 cost → $42.86 → $45");
const plan = r.addOns.find((a) => a.id === "plan")!;
assert(plan.cost === 30 && plan.price === 45, "floor plan: $10 labor + $20 vendor = $30 → $45");
assert(r.total === 360, "total = base + enabled add-ons only");
const rOut = calculateRealEstate({ ...re, editMode: "outsourced" });
// shoot 60 + admin 15 + travel 30 = 105 min = 1.75 h → $105 labor + $10 travel + $30 overhead + $37.50 editing = $182.50
assert(rOut.base.totalCost === 182.5 && rOut.editMinutes === 0, "outsourced editing moves from time to cost");
const tiers = realEstateTiers(re);
assert(tiers.length === 4 && tiers[0].from === 0 && tiers[1].from === 1501, "four contiguous tiers");
assert(tiers.every((t, i) => i === 0 || t.price >= tiers[i - 1].price), "tier prices never decrease with size");
assert(tiers[0].photos === 19, "photo count scales with the user's photos-per-sq-ft ratio (25/2000 × 1500 ≈ 19)");
const rZeroSize = realEstateTiers({ ...re, squareFeet: 0 });
assert(rZeroSize.every((t) => t.photos === 1 && Number.isFinite(t.price)), "zero square feet does not divide by zero");

section("Quote totals");
const q = quoteTotals({
  lines: [
    { id: "1", description: "Photos", quantity: 1, unitPrice: 250 },
    { id: "2", description: "Aerials", quantity: 5, unitPrice: 19.99 },
    { id: "3", description: "Twilight (optional)", quantity: 1, unitPrice: 150, optional: true },
  ],
  discountType: "percent",
  discountValue: 10,
  taxPct: 7.5,
  depositType: "percent",
  depositValue: 50,
});
assert(q.lineTotals["2"] === 99.95, "line total = qty × unit, to cents");
assert(q.subtotal === 349.95 && q.optionalTotal === 150, "optional lines excluded from subtotal");
assert(q.discount === 35, "10% discount (rounded to cents: 34.995 → 35.00)");
assert(q.taxable === 314.95 && q.tax === 23.62, "tax on discounted amount");
assert(q.total === 338.57 && q.deposit === 169.29 && near(q.deposit + q.balance, q.total), "total, deposit, balance");
const q2 = quoteTotals({ lines: [{ id: "a", description: "x", quantity: 1, unitPrice: 100 }], discountType: "amount", discountValue: 500, taxPct: 0, depositType: "amount", depositValue: 1000 });
assert(q2.discount === 100 && q2.total === 0 && q2.deposit === 0, "discount and deposit can't exceed what they apply to");
const q3 = quoteTotals({ lines: [], discountType: "none", discountValue: 0, taxPct: 0, depositType: "none", depositValue: 0 });
assert(q3.total === 0 && q3.balance === 0, "empty quote is $0");

section("Formatting");
assert(formatMoney(1234.5) === "$1,234.50", "money format");
assert(formatMoney(1235, { whole: true }) === "$1,235", "whole dollars when no cents");
assert(formatHours(2.5) === "2 h 30 min" && formatHours(3) === "3 h", "hours format");

section("Simple drone model");
// 4 h × $75 = 300; 30 mi × $0.70 = 21; business costs 80 → cost 401; 20% margin → 501.25 → $505
const sd = calculateDrone(droneInputs(DRONE_DEFAULTS));
assert(near(sd.totalCost, 401) && sd.price === 505 && near(sd.profit, 104), `default drone job prices at $505 (got ${sd.price})`);
assert(sd.deposit === 252.5, "50% deposit on the default job");
const sdSocial = calculateDrone(droneInputs({ ...DRONE_DEFAULTS, extras: ["social"] }));
assert(near(sdSocial.hours, 5.5), "social edit extra adds 1.5 h");
const sdRush = calculateDrone(droneInputs({ ...DRONE_DEFAULTS, extras: ["rush"] }));
assert(near(sdRush.rushAmount, 125.31, 0.01) && sdRush.price === 630, `rush adds 25% before rounding (got ${sdRush.price})`);
const bad = sanitizeDroneState({ ...DRONE_DEFAULTS, jobType: "nope" as never, extras: ["rush", "evil" as never], profitPct: 400, roundTo: 7 });
assert(bad.jobType === "real-estate" && bad.extras.length === 1 && bad.profitPct === 90 && bad.roundTo === 5, "drone state is sanitized");

section("Simple real estate model");
const sheet = realEstatePriceSheet(REAL_ESTATE_DEFAULTS);
assert(sheet.packages.length === 4, "four packages");
assert(sheet.packages.every((p, i) => i === 0 || p.price > sheet.packages[i - 1]!.price), "bigger homes cost more");
assert(sheet.packages.every((p) => p.price % 5 === 0 && p.price >= p.cost), "prices rounded to $5 and never below cost");
assert(sheet.addOns.length === REAL_ESTATE_DEFAULTS.addOns.length, "one price per offered add-on");
const out = realEstatePriceSheet({ ...REAL_ESTATE_DEFAULTS, editMode: "outsourced", outsourcedCostPerPhoto: 0 });
assert(out.packages[0]!.price < sheet.packages[0]!.price, "free outsourced editing lowers the price");
const reBad = sanitizeRealEstateState({ ...REAL_ESTATE_DEFAULTS, addOns: ["drone", "x"], editMode: "z" as never });
assert(reBad.addOns.length === 1 && reBad.editMode === "inhouse", "real estate state is sanitized");

section("Invoices and brand");
const inv = { ...blankQuote("drone", "invoice"), lines: [{ id: "a", description: "Flight", quantity: 1, unitPrice: 400 }], amountPaid: 150, taxPct: 0 };
const ia = invoiceAmounts(inv);
assert(ia.total === 400 && ia.paid === 150 && ia.due === 250, "balance due = total − paid");
assert(invoiceAmounts({ ...inv, amountPaid: 9999 }).due === 0, "paid can't exceed the total");
assert(blankQuote("real-estate", "invoice").lines.every((l) => !l.optional), "invoices start without optional add-ons");
assert(sanitizeBrand({ ...EMPTY_BRAND, logo: "data:image/svg+xml;base64,PHN2Zz4=" }).logo === null, "only PNG/JPEG logos are kept");
assert(sanitizeBrand({ ...EMPTY_BRAND, name: "x".repeat(500) }).name.length === 80, "brand fields are length-limited");

// ---------------------------------------------------------------- quote PDF smoke test (node)
async function pdfSmoke() {
  console.log("• Quote PDF export");
  const { readFileSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("/fonts/")) {
      const buf = readFileSync(join(process.cwd(), "public", url));
      return new Response(buf);
    }
    return realFetch(input as RequestInfo);
  }) as typeof fetch;
  const { buildQuotePdf } = await import("../src/lib/tools/quote-pdf");
  const { blankQuote } = await import("../src/lib/tools/quote-model");
  const q = blankQuote("drone");
  q.business.name = "Example Aerial Co.";
  q.business.email = "hello@example.com";
  q.client.name = "Example Client";
  q.number = "Q-TEST-001";
  q.issued = "2026-10-15";
  q.lines = q.lines.map((l, i) => ({ ...l, unitPrice: [150, 225, 300, 75, 40][i] ?? 50 }));
  q.lines.push({ id: "long", description: "A very long service description that must wrap cleanly across several lines without overlapping the price columns at all", detail: "https://example.com/a-very-long-url-that-has-no-spaces-and-must-be-hard-broken-to-fit", quantity: 2, unitPrice: 19.99 });
  const bytes = await buildQuotePdf(q);
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  assert(head === "%PDF-", "quote PDF has a PDF header");
  assert(bytes.length > 5000, "quote PDF has content");
  const out = process.env.QUOTE_PDF_OUT;
  if (out) writeFileSync(out, bytes);

  const invBytes = await buildQuotePdf({ ...q, kind: "invoice", amountPaid: 100, paymentInfo: "Checks payable to Example Aerial Co." });
  assert(new TextDecoder().decode(invBytes.slice(0, 5)) === "%PDF-", "invoice PDF has a PDF header");
  if (process.env.INVOICE_PDF_OUT) writeFileSync(process.env.INVOICE_PDF_OUT, invBytes);

  const { buildPriceSheetPdf } = await import("../src/lib/tools/price-sheet-pdf");
  const sheetBytes = await buildPriceSheetPdf({ brand: q.business, sheet: realEstatePriceSheet(REAL_ESTATE_DEFAULTS), title: REAL_ESTATE_DEFAULTS.title, note: REAL_ESTATE_DEFAULTS.note, issued: "2026-10-15" });
  assert(new TextDecoder().decode(sheetBytes.slice(0, 5)) === "%PDF-" && sheetBytes.length > 5000, "price list PDF has content");
  if (process.env.SHEET_PDF_OUT) writeFileSync(process.env.SHEET_PDF_OUT, sheetBytes);
  globalThis.fetch = realFetch;
}

pdfSmoke()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed (incl. PDF)`);
    if (failed) process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
