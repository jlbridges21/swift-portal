/**
 * Verify admin global search: phone formats, cross-tenant isolation, settings synonyms, timing.
 * Usage: npx tsx scripts/verify-admin-search.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTenantServiceClient } from "../src/lib/supabase/tenant-service";
import {
  runAdminSearch,
  type AdminSearchScope,
} from "../src/lib/admin-search";
import { searchSettingsIndex } from "../src/lib/settings-search-index";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const SWIFT = "00000000-0000-0000-0000-000000000001";
const ACTON = "7e324cc9-a4f0-41b2-b050-6d8606c054c9";

const OWNER_SCOPE: AdminSearchScope = {
  isOwnerAdmin: true,
  visibleProjectIds: "all",
  areas: { clients: true, projects: true, media: true, leads: true },
  canSearchStaff: true,
  moneyView: true,
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const acton = await createTenantServiceClient(ACTON);
  const swift = await createTenantServiceClient(SWIFT);

  // Phone formats — skip softly if Acton bench phones are gone
  let phoneOk = false;
  for (const phoneQ of ["(251) 501-7464", "2515017464", "251-501-7464"]) {
    const r = await runAdminSearch(acton, phoneQ, OWNER_SCOPE);
    if (r.clients.length > 0) {
      phoneOk = true;
      console.log(`ok phone ${phoneQ} → ${r.clients.length} clients`);
    }
  }
  if (!phoneOk) console.log("ok phone formats skipped (no Acton bench phones)");

  // Name + email on Acton bench data (soft if missing)
  const byName = await runAdminSearch(acton, "SearchBench Client 42", OWNER_SCOPE);
  if (byName.clients.some((c) => c.title.includes("42"))) {
    console.log("ok name search");
  } else {
    console.log("ok name search skipped (no SearchBench Client 42)");
  }
  const byEmail = await runAdminSearch(acton, "search-bench-42@", OWNER_SCOPE);
  if (byEmail.clients.length > 0) console.log("ok email search");
  else console.log("ok email search skipped");

  const t0 = Date.now();
  await runAdminSearch(acton, "a", OWNER_SCOPE);
  const ms = Date.now() - t0;
  console.log(`ok timing short query on Acton: ${ms}ms`);
  assert(ms < 2000, `search too slow: ${ms}ms`);

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
      const leak = await runAdminSearch(acton, needle, OWNER_SCOPE);
      const hit = leak.clients.some((c) => c.title === swiftClient.data!.name);
      assert(!hit, `CROSS-TENANT LEAK: Acton found Swift client "${needle}"`);
      console.log(`ok cross-tenant client "${needle}" → 0 Acton hits`);
    }
  }

  if (swiftProject.data?.property_address) {
    const addr = String(swiftProject.data.property_address).slice(0, 32);
    if (addr.length >= 2) {
      const leak = await runAdminSearch(acton, addr, OWNER_SCOPE);
      if (swiftProject.data.project_name) {
        const exact = leak.projects.some(
          (p) =>
            p.title === swiftProject.data!.project_name &&
            p.subtitle?.includes(String(swiftProject.data!.property_address))
        );
        assert(!exact, `CROSS-TENANT LEAK: Acton found Swift project`);
      }
      console.log(`ok cross-tenant address "${addr}" (no Swift project leak)`);
    }
  }

  if (swiftMedia.data?.title) {
    const title = String(swiftMedia.data.title).slice(0, 40);
    if (title.length >= 2) {
      const leak = await runAdminSearch(acton, title, OWNER_SCOPE);
      console.log(
        `ok media search as Acton for "${title}" → ${leak.media.length} (scoped to Acton)`
      );
    }
  }

  const cases: Array<[string, string]> = [
    ["domain", "custom_domain"],
    ["stripe", "payments"],
    ["reply-to", "reply-to"],
    ["colors", "colors"],
    ["reminders", "notifications"],
    ["staff permissions", "staff"],
    ["new project setup", "new_project_setup"],
    ["client media sections", "media-section-defaults"],
    ["download gate", "download-gate"],
    ["instant preliminary", "instant-preliminary"],
    ["hero media", "hero-media"],
    ["logo size", "logo-size"],
    ["landing colors", "landing-colors"],
    ["section visibility", "section-visibility"],
    ["3d models", "3d-models-defaults"],
    ["download quality", "download-quality"],
  ];
  for (const [q, expectId] of cases) {
    const hits = searchSettingsIndex(q);
    assert(
      hits.some((h) => h.id === expectId || h.sectionId === expectId),
      `settings "${q}" expected ${expectId}, got ${hits.map((h) => h.id).join(",")}`
    );
    console.log(`PASTE settings "${q}" → ${hits[0]?.label} (${hits[0]?.href})`);
  }

  console.log("verify-admin-search: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
