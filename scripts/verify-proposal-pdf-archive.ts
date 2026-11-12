/**
 * Offline check of proposal PDF archiving (no network, no live DB writes):
 * bucket choice, tenant path guard, write-once/409 handling, transient retry,
 * non-retry of config errors, and object metadata linking.
 *
 *   npx tsx scripts/verify-proposal-pdf-archive.ts
 */
import assert from "node:assert/strict";
import {
  PROPOSAL_PDF_BUCKET,
  archiveSentProposalPdf,
  proposalPdfPath,
  storeProposalPdf,
} from "../src/lib/proposal-delivery";

type UploadCall = { bucket: string; path: string; options: Record<string, unknown> };
type Outcome = { error: { message: string; statusCode?: string; status?: number } | null } | "throw";

function fakeDb(businessId: string, outcomes: Outcome[]) {
  const calls: UploadCall[] = [];
  const db = {
    businessId,
    raw: {
      storage: {
        from(bucket: string) {
          return {
            async upload(path: string, _body: Buffer, options: Record<string, unknown>) {
              calls.push({ bucket, path, options });
              const next = outcomes.shift() ?? { error: null };
              if (next === "throw") throw new Error("fetch failed");
              return { data: next.error ? null : { path }, error: next.error };
            },
          };
        },
      },
    },
  };
  // Only .businessId and .raw.storage are used by the archive helpers.
  return { db: db as never, calls };
}

const BIZ = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const QUOTE = "33333333-3333-4333-8333-333333333333";
const SENT = "2026-11-12T15:04:05.678Z";
const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const quote = { id: QUOTE, project_id: PROJECT, sent_at: SENT };

async function main() {
  // The bucket must be one whose MIME allowlist accepts PDFs.
  assert.equal(PROPOSAL_PDF_BUCKET, "project-documents");

  {
    const { db, calls } = fakeDb(BIZ, [{ error: null }]);
    const r = await archiveSentProposalPdf(db, quote, bytes);
    assert.deepEqual(r, { stored: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].bucket, "project-documents");
    assert.equal(calls[0].path, proposalPdfPath(BIZ, PROJECT, QUOTE, SENT));
    assert.ok(calls[0].path.startsWith(`${BIZ}/proposals/${PROJECT}/${QUOTE}/sent-`));
    assert.equal(calls[0].options.contentType, "application/pdf");
    assert.equal(calls[0].options.upsert, false);
    assert.deepEqual(calls[0].options.metadata, {
      kind: "proposal_pdf",
      business_id: BIZ,
      project_id: PROJECT,
      quote_id: QUOTE,
      sent_at: SENT,
    });
    console.log("ok  uploads to project-documents at the tenant-scoped path with link metadata");
  }

  {
    const { db, calls } = fakeDb(BIZ, [{ error: { message: "The resource already exists", statusCode: "409", status: 400 } }]);
    const r = await archiveSentProposalPdf(db, quote, bytes);
    assert.deepEqual(r, { stored: true, existed: true });
    assert.equal(calls.length, 1);
    console.log("ok  409 (retry / concurrent send) keeps the first file, no second upload");
  }

  {
    const { db, calls } = fakeDb(BIZ, ["throw", { error: { message: "Bad gateway", statusCode: "502", status: 502 } }, { error: null }]);
    const r = await archiveSentProposalPdf(db, quote, bytes);
    assert.deepEqual(r, { stored: true });
    assert.equal(calls.length, 3);
    console.log("ok  transient errors (network, 502) are retried and succeed");
  }

  {
    const { db, calls } = fakeDb(BIZ, [
      { error: { message: "mime type application/pdf is not supported", statusCode: "415", status: 415 } },
    ]);
    const r = await storeProposalPdf(db, proposalPdfPath(BIZ, PROJECT, QUOTE, SENT), bytes);
    assert.equal(r.stored, false);
    assert.match(r.error ?? "", /mime type/);
    assert.equal(calls.length, 1);
    console.log("ok  config errors (MIME) are not retried and are reported");
  }

  {
    const { db, calls } = fakeDb(BIZ, [{ error: { message: "Invalid metadata", statusCode: "400", status: 400 } }, { error: null }]);
    const r = await archiveSentProposalPdf(db, quote, bytes);
    assert.deepEqual(r, { stored: true });
    assert.equal(calls.length, 2);
    assert.ok(calls[0].options.metadata);
    assert.equal(calls[1].options.metadata, undefined);
    console.log("ok  a rejected metadata header falls back to a plain upload");
  }

  {
    const { db, calls } = fakeDb(BIZ, [
      { error: { message: "Service unavailable", statusCode: "503", status: 503 } },
      { error: { message: "Service unavailable", statusCode: "503", status: 503 } },
      { error: { message: "Service unavailable", statusCode: "503", status: 503 } },
    ]);
    const r = await archiveSentProposalPdf(db, quote, bytes);
    assert.equal(r.stored, false);
    assert.equal(calls.length, 3);
    console.log("ok  gives up after 3 attempts");
  }

  {
    const { db, calls } = fakeDb(BIZ, []);
    const other = "99999999-9999-4999-8999-999999999999";
    const r = await storeProposalPdf(db, proposalPdfPath(other, PROJECT, QUOTE, SENT), bytes);
    assert.equal(r.stored, false);
    assert.equal(calls.length, 0);
    console.log("ok  refuses a path outside the caller's business prefix");
  }

  {
    const { db, calls } = fakeDb(BIZ, []);
    const r = await archiveSentProposalPdf(db, { ...quote, sent_at: null }, bytes);
    assert.equal(r.stored, false);
    assert.equal(calls.length, 0);
    console.log("ok  unsent proposals are never archived");
  }

  console.log("\nAll proposal PDF archive checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
