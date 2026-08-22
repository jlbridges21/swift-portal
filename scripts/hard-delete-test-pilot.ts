/**
 * Hard-delete Test Pilot Drones and confirm Swift remains protected.
 * Run: npx tsx scripts/hard-delete-test-pilot.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

import { hardDeleteBusiness } from "../src/lib/platform-onboard";
import { createServiceClient } from "../src/lib/supabase/server";
import { isBusinessProtected } from "../src/lib/business-protection";
import { SWIFT_COMP_PROTECTED_BUSINESS_ID } from "../src/lib/platform-session";

const TEST_PILOT_ID = "00000000-0000-0000-0000-0000000000aa";

async function countBiz(raw: Awaited<ReturnType<typeof createServiceClient>>, table: string) {
  const { count, error } = await raw
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", TEST_PILOT_ID);
  if (error && !error.message.toLowerCase().includes("does not exist")) {
    return `err:${error.message}`;
  }
  return count ?? 0;
}

async function main() {
  const raw = await createServiceClient();

  const swiftProtected = await isBusinessProtected(SWIFT_COMP_PROTECTED_BUSINESS_ID);
  const pilotProtected = await isBusinessProtected(TEST_PILOT_ID);
  console.log({ swiftProtected, pilotProtected });
  if (!swiftProtected) throw new Error("Swift must be is_protected=true");
  if (pilotProtected) throw new Error("Test Pilot must not be is_protected");

  try {
    await hardDeleteBusiness(SWIFT_COMP_PROTECTED_BUSINESS_ID, {
      id: "00000000-0000-0000-0000-000000000000",
      email: "verify@shootportal.app",
    });
    throw new Error("Swift hard-delete should have thrown");
  } catch (err) {
    console.log("Swift hard-delete blocked:", err instanceof Error ? err.message : err);
  }

  const { data: before } = await raw
    .from("businesses")
    .select("id, name, slug")
    .eq("id", TEST_PILOT_ID)
    .maybeSingle();
  if (!before) {
    console.log("Test Pilot already absent — skip delete");
    return;
  }

  const pre = {
    projects: await countBiz(raw, "projects"),
    clients: await countBiz(raw, "clients"),
    media_assets: await countBiz(raw, "media_assets"),
    business_services: await countBiz(raw, "business_services"),
    business_settings: await countBiz(raw, "business_settings"),
    business_integrations: await countBiz(raw, "business_integrations"),
  };
  console.log("Test Pilot pre-delete counts:", pre);

  const result = await hardDeleteBusiness(TEST_PILOT_ID, {
    id: "00000000-0000-0000-0000-000000000000",
    email: "verify@shootportal.app",
  });
  console.log("hardDelete result:", result);

  const { data: after } = await raw
    .from("businesses")
    .select("id")
    .eq("id", TEST_PILOT_ID)
    .maybeSingle();
  if (after) throw new Error("businesses row still present");

  const post = {
    projects: await countBiz(raw, "projects"),
    clients: await countBiz(raw, "clients"),
    media_assets: await countBiz(raw, "media_assets"),
    business_services: await countBiz(raw, "business_services"),
    business_settings: await countBiz(raw, "business_settings"),
    business_integrations: await countBiz(raw, "business_integrations"),
  };
  console.log("Test Pilot post-delete counts:", post);

  const { data: swift } = await raw
    .from("businesses")
    .select("id, name, is_protected")
    .eq("id", SWIFT_COMP_PROTECTED_BUSINESS_ID)
    .maybeSingle();
  console.log("Swift still present:", swift);
  if (!swift?.is_protected) throw new Error("Swift missing or unprotected");

  console.log("VERIFY_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
