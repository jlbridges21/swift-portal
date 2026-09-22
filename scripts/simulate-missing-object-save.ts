/**
 * Simulate save for a nonexistent storage object — proves complete refuses insert.
 * Usage: npx tsx scripts/simulate-missing-object-save.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyStorageObject } from "../src/lib/upload/storage-verify";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
  }
}

loadEnv();

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const fakePath =
    "00000000-0000-0000-0000-000000000001/5d5c11cc-b57e-4027-8ccb-fb3105af1350/sim-missing-object-does-not-exist.bin";

  const verify = await verifyStorageObject(admin, "project-media", fakePath, {
    projectId: "5d5c11cc-b57e-4027-8ccb-fb3105af1350",
    fileName: "sim-missing.bin",
    fileSize: 100,
    mediaType: "photo",
  });

  // Mirror the complete API response when verify fails
  const response = !verify.ok
    ? {
        success: false,
        error: verify.error,
        step: "storage_verify",
        details: verify.details,
        status: 400,
      }
    : { success: true, unexpected: "verify should have failed" };

  console.log(JSON.stringify(response, null, 2));
  if (verify.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
