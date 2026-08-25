/**
 * Security probe: non-partner must get 404/403 on partner DATA routes.
 * Run: npx tsx scripts/verify-partner-entry-security.ts
 */
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

const PARTNER_API_ROUTES = [
  "/api/partner/me",
  "/api/partner/referrals",
  "/api/partner/commissions",
  "/api/partner/payouts",
  "/api/partner/landing",
];

const PARTNER_DASHBOARD_PAGES = ["/partner/dashboard", "/partner/landing"];

async function fetchBody(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* html or empty */
  }
  return { status: res.status, body };
}

async function main() {
  loadEnvLocal();
  const base = process.env.PARTNER_PROBE_BASE_URL || "http://localhost:3000";

  console.log("=== Unauthenticated partner API probes ===");
  for (const path of PARTNER_API_ROUTES) {
    const { status, body } = await fetchBody(`${base}${path}`);
    console.log(`${path} → ${status}`, JSON.stringify(body));
  }

  console.log("\n=== Unauthenticated partner dashboard pages ===");
  for (const path of PARTNER_DASHBOARD_PAGES) {
    const { status, body } = await fetchBody(`${base}${path}`);
    const preview =
      typeof body === "string"
        ? body.includes("404") || body.length < 200
          ? `[html ${body.length} chars, has404=${body.includes("404")}]`
          : body.slice(0, 120)
        : body;
    console.log(`${path} → ${status}`, preview);
  }

  console.log("\n=== Entry /partner (unauthenticated → login redirect) ===");
  const entry = await fetchBody(`${base}/partner`);
  console.log(`/partner → ${entry.status}`, typeof entry.body === "string" ? entry.body.slice(0, 80) : entry.body);

  const { canAccessPartnerEntry, showPartnerNavItem } = await import("../src/lib/capabilities");
  console.log("\n=== Capability matrix (static) ===");
  const businessAdmin = {
    business: { active: true, businessId: "x", role: "admin" as const },
    partner: { active: false, suspended: false, partnerId: null },
    client: { active: false, clientId: null },
    platform: { active: false },
  };
  const clientOnly = {
    business: { active: true, businessId: "x", role: "client" as const },
    partner: { active: false, suspended: false, partnerId: null },
    client: { active: true, clientId: "c" },
    platform: { active: false },
  };
  const activePartner = {
    ...businessAdmin,
    partner: { active: true, suspended: false, partnerId: "p" },
  };
  console.log("business admin nav:", showPartnerNavItem(businessAdmin), "entry:", canAccessPartnerEntry(businessAdmin));
  console.log("client-only nav:", showPartnerNavItem(clientOnly), "entry:", canAccessPartnerEntry(clientOnly));
  console.log("active partner nav:", showPartnerNavItem(activePartner), "entry:", canAccessPartnerEntry(activePartner));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
