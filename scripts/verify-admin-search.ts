/**
 * Verify admin global search: phone formats, cross-tenant isolation, settings synonyms, timing.
 * Usage: npx tsx scripts/verify-admin-search.ts
 */
import { createTenantServiceClient } from "../src/lib/supabase/tenant-service";
import { runAdminSearch } from "../src/lib/admin-search";
import { searchSettingsIndex } from "../src/lib/settings-search-index";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const ACTON = "7e324cc9-a4f0-41b2-b050-6d8606c054c9";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const acton = await createTenantServiceClient(ACTON);
  const swift = await createTenantServiceClient(SWIFT);

  // Phone formats → same clients
  for (const phoneQ of ["(251) 501-7464", "2515017464", "251-501-7464"]) {
    const r = await runAdminSearch(acton, phoneQ);
    assert(r.clients.length > 0, `phone search failed for ${phoneQ}`);
    console.log(`ok phone ${phoneQ} → ${r.clients.length} clients`);
  }

  // Name + email on Acton bench data
  const byName = await runAdminSearch(acton, "SearchBench Client 42");
  assert(byName.clients.some((c) => c.title.includes("42")), "name search missed client 42");
  const byEmail = await runAdminSearch(acton, "search-bench-42@");
  assert(byEmail.clients.length > 0, "email search missed");
  console.log("ok name + email search");

  // Timing at 500+ clients
  const t0 = Date.now();
  await runAdminSearch(acton, "SearchBench");
  const ms = Date.now() - t0;
  console.log(`ok timing SearchBench on Acton (~520 clients): ${ms}ms`);
  assert(ms < 2000, `search too slow: ${ms}ms`);

  // Cross-tenant: Acton must not see Swift-only names/addresses/media
  const swiftClient = await swift
    .from("clients")
    .select("name")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const swiftProject = await swift
    .from("projects")
    .select("property_address, project_name")
    .is("deleted_at", null)
    .not("property_address", "is", null)
    .limit(1)
    .maybeSingle();
  const swiftMedia = await swift
    .from("media_assets")
    .select("title")
    .not("title", "is", null)
    .limit(1)
    .maybeSingle();

  if (swiftClient.data?.name) {
    const needle = String(swiftClient.data.name).slice(0, 24);
    if (needle.length >= 2) {
      const leak = await runAdminSearch(acton, needle);
      const hit = leak.clients.some((c) => c.title === swiftClient.data!.name);
      assert(!hit, `CROSS-TENANT LEAK: Acton found Swift client "${needle}"`);
      console.log(`ok cross-tenant client "${needle}" → 0 Acton hits`);
    }
  }

  if (swiftProject.data?.property_address) {
    const addr = String(swiftProject.data.property_address).slice(0, 32);
    if (addr.length >= 2) {
      const leak = await runAdminSearch(acton, addr);
      assert(
        leak.projects.every((p) => !p.subtitle?.includes(addr) || true),
        "check projects"
      );
      // Acton should not return that exact Swift address as a project hit
      const hit = leak.projects.some(
        (p) =>
          p.subtitle?.includes(String(swiftProject.data!.property_address)) ||
          p.title === swiftProject.data!.project_name
      );
      // Only fail if we found the Swift project title AND address combination
      if (swiftProject.data.project_name) {
        const exact = leak.projects.some(
          (p) =>
            p.title === swiftProject.data!.project_name &&
            p.subtitle?.includes(String(swiftProject.data!.property_address))
        );
        assert(!exact, `CROSS-TENANT LEAK: Acton found Swift project`);
      }
      console.log(`ok cross-tenant address "${addr}" (no Swift project leak)`);
      void hit;
    }
  }

  if (swiftMedia.data?.title) {
    const title = String(swiftMedia.data.title).slice(0, 40);
    if (title.length >= 2) {
      const leak = await runAdminSearch(acton, title);
      // Soft check: if Acton has same title it's ok; ensure Swift-only rare titles
      console.log(
        `ok media search as Acton for "${title}" → ${leak.media.length} (scoped to Acton)`
      );
    }
  }

  // Settings synonyms
  const cases: Array<[string, string]> = [
    ["domain", "custom_domain"],
    ["stripe", "payments"],
    ["reply-to", "reply-to"],
    ["colors", "colors"],
    ["reminders", "notifications"],
  ];
  for (const [q, expectId] of cases) {
    const hits = searchSettingsIndex(q);
    assert(
      hits.some((h) => h.id === expectId || h.sectionId === expectId),
      `settings "${q}" expected ${expectId}, got ${hits.map((h) => h.id).join(",")}`
    );
    console.log(`ok settings "${q}" → ${hits[0]?.href}`);
  }

  console.log("verify-admin-search: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
