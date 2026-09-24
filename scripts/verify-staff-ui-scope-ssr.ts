/**
 * One-shot UI SSR scrape for staff scope — Swift only.
 * Prints page text snippets + leak check. Cleans up unless KEEP_UI_STAFF=1.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assignProjectStaff,
  inviteStaffMember,
  disableStaffMember,
} from "../src/lib/staff";
import { applyStaffPermissionPreset } from "../src/lib/staff-permissions";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

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

function extractText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  loadEnv();
  const stamp = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const raw = createClient(url, key, { auth: { persistSession: false } });
  const email = `ui-scope-${stamp}@swift-test.local`;
  const password = `UiScope-${stamp}!Aa`;

  const { data: admin } = await raw
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .is("disabled_at", null)
    .limit(1)
    .single();
  const actor = { id: admin!.id, email: admin!.email };

  const invited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email,
    fullName: "UI Scope Staff",
    actor,
  });
  if (!invited.ok) throw new Error(invited.error);

  try {
    await raw
      .from("profiles")
      .update({
        staff_permissions: {
          ...applyStaffPermissionPreset("coordinator"),
          "area.media": true,
          "area.messages": true,
          "area.clients": true,
          "area.projects": true,
          "media.upload": true,
          "projects.view_all": false,
        },
      })
      .eq("id", invited.userId);

    const { data: projects } = await raw
      .from("projects")
      .select("id, client_id, project_name")
      .eq("business_id", SWIFT_ID)
      .is("deleted_at", null)
      .limit(20);
    const projectA = projects![0];
    await raw.from("project_staff").delete().eq("user_id", invited.userId);
    await assignProjectStaff({
      businessId: SWIFT_ID,
      projectId: projectA.id,
      userId: invited.userId,
      actor,
    });
    await raw.auth.admin.updateUserById(invited.userId, {
      password,
      email_confirm: true,
    });

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !session.session) throw error || new Error("login failed");

    const projectRef = new URL(url).hostname.split(".")[0];
    const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(
      JSON.stringify({
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
        expires_in: session.session.expires_in,
        token_type: session.session.token_type,
        user: session.session.user,
      })
    )}`;

    async function page(path: string) {
      const res = await fetch(`${ROOT}${path}`, {
        headers: { Cookie: cookie },
        redirect: "follow",
      });
      return { status: res.status, finalUrl: res.url, html: await res.text() };
    }

    const clients = await page("/admin/clients");
    const media = await page("/admin/media");
    const messages = await page("/admin/messages");
    const cc = await fetch(`${ROOT}/admin`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });

    // Pickers: clients API (used by dropdowns) + messages recipient list
    const clientsApi = await fetch(`${ROOT}/api/clients`, {
      headers: { Cookie: cookie },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const messagesApi = await fetch(`${ROOT}/api/messages`, {
      headers: { Cookie: cookie },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const mediaApi = await fetch(`${ROOT}/api/media/library?page=1&limit=48`, {
      headers: { Cookie: cookie },
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

    const { data: allClients } = await raw
      .from("clients")
      .select("id, name, full_name")
      .eq("business_id", SWIFT_ID)
      .is("deleted_at", null);

    const { data: pc } = await raw
      .from("project_clients")
      .select("client_id")
      .eq("project_id", projectA.id);
    const visibleIds = new Set((pc ?? []).map((r) => r.client_id));
    if (projectA.client_id) visibleIds.add(projectA.client_id);

    const clientsText = extractText(clients.html);
    const mediaText = extractText(media.html);
    const messagesText = extractText(messages.html);

    const hidden = (allClients ?? []).filter((c) => !visibleIds.has(c.id));
    const leaked = hidden.filter((c) => {
      const name = (c.full_name || c.name || "").trim();
      return name.length >= 4 && clientsText.includes(name);
    });

    const report = {
      email,
      projectA: { id: projectA.id, name: projectA.project_name, client_id: projectA.client_id },
      businessClientCount: allClients?.length,
      visibleClientCount: visibleIds.size,
      clientsPage: {
        status: clients.status,
        text: clientsText.slice(0, 1200),
      },
      mediaPage: {
        status: media.status,
        text: mediaText.slice(0, 1200),
      },
      messagesPage: {
        status: messages.status,
        text: messagesText.slice(0, 1200),
      },
      commandCenter: {
        status: cc.status,
        location: cc.headers.get("location"),
      },
      clientsApiCount: Array.isArray(clientsApi.body) ? clientsApi.body.length : "?",
      mediaApiTotal: (mediaApi.body as { total?: number })?.total,
      messagesApiCount: Array.isArray(messagesApi.body)
        ? messagesApi.body.length
        : (messagesApi.body as { conversations?: unknown[] })?.conversations?.length ?? "?",
      leakedHiddenClientNamesInClientsHtml: leaked.map((c) => c.full_name || c.name),
    };

    writeFileSync("/tmp/staff-ui-scope-report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (leaked.length) {
      throw new Error(`SSR clients page leaked hidden clients: ${leaked.map((c) => c.name).join(", ")}`);
    }
    console.log("\n✅ UI SSR scope check PASS (no hidden client names in Clients HTML)");
  } finally {
    if (process.env.KEEP_UI_STAFF === "1") {
      console.log("KEEP_UI_STAFF=1 — left user", email, password);
    } else {
      await raw.from("project_staff").delete().eq("user_id", invited.userId);
      await disableStaffMember({ businessId: SWIFT_ID, userId: invited.userId, actor });
      await raw.from("profiles").delete().eq("id", invited.userId);
      await raw.auth.admin.deleteUser(invited.userId);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
