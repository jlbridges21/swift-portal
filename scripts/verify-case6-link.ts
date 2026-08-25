/**
 * Case 6 simulation: existing profile email must link, never invite.
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

async function main() {
  loadEnvLocal();
  const {
    findProfileIdByEmail,
    invitePartnerUser,
    linkPartnerToExistingUser,
    getPartnerById,
  } = await import("../src/lib/partners");

  const existingEmail = "cannon@swiftaerialmedia.com";
  const profileId = await findProfileIdByEmail(existingEmail);
  console.log("existing profile id:", profileId);
  if (!profileId) throw new Error("expected profile for cannon@");

  // invitePartnerUser must refuse
  try {
    await invitePartnerUser({
      email: existingEmail,
      fullName: "Cannon",
      partnerId: "00000000-0000-0000-0000-000000000001",
    });
    console.log("FAIL: invitePartnerUser should refuse existing profile");
  } catch (e) {
    console.log("OK invitePartnerUser refused:", (e as Error).message);
  }

  // Auth user count before/after generateLink already proven email_exists.
  // Simulate link path on a throwaway partner row then delete.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const code = `case6${Date.now().toString(36).slice(-6)}`;
  const { data: created, error } = await sb
    .from("partners")
    .insert({
      name: "Case6 Probe",
      email: existingEmail.replace("@", "+case6probe@"),
      brand_name: "Case6 Probe",
      referral_code: code,
      commission_rate_pct: 30,
      status: "active",
    })
    .select("*")
    .single();
  if (error || !created) throw new Error(error?.message || "insert failed");

  // Link using the EXISTING profile id (as createPartner would for matching email)
  // Use the probe partner's own email which won't match — so call linkPartnerToExistingUser
  // with the admin profile id explicitly (same code path as createPartner after findProfile).
  const link = await linkPartnerToExistingUser({
    partnerId: created.id,
    userId: profileId,
    email: existingEmail.replace("@", "+case6probe@"),
    fullName: "Case6 Probe",
  });
  console.log("link result:", link);

  const refreshed = await getPartnerById(created.id);
  console.log("partners.user_id after link:", refreshed?.user_id);
  console.log("matches existing profile:", refreshed?.user_id === profileId);

  // Auth users for cannon@ — still exactly one
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const matches = (users?.users ?? []).filter(
    (u) => (u.email || "").toLowerCase() === existingEmail.toLowerCase()
  );
  console.log("auth users for cannon@ count:", matches.length, "ids:", matches.map((u) => u.id));

  // Cleanup probe partner
  await sb.from("partners").delete().eq("id", created.id);
  console.log("cleaned up probe partner", created.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
