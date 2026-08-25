/**
 * Probe partner-only login destination on CURRENT code (before capabilities change).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] ??= v;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const partnerUserId = "510db244-5bd9-4ad3-8d23-aea480788a9a";

  const { data: profile } = await sb.from("profiles").select("*").eq("id", partnerUserId).single();
  const { data: partner } = await sb
    .from("partners")
    .select("*")
    .eq("user_id", partnerUserId)
    .maybeSingle();

  console.log("profile:", {
    id: profile?.id,
    email: profile?.email,
    role: profile?.role,
    business_id: profile?.business_id,
    client_id: profile?.client_id,
  });
  console.log(
    "partner row:",
    partner
      ? { id: partner.id, status: partner.status, user_id: partner.user_id, email: partner.email }
      : null
  );

  const { resolvePartnerAccess } = await import("../src/lib/partner-dashboard");
  const access = await resolvePartnerAccess(partnerUserId);
  console.log("resolvePartnerAccess:", access.kind);

  if (!profile?.business_id && (access.kind === "active" || access.kind === "suspended")) {
    console.log(
      "CURRENT CODE PATH: partner-only WOULD redirect to /partner (resolveLoginDestination branch c)"
    );
    console.log("PARTNER_ONLY_BEFORE_CHANGE: works when partners.user_id is linked");
  } else if (!profile?.business_id && access.kind === "none") {
    console.log("CURRENT CODE PATH: fallthrough portalUnavailableError → signOut:true");
    console.log("PARTNER_ONLY_BEFORE_CHANGE: broken — resolvePartnerAccess none");
  } else {
    console.log("UNEXPECTED state for partner-only probe");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
