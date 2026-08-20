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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

import { createClient } from "@supabase/supabase-js";

async function main() {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const email = "baxter@actonadu.com";
  // Set a known password so we can sign in for billing repro
  const { data: users } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error("user missing");
  await raw.auth.admin.updateUserById(user.id, { password: "BillingRepro-Test-1", email_confirm: true });
  console.log("password set for", email, user.id);

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: signed, error } = await anon.auth.signInWithPassword({
    email,
    password: "BillingRepro-Test-1",
  });
  if (error || !signed.session) throw error || new Error("no session");
  console.log("session ok", signed.user?.id);

  // Call billing page via fetch with cookies
  const access = signed.session.access_token;
  const refresh = signed.session.refresh_token;
  // Supabase SSR cookie names for nextjs
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = JSON.stringify({
    access_token: access,
    refresh_token: refresh,
    expires_at: signed.session.expires_at,
    expires_in: signed.session.expires_in,
    token_type: "bearer",
    user: signed.user,
  });
  // Chunk cookies like @supabase/ssr
  const cookie = `${cookieName}=${encodeURIComponent(payload)}`;

  const res = await fetch("http://127.0.0.1:3003/billing", {
    headers: {
      Host: "test.shootportal.app",
      Cookie: cookie,
    },
    redirect: "manual",
  });
  const text = await res.text();
  console.log("status", res.status, "location", res.headers.get("location"));
  console.log("body snippet", text.slice(0, 800));
  if (text.includes("Something went wrong") || text.includes("digest")) {
    console.log("ERROR PAGE DETECTED");
    console.log(text.match(/Something went wrong[\s\S]{0,400}/)?.[0]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
