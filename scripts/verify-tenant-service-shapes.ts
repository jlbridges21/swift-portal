/**
 * One-off shape tests for createTenantServiceClient. Run with:
 *   npx tsx --env-file=.env.local scripts/verify-tenant-service-shapes.ts
 */
import { createTenantServiceClient, injectBusinessId } from "../src/lib/supabase/tenant-service";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-0000000000ff";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function testInject() {
  const stamped = injectBusinessId({ name: "A" } as Record<string, unknown>, SWIFT);
  assert(stamped.business_id === SWIFT, "omitted business_id should be injected");

  const matching = injectBusinessId({ name: "A", business_id: SWIFT }, SWIFT);
  assert(matching.business_id === SWIFT, "matching business_id should be kept");

  let threw = false;
  try {
    injectBusinessId({ name: "A", business_id: OTHER }, SWIFT);
  } catch {
    threw = true;
  }
  assert(threw, "mismatched business_id must throw");

  const rows = injectBusinessId([{ name: "A" }, { name: "B", business_id: SWIFT }], SWIFT);
  assert(rows[0].business_id === SWIFT && rows[1].business_id === SWIFT, "array inject");
  console.log("injectBusinessId: ok");
}

async function testShapes() {
  const db = await createTenantServiceClient(SWIFT);

  // Shape a: select with extra filters, order, range, single-or-maybe
  const { data: one, error: selectError } = await db
    .from("clients")
    .select("id, name, business_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(0, 0)
    .maybeSingle();

  assert(!selectError, `shape a failed: ${selectError?.message}`);
  if (one) {
    assert(one.business_id === SWIFT, "shape a returned a non-Swift client");
  }
  console.log("shape a (select + filters + order + range + maybeSingle): ok", one ? `id=${one.id}` : "empty");

  // Shape b: insert array then .select(), then clean up
  const marker = `tenant-service-shape-b-${Date.now()}`;
  const { data: inserted, error: insertError } = await db
    .from("activity_logs")
    .insert([
      {
        activity_type: "status_updated",
        description: marker,
        visibility: "admin",
        metadata: { verify: "tenant-service-shape-b" },
      },
      {
        activity_type: "status_updated",
        description: `${marker}-2`,
        visibility: "admin",
        metadata: { verify: "tenant-service-shape-b" },
      },
    ])
    .select("id, business_id, description");

  if (insertError || !inserted || inserted.length !== 2) {
    throw new Error(`shape b insert failed: ${insertError?.message ?? `got ${inserted?.length} rows`}`);
  }
  assert(
    inserted.every((row) => row.business_id === SWIFT),
    "shape b insert did not stamp Swift business_id"
  );
  console.log("shape b (insert array + select): ok", inserted.map((r) => r.id).join(","));

  const ids = inserted.map((r) => r.id);
  const { error: delError } = await db.from("activity_logs").delete().in("id", ids);
  assert(!delError, `shape b cleanup failed: ${delError?.message}`);
  console.log("shape b cleanup: ok");
}

testInject();
testShapes()
  .then(() => {
    console.log("ALL TENANT SERVICE SHAPE TESTS PASSED");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
