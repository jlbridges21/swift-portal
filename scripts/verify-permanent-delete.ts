/**
 * Permanent Delete (projects / clients) — app-layer checks against an in-memory mock DB.
 * Never touches Supabase: the db object below is a fake TenantServiceClient.
 * (The SQL functions in migration v120 are exercised separately against a throwaway Postgres.)
 * Run: npx tsx scripts/verify-permanent-delete.ts
 */
import assert from "node:assert/strict";
import {
  DeleteMigrationMissingError,
  DeleteTargetNotFoundError,
  ProjectHasPaidInvoicesError,
  isMissingRpcError,
  parseProjectDeleteMode,
  permanentlyDeleteClient,
  permanentlyDeleteProject,
  planStorageRemoval,
  storageRefFromUrl,
} from "../src/lib/permanent-delete";
import type { TenantServiceClient } from "../src/lib/supabase/tenant-service";

const B = "b1000000-0000-0000-0000-000000000001";
const OTHER = "b2000000-0000-0000-0000-000000000002";
const P = "d1000000-0000-0000-0000-000000000001";

type RpcReply = { data: unknown; error: { code?: string; message?: string } | null };

function mockDb(opts: {
  rpc: RpcReply;
  projectClientId?: string | null;
  marketingFiles?: string[];
  removeError?: boolean;
  paidCount?: number;
}) {
  const calls = { rpc: [] as { fn: string; args: unknown }[], removed: [] as { bucket: string; paths: string[] }[] };
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: async () => ({ count: opts.paidCount ?? 0, error: null }),
    maybeSingle: async () => ({ data: { client_id: opts.projectClientId ?? null }, error: null }),
  };
  const db = {
    businessId: B,
    from: () => builder,
    raw: {
      rpc: async (fn: string, args: unknown) => {
        calls.rpc.push({ fn, args });
        return opts.rpc;
      },
      storage: {
        from: (bucket: string) => ({
          list: async () => ({
            data: (opts.marketingFiles ?? []).map((name) => ({ name, id: `id-${name}` })),
            error: null,
          }),
          remove: async (paths: string[]) => {
            calls.removed.push({ bucket, paths });
            return { data: null, error: opts.removeError ? { message: "boom" } : null };
          },
        }),
      },
    },
  } as unknown as TenantServiceClient;
  return { db, calls };
}

async function main() {
  let passed = 0;
  const ok = (name: string) => {
    passed += 1;
    console.log(`  ✓ ${name}`);
  };

  // --- pure helpers
  assert.equal(parseProjectDeleteMode("keep_media"), "keep_media");
  assert.equal(parseProjectDeleteMode("delete_media"), "delete_media");
  assert.equal(parseProjectDeleteMode("all"), null);
  assert.equal(parseProjectDeleteMode(undefined), null);
  ok("parseProjectDeleteMode only accepts the two modes");

  assert.ok(isMissingRpcError({ code: "PGRST202", message: "x" }, "delete_project_v120"));
  assert.ok(isMissingRpcError({ code: "42883" }, "delete_project_v120"));
  assert.ok(isMissingRpcError({ message: "Could not find the function public.delete_client_v120(p_business_id, p_client_id)" }, "delete_client_v120"));
  assert.ok(!isMissingRpcError({ code: "23503", message: "fk violation" }, "delete_project_v120"));
  assert.ok(!isMissingRpcError(null, "delete_project_v120"));
  ok("isMissingRpcError detects an unapplied migration only");

  assert.deepEqual(storageRefFromUrl(`https://x.supabase.co/storage/v1/object/public/project-media/${B}/tours/a%20b.jpg`), {
    bucket: "project-media",
    path: `${B}/tours/a b.jpg`,
  });
  assert.equal(storageRefFromUrl("https://kuula.co/thumb.jpg"), null);
  assert.equal(storageRefFromUrl("not a url"), null);
  ok("storageRefFromUrl parses Supabase URLs, ignores others");

  const plan = planStorageRemoval(
    B,
    [
      { bucket: "project-media", path: `${B}/p/a.jpg` },
      { bucket: "project-media", path: `${B}/p/a.jpg` }, // duplicate
      { bucket: "project-documents", path: `${B}/p/c.pdf` },
      { bucket: "project-media", path: `${OTHER}/p/evil.jpg` }, // other tenant
      { bucket: "project-media", path: `${B}/../${OTHER}/x.jpg` }, // traversal
      { bucket: "business-logos", path: `${B}/logo.png` }, // not a project bucket
      { bucket: "project-media", path: `${B}/marketing/${P}/logo-keep.png` }, // kept (brand profile)
    ],
    [`${B}/marketing/${P}/logo-keep.png`]
  );
  assert.deepEqual(Object.fromEntries(plan), {
    "project-media": [`${B}/p/a.jpg`],
    "project-documents": [`${B}/p/c.pdf`],
  });
  ok("planStorageRemoval: tenant prefix, project buckets only, dedupe, keep-list");

  // --- project delete: migration missing → typed error, no storage touched
  {
    const { db, calls } = mockDb({ rpc: { data: null, error: { code: "PGRST202", message: "not found" } }, marketingFiles: ["logo-1.png"] });
    await assert.rejects(permanentlyDeleteProject(db, P, "delete_media"), DeleteMigrationMissingError);
    assert.equal(calls.removed.length, 0);
    ok("project delete without v120: DeleteMigrationMissingError, nothing removed");
  }

  // --- project delete: not found (other tenant / missing) → typed error
  {
    const { db, calls } = mockDb({ rpc: { data: null, error: { code: "P0002", message: "project_not_found" } } });
    await assert.rejects(permanentlyDeleteProject(db, P, "keep_media"), DeleteTargetNotFoundError);
    assert.equal(calls.removed.length, 0);
    ok("project delete of an unknown / other-tenant project: DeleteTargetNotFoundError");
  }

  // --- keep_media: RPC args, only marketing uploads removed (no media storage)
  {
    const { db, calls } = mockDb({
      rpc: {
        data: {
          client_id: null,
          media: 4,
          tours: 1,
          models: 1,
          storage: [{ bucket: "project-media", path: `${B}/p/should-not-be-removed.jpg` }],
          tour_thumbnails: [],
        },
        error: null,
      },
      marketingFiles: ["logo-1.png"],
    });
    const summary = await permanentlyDeleteProject(db, P, "keep_media");
    assert.deepEqual(calls.rpc, [
      { fn: "delete_project_v120", args: { p_business_id: B, p_project_id: P, p_delete_media: false } },
    ]);
    assert.deepEqual(calls.removed, [{ bucket: "project-media", paths: [`${B}/marketing/${P}/logo-1.png`] }]);
    assert.equal(summary.media, 4);
    assert.equal(summary.storageObjectsRemoved, 1);
    ok("keep_media: passes p_delete_media=false, removes no media files");
  }

  // --- delete_media: media + tour thumbnails + marketing uploads, chunked by bucket
  {
    const many = Array.from({ length: 150 }, (_, i) => ({ bucket: "project-media", path: `${B}/p/${i}.jpg` }));
    const { db, calls } = mockDb({
      rpc: {
        data: {
          client_id: null,
          media: 151,
          tours: 1,
          models: 0,
          storage: [...many, { bucket: "project-documents", path: `${B}/p/c.pdf` }, { bucket: "project-media", path: `${OTHER}/evil.jpg` }],
          tour_thumbnails: [`https://x.supabase.co/storage/v1/object/public/project-media/${B}/tours/t.jpg`, "https://kuula.co/t.jpg"],
        },
        error: null,
      },
      marketingFiles: ["headshot-1.jpg"],
    });
    const summary = await permanentlyDeleteProject(db, P, "delete_media");
    assert.equal((calls.rpc[0].args as { p_delete_media: boolean }).p_delete_media, true);
    const all = calls.removed.flatMap((c) => c.paths.map((p) => `${c.bucket}:${p}`));
    assert.equal(all.length, 150 + 1 + 1 + 1); // media + doc + tour thumb + marketing
    assert.ok(!all.some((p) => p.includes(OTHER)), "never removes another tenant's object");
    assert.ok(all.includes(`project-media:${B}/tours/t.jpg`));
    assert.ok(calls.removed.every((c) => c.paths.length <= 100), "chunks of ≤100");
    assert.equal(summary.storageObjectsRemoved, 153);
    assert.equal(summary.storageObjectsFailed, 0);
    ok("delete_media: removes media, docs, tour thumbnails, marketing uploads (chunked, tenant-safe)");
  }

  // --- storage failure is reported, not thrown (DB delete already committed)
  {
    const { db } = mockDb({
      rpc: { data: { client_id: null, media: 1, tours: 0, models: 0, storage: [{ bucket: "project-media", path: `${B}/p/a.jpg` }], tour_thumbnails: [] }, error: null },
      removeError: true,
    });
    const summary = await permanentlyDeleteProject(db, P, "delete_media");
    assert.equal(summary.storageObjectsFailed, 1);
    ok("storage removal failure is counted in the summary, not thrown");
  }

  // --- paid invoices block the delete before anything runs
  {
    const { db, calls } = mockDb({ rpc: { data: {}, error: null }, paidCount: 2, marketingFiles: ["logo.png"] });
    const err = await permanentlyDeleteProject(db, P, "keep_media").catch((e) => e);
    assert.ok(err instanceof ProjectHasPaidInvoicesError);
    assert.equal(err.paidCount, 2);
    assert.equal(calls.rpc.length, 0, "RPC never called");
    assert.equal(calls.removed.length, 0, "no storage touched");
    ok("paid invoices: ProjectHasPaidInvoicesError before any RPC or storage call");
  }
  {
    // Race: paid between the app check and the SQL lock → the SQL refusal maps to the same error.
    const { db } = mockDb({ rpc: { data: null, error: { code: "P0001", message: "project_has_paid_invoices", details: "1" } } });
    await assert.rejects(permanentlyDeleteProject(db, P, "delete_media"), ProjectHasPaidInvoicesError);
    ok("paid invoices: SQL-side refusal maps to ProjectHasPaidInvoicesError");
  }

  // --- client delete
  {
    const { db, calls } = mockDb({ rpc: { data: { reassigned_projects: 1, orphaned_projects: 2 }, error: null } });
    const summary = await permanentlyDeleteClient(db, "c1");
    assert.deepEqual(calls.rpc, [{ fn: "delete_client_v120", args: { p_business_id: B, p_client_id: "c1" } }]);
    assert.deepEqual(summary, { reassignedProjects: 1, orphanedProjects: 2 });
    assert.equal(calls.removed.length, 0, "client delete never removes storage");
    ok("client delete: tenant-scoped RPC, summary, no storage removal");
  }
  {
    const { db } = mockDb({ rpc: { data: null, error: { code: "42883", message: "function delete_client_v120 does not exist" } } });
    await assert.rejects(permanentlyDeleteClient(db, "c1"), DeleteMigrationMissingError);
    const nf = mockDb({ rpc: { data: null, error: { code: "P0002", message: "client_not_found" } } });
    await assert.rejects(permanentlyDeleteClient(nf.db, "c1"), DeleteTargetNotFoundError);
    ok("client delete: missing migration / not found map to typed errors");
  }

  console.log(`\nverify-permanent-delete: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
