/**
 * Repair + case-6 probe without Next.js cookies().
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] ??= v;
  }
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

async function main() {
  loadEnvLocal();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: orphans } = await sb.from("partners").select("id, email, user_id").is("user_id", null);
  const { data: profiles } = await sb.from("profiles").select("id, email");
  const byEmail = new Map(
    (profiles ?? []).map((p) => [normalize(String(p.email || "")), p.id as string])
  );

  const candidates = (orphans ?? [])
    .map((o) => {
      const profileId = byEmail.get(normalize(String(o.email || "")));
      return profileId ? { id: o.id as string, email: String(o.email), profileId } : null;
    })
    .filter(Boolean) as { id: string; email: string; profileId: string }[];

  console.log("BEFORE null user_id with profile match:", candidates.length);
  let repaired = 0;
  for (const c of candidates) {
    const { error } = await sb
      .from("partners")
      .update({ user_id: c.profileId })
      .eq("id", c.id)
      .is("user_id", null);
    if (!error) repaired += 1;
    else console.error("repair failed", c.id, error.message);
  }
  console.log("REPAIRED:", repaired);

  const { data: still } = await sb.from("partners").select("id, email").is("user_id", null);
  const after = (still ?? []).filter((o) => byEmail.has(normalize(String(o.email || "")))).length;
  console.log("AFTER null user_id with profile match:", after);

  // Case 6: existing admin email lookup
  const adminEmail = "jackson@swiftaerialmedia.com";
  console.log(
    "findProfile match for existing admin:",
    byEmail.get(normalize(adminEmail)) ?? null
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
