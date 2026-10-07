/**
 * Checks the shared estimate PDF: identical bytes, Unicode, pagination, logo failure.
 * Usage: npx tsx scripts/verify-estimate-pdf.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { quotePaymentTermsText, resolveQuoteDepositTerms } from "../src/lib/payment-quote";
import {
  buildEstimatePdf,
  estimateDepositLine,
  estimateReference,
  type EstimatePdfInput,
} from "../src/lib/estimate-pdf";

const regular = readFileSync("public/fonts/Inter-Regular.ttf");
const bold = readFileSync("public/fonts/Inter-Bold.ttf");
const issuedAt = new Date("2026-10-07T15:00:00.000Z");

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sample(overrides: Partial<EstimatePdfInput> = {}): EstimatePdfInput {
  return {
    businessName: "Harbor Studio",
    legalName: "Harbor Studio LLC",
    addressLines: ["12 Pier Street", "Lillian AL 36549"],
    phone: "(251) 555-0100",
    email: "hello@example.com",
    website: "https://example.com",
    brandPrimaryColor: "#091428",
    quoteId: "7b3f9a2c-1111-2222-3333-444444444444",
    issuedAt,
    expiresAt: "2026-11-15",
    clientName: "José Núñez",
    projectName: "9560 CR-99 — Aerial",
    propertyAddress: "9560 CR-99",
    title: "“Listing” package — 72°",
    description: "Includes the main house — and the “guest” cottage.",
    notes: "Valid for this property only.",
    lineItems: [
      { description: "Aerial stills — “twilight”", amount_cents: 15000 },
      { description: "360° tour", amount_cents: 9900 },
      { description: "José’s edit", amount_cents: 5000 },
    ],
    totalCents: 29900,
    deposit: { deposit_mode: "percent", deposit_percent: 50, deposit_amount_cents: null },
    depositFallback: { depositMode: "none", depositPercent: 50, depositAmountCents: 0 },
    ...overrides,
  };
}

async function main() {
  const assets = {
    fontRegular: new Uint8Array(regular),
    fontBold: new Uint8Array(bold),
    logo: null,
  };
  const input = sample();
  const first = await buildEstimatePdf(input, assets);
  const second = await buildEstimatePdf(input, assets);
  if (hash(first) !== hash(second)) {
    throw new Error(`renders differ ${hash(first)} ${hash(second)} len ${first.length} ${second.length}`);
  }
  if (estimateReference(input.quoteId!) !== "EST-7B3F9A2C") {
    throw new Error(`reference ${estimateReference(input.quoteId!)}`);
  }
  const deposit = estimateDepositLine(input.totalCents, input.deposit, input.depositFallback);
  const portal = quotePaymentTermsText(
    input.totalCents,
    resolveQuoteDepositTerms(input.deposit, input.depositFallback)
  );
  if (deposit !== portal) throw new Error(`deposit mismatch\n${deposit}\n${portal}`);

  const longItems = Array.from({ length: 40 }, (_, index) => ({
    description: `Line ${index + 1} — José’s “item” at 72°`,
    amount_cents: 1000 + index,
  }));
  const longPdf = await buildEstimatePdf(
    sample({
      lineItems: longItems,
      totalCents: longItems.reduce((sum, item) => sum + item.amount_cents, 0),
      deposit: { deposit_mode: "none", deposit_percent: null, deposit_amount_cents: null },
    }),
    assets
  );
  const { PDFDocument } = await import("pdf-lib");
  const longDoc = await PDFDocument.load(longPdf);
  if (longDoc.getPageCount() < 2) throw new Error(`expected multiple pages, got ${longDoc.getPageCount()}`);

  const broken = await buildEstimatePdf(input, {
    ...assets,
    logo: { bytes: new Uint8Array([1, 2, 3, 4]), type: "png" },
  });
  if (broken.length < 1000) throw new Error("broken logo blocked the pdf");

  const plain = await buildEstimatePdf(
    sample({
      deposit: { deposit_mode: "none", deposit_percent: null, deposit_amount_cents: null },
      clientName: "Client",
      title: "Aerial stills",
      description: "Three photos of the property.",
      lineItems: [
        { description: "Front elevation", amount_cents: 10000 },
        { description: "Backyard", amount_cents: 8000 },
        { description: "Twilight", amount_cents: 11900 },
      ],
    }),
    assets
  );

  mkdirSync("/tmp/estimate-samples", { recursive: true });
  writeFileSync("/tmp/estimate-samples/normal.pdf", plain);
  writeFileSync("/tmp/estimate-samples/unicode.pdf", first);
  writeFileSync("/tmp/estimate-samples/long.pdf", longPdf);
  writeFileSync("/tmp/estimate-samples/broken-logo.pdf", broken);
  console.log(
    JSON.stringify({
      identical: true,
      sha256: hash(first),
      bytes: first.length,
      pages: longDoc.getPageCount(),
      longBytes: longPdf.length,
      deposit,
      reference: estimateReference(input.quoteId!),
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exit(1);
});
