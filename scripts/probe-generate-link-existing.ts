/**
 * Probe: generateLink type=invite against an already-existing auth user.
 * Does NOT send Resend mail — only calls Auth Admin generateLink.
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

  const existingEmail = "jackson@swiftaerialmedia.com";

  const { data: beforeList } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const before = (beforeList?.users ?? []).filter(
    (u) => (u.email || "").toLowerCase() === existingEmail.toLowerCase()
  );
  console.log("BEFORE count for email:", before.length, "ids:", before.map((u) => u.id));

  const { data, error } = await sb.auth.admin.generateLink({
    type: "invite",
    email: existingEmail,
    options: {
      data: { full_name: "GenerateLink Probe" },
      redirectTo: "https://www.shootportal.app/auth/confirm",
    },
  });

  console.log(
    "generateLink error:",
    error
      ? {
          message: error.message,
          status: (error as { status?: number }).status,
          code: (error as { code?: string }).code,
        }
      : null
  );
  console.log("generateLink user id:", data?.user?.id ?? null);
  console.log("generateLink user email:", data?.user?.email ?? null);
  console.log("hashed_token present:", Boolean(data?.properties?.hashed_token));
  console.log("action_link present:", Boolean(data?.properties?.action_link));

  const { data: afterList } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const after = (afterList?.users ?? []).filter(
    (u) => (u.email || "").toLowerCase() === existingEmail.toLowerCase()
  );
  console.log("AFTER count for email:", after.length, "ids:", after.map((u) => u.id));
  console.log("duplicate created:", after.length > before.length);

  const u = after[0];
  if (u) {
    console.log("user.invited_at:", (u as { invited_at?: string }).invited_at ?? null);
    console.log("user.email_confirmed_at:", u.email_confirmed_at ?? null);
    console.log("user.last_sign_in_at:", u.last_sign_in_at ?? null);
  }

  if (error) {
    console.log("VERDICT: (a) errors");
  } else if (data?.user?.id && data.properties?.hashed_token) {
    console.log(
      "VERDICT: (b) succeeds — returns existing user + invite token (password-setup path if emailed)"
    );
  } else {
    console.log("VERDICT: ambiguous");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
