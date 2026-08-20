/**
 * Static tenant-isolation linter. Run: npm run tenant-lint
 *
 * Fails (exit 1) on:
 *   1. createServiceClient() / service-role createClient outside the allowlist
 *   2. .from('<business-owned table>') with no business_id filter and not via
 *      createTenantServiceClient
 *   3. module-scope let/var in src/lib not on the allowlist
 *   4. Swift / Jackson / phone literals outside documented fallbacks
 *   5. getAppSettings() called without a businessId argument
 *   6. `?? LEGACY_DEFAULT_BUSINESS_ID` in src/ (authenticated fail-open)
 *   7. `?? "http://localhost` / `|| "http://localhost` outside the
 *      deployment-origin allowlist
 *
 * Known blind spots (static analysis cannot see these):
 *   - Dynamic table names: .from(variable) / .from(`${x}`)
 *   - business_id applied in a helper the call site does not show
 *   - Filters via .or / .in / .filter / RPC / .match({ business_id })
 *   - Query builder split across variables (const q = db.from(); q.eq(...))
 *   - createTenantServiceClient stored under a name other than `db`
 *   - Module-scope `const cache = new Map` (process-wide; must be keyed by
 *     businessId — host-resolution, app-settings, stripe, email, business-services)
 *   - host-resolution.ts uses @supabase/supabase-js + SERVICE_ROLE_KEY directly
 *     (caught by rule 1 via the service-role key pattern)
 *   - Cookie RLS without an extra .eq("business_id") if the chain continues
 *     on another line beyond LOOKAHEAD_LINES
 *   - String literals built at runtime ("Swift" + " Aerial Media")
 *   - SQL in supabase/ is not scanned (use tenant-sql-audit.sql)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const BUSINESS_OWNED_TABLES = new Set([
  "activity_logs",
  "asset_reviews",
  "business_integrations",
  "business_services",
  "business_settings",
  "client_message_reads",
  "client_messages",
  "client_notes",
  "clients",
  "communications",
  "email_events",
  "google_calendar_connections_v2",
  "leads",
  "media_asset_events",
  "media_asset_tags",
  "media_assets",
  "media_downloads",
  "media_folders",
  "notifications",
  "payments",
  "project_clients",
  "project_message_reads",
  "project_messages",
  "project_quotes",
  "projects",
  "properties",
  "revisions",
  "shoot_proposals",
  "tours",
]);

/** createServiceClient() / SERVICE_ROLE_KEY — each file is justified in SERVICE-ROLE-MIGRATION.md */
const SERVICE_ROLE_ALLOWLIST = new Set([
  "src/lib/supabase/server.ts",
  "src/lib/supabase/tenant-service.ts",
  "src/lib/tenant.ts",
  "src/lib/auth.ts",
  "src/lib/app-settings.ts",
  "src/lib/host-resolution.ts",
  "src/lib/portal-url.ts",
  "src/lib/stripe-webhook-events.ts",
  "src/lib/stripe-payments.ts",
  "src/lib/stripe-connect.ts",
  "src/lib/stripe-billing.ts",
  "src/lib/workflow.ts",
  "src/lib/business-services.ts",
  "src/lib/message-templates.ts",
  "src/lib/preliminary-estimates.ts",
  "src/lib/status-automation.ts",
  "src/lib/notifications.ts",
  "src/app/api/cron/workflow-reminders/route.ts",
  "src/app/api/request/route.ts",
  "src/app/api/resend/webhook/route.ts",
  "src/app/api/admin/email/domain/route.ts",
  "src/lib/platform-audit.ts",
  "src/lib/platform-onboard.ts",
  "src/lib/platform-dashboard.ts",
  "src/lib/entitlements.ts",
  "src/lib/platform-plans.ts",
  "src/lib/platform-comp.ts",
  "src/lib/auth-resend-link.ts",
  "src/lib/platform-admin-recovery.ts",
  "src/app/api/platform/impersonate/route.ts",
  "src/app/api/platform/plans/[id]/route.ts",
  "src/app/api/signup/route.ts",
  "src/app/api/signup/availability/route.ts",
]);

/**
 * Global-then-attribute lookups, email uniqueness across tenants, or
 * tenant-wrapper files that use db.from (auto-filtered).
 */
const FROM_UNSCOPED_ALLOWLIST = new Set([
  "src/lib/supabase/tenant-service.ts",
  "src/lib/stripe-payments.ts",
  "src/lib/stripe-connect.ts",
  "src/lib/stripe-billing.ts",
  "src/lib/stripe-webhook-events.ts",
  "src/app/api/resend/webhook/route.ts",
  "src/app/api/request/route.ts",
  "src/lib/auth.ts",
  "src/lib/tenant.ts",
  "src/lib/app-settings.ts",
  "src/lib/host-resolution.ts",
  "src/lib/portal-url.ts",
  "src/lib/auth-resend-link.ts",
  "src/lib/platform-admin-recovery.ts",
  "src/lib/business-services.ts",
  "src/lib/notifications.ts",
  "src/lib/workflow.ts",
  "src/lib/status-automation.ts",
  "src/lib/preliminary-estimates.ts",
  "src/lib/message-templates.ts",
  "src/app/api/cron/workflow-reminders/route.ts",
  "src/app/api/admin/email/domain/route.ts",
  "src/lib/client-portal-link.ts",
  "src/lib/project-zip-download.ts",
  "src/lib/platform-audit.ts",
  "src/lib/platform-onboard.ts",
  "src/lib/platform-dashboard.ts",
  "src/lib/entitlements.ts",
  "src/lib/platform-plans.ts",
  "src/lib/platform-comp.ts",
  "src/app/api/platform/impersonate/route.ts",
  "src/app/api/platform/plans/[id]/route.ts",
  "src/app/api/signup/route.ts",
  "src/app/api/signup/availability/route.ts",
]);

const MODULE_LET_ALLOWLIST = new Set([
  "src/lib/onesignal-client.ts",
]);

const BRAND_LITERAL_ALLOWLIST = new Set([
  "src/lib/site-metadata.ts",
  "src/app/globals.css",
  "src/lib/brand-color.ts",
]);

const LOCALHOST_FALLBACK_ALLOWLIST = new Set([
  "src/lib/portal-url.ts",
]);

const LOOKAHEAD_LINES = 12;

const SWIFT_LITERALS: { re: RegExp; label: string }[] = [
  { re: /Swift Aerial Media/, label: '"Swift Aerial Media"' },
  { re: /swiftaerialmedia\.com/, label: '"swiftaerialmedia.com"' },
  { re: /Jackson Bridges/, label: '"Jackson Bridges"' },
  { re: /6626871259/, label: "phone 6626871259" },
  { re: /2515017464/, label: "phone 2515017464" },
  { re: /662[-.\s]?687[-.\s]?1259/, label: "phone 662-687-1259" },
  { re: /251[-.\s]?501[-.\s]?7464/, label: "phone 251-501-7464" },
];

type Finding = { file: string; line: number; rule: string; detail: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

function rel(file: string): string {
  return relative(ROOT, file).replaceAll("\\", "/");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function isTenantFromCall(prefix: string, fileSource: string): boolean {
  if (!fileSource.includes("createTenantServiceClient")) return false;
  const trimmed = prefix.trimEnd();
  if (trimmed.endsWith(".raw") || /(^|[^.\w])raw$/.test(trimmed)) return false;
  if (trimmed.endsWith("storage")) return true;
  const ident = trimmed.match(/(\w+)$/)?.[1];
  if (!ident || ident === "supabase" || ident === "raw") return false;
  return ident === "db" || ident === "service" || ident === "tenantDb";
}

function chainHasBusinessId(lines: string[]): boolean {
  const block = lines.join("\n");
  return (
    /\.eq\(\s*["']business_id["']/.test(block) ||
    /\.match\(\s*\{[^}]*business_id/.test(block) ||
    /business_id\s*:/.test(block)
  );
}

function lintFile(abs: string): Finding[] {
  const file = rel(abs);
  const source = readFileSync(abs, "utf8");
  const lines = source.split("\n");
  const findings: Finding[] = [];

  if (file.startsWith("src/")) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("createServiceClient(") && !line.trim().startsWith("//")) {
        if (!SERVICE_ROLE_ALLOWLIST.has(file)) {
          findings.push({
            file,
            line: i + 1,
            rule: "1",
            detail: "createServiceClient() is not on the service-role allowlist",
          });
        }
      }
      if (
        /SUPABASE_SERVICE_ROLE_KEY/.test(line) &&
        !line.trim().startsWith("//") &&
        !SERVICE_ROLE_ALLOWLIST.has(file)
      ) {
        findings.push({
          file,
          line: i + 1,
          rule: "1",
          detail: "SUPABASE_SERVICE_ROLE_KEY used outside the service-role allowlist",
        });
      }
    }
  }

  if (file.startsWith("src/")) {
    const fromRe = /\.from\(\s*(["'])([a-z_]+)\1\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = fromRe.exec(source))) {
      const table = m[2];
      if (!BUSINESS_OWNED_TABLES.has(table)) continue;
      const lineNo = lineOf(source, m.index);
      const lineText = lines[lineNo - 1] ?? "";
      if (lineText.includes("storage.from") || /\bstorage\s*$/.test(source.slice(Math.max(0, m.index - 40), m.index))) {
        continue;
      }
      if (FROM_UNSCOPED_ALLOWLIST.has(file)) continue;

      const prefix = source.slice(Math.max(0, m.index - 80), m.index);
      if (isTenantFromCall(prefix, source)) continue;

      const lookahead = lines.slice(lineNo - 1, lineNo - 1 + LOOKAHEAD_LINES);
      if (chainHasBusinessId(lookahead)) continue;

      findings.push({
        file,
        line: lineNo,
        rule: "2",
        detail: `.from("${table}") has no visible business_id filter and is not createTenantServiceClient`,
      });
    }
  }

  if (file.startsWith("src/lib/") && file.endsWith(".ts")) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^export\s+(let|var)\s/.test(line) || /^(let|var)\s/.test(line)) {
        if (!MODULE_LET_ALLOWLIST.has(file)) {
          findings.push({
            file,
            line: i + 1,
            rule: "3",
            detail: `module-scope ${line.trim().slice(0, 60)} — not on the let/var allowlist`,
          });
        }
      }
    }
  }

  if (file.startsWith("src/") && !BRAND_LITERAL_ALLOWLIST.has(file)) {
    const scanned = stripComments(source);
    for (const { re, label } of SWIFT_LITERALS) {
      if (re.test(scanned)) {
        const idx = source.search(re);
        findings.push({
          file,
          line: idx >= 0 ? lineOf(source, idx) : 1,
          rule: "4",
          detail: `forbidden brand literal ${label}`,
        });
      }
    }
  }

  if (file.startsWith("src/")) {
    const callRe = /getAppSettings\s*\(/g;
    let cm: RegExpExecArray | null;
    while ((cm = callRe.exec(source))) {
      const after = source.slice(cm.index + cm[0].length, cm.index + cm[0].length + 80);
      const args = after.split(")")[0] ?? "";
      if (!args.trim()) {
        findings.push({
          file,
          line: lineOf(source, cm.index),
          rule: "5",
          detail: "getAppSettings() called without a businessId",
        });
      }
    }
  }

  if (file.startsWith("src/")) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      if (/\?\?\s*LEGACY_DEFAULT_BUSINESS_ID/.test(lines[i])) {
        findings.push({
          file,
          line: i + 1,
          rule: "6",
          detail: "`?? LEGACY_DEFAULT_BUSINESS_ID` is forbidden on authenticated paths",
        });
      }
    }
  }

  if (file.startsWith("src/") && !LOCALHOST_FALLBACK_ALLOWLIST.has(file)) {
    for (let i = 0; i < lines.length; i++) {
      if (/\?\?\s*["']http:\/\/localhost/.test(lines[i]) || /\|\|\s*["']http:\/\/localhost/.test(lines[i])) {
        findings.push({
          file,
          line: i + 1,
          rule: "7",
          detail: "localhost origin fallback is not on the deployment-origin allowlist",
        });
      }
    }
  }

  return findings;
}

function main() {
  if (!existsSync(SRC)) {
    console.error("src/ not found");
    process.exit(1);
  }

  const files = walk(SRC);
  const findings = files.flatMap(lintFile);

  if (findings.length) {
    console.error(`tenant-lint: ${findings.length} finding(s)\n`);
    for (const f of findings) {
      console.error(`  [${f.rule}] ${f.file}:${f.line}  ${f.detail}`);
    }
    process.exit(1);
  }

  console.log(`tenant-lint: ok (${files.length} files)`);
}

main();
