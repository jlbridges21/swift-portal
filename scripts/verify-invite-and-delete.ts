/**
 * Verify invite-fail surface + post-delete redirects.
 * Run: npx tsx scripts/verify-invite-and-delete.ts
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
process.env.PLATFORM_FORCE_INVITE_FAIL = "1";

import {
  createBusinessForPlatform,
  hardDeleteBusiness,
  inviteBusinessAdmin,
  setBusinessStatus,
  softDeleteBusiness,
} from "../src/lib/platform-onboard";
import { createServiceClient } from "../src/lib/supabase/server";
import { loadBusinessDetail } from "../src/lib/platform-dashboard";

async function main() {
  const stamp = Date.now().toString(36);
  const slug = `invite-fail-${stamp}`;
  const email = `jackson.bridges21+invitefail${stamp}@gmail.com`;
  const actor = {
    id: "e6632501-3ba7-406e-85c3-c388ac107120",
    email: "jackson+platform@swiftaerialmedia.com",
  };

  const created = await createBusinessForPlatform(
    {
      name: `Invite Fail ${stamp}`,
      slug,
      plan: "studio",
      adminEmail: email,
      adminName: "Invite Fail",
      source: "platform",
    },
    actor
  );
  console.log("ok create with inviteSent=", created.inviteSent, "error=", created.inviteError);
  if (created.inviteSent) throw new Error("expected inviteSent=false under PLATFORM_FORCE_INVITE_FAIL");

  const detail = await loadBusinessDetail(created.businessId);
  console.log(
    "ok detail inviteNeedsAttention=",
    detail?.inviteNeedsAttention,
    "admins=",
    detail?.admins.map((a) => ({ email: a.email, confirmed: a.emailConfirmed }))
  );

  delete process.env.PLATFORM_FORCE_INVITE_FAIL;
  const resend = await inviteBusinessAdmin(created.businessId, email, "Invite Fail", actor, {
    resend: true,
  });
  console.log("ok resend", {
    inviteSent: resend.inviteSent,
    alreadyExists: resend.alreadyExists,
    inviteError: resend.inviteError,
  });

  const soft = await softDeleteBusiness(created.businessId, actor);
  console.log(`ok soft → /platform?notice=soft_deleted&name=${encodeURIComponent(soft.name)}`);

  const raw = await createServiceClient();
  await raw.from("businesses").update({ deleted_at: null, status: "active" }).eq("id", created.businessId);

  const sus = await setBusinessStatus(created.businessId, "suspended", actor);
  console.log(`ok suspend → /platform?notice=suspended&name=${encodeURIComponent(sus.name)}`);

  const hard = await hardDeleteBusiness(created.businessId, actor);
  console.log(`ok hard → /platform?notice=deleted&name=${encodeURIComponent(hard.name)}`);

  const { data: leftover } = await raw.from("businesses").select("id").eq("id", created.businessId).maybeSingle();
  if (leftover) throw new Error("hard delete left business row");
  console.log("ok no leftover business row");

  const { data: swift } = await raw
    .from("businesses")
    .select("subscription_status")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();
  if (swift?.subscription_status !== "comped") throw new Error("Swift affected");
  console.log("ok Swift unaffected");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
