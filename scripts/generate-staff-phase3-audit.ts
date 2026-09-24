/**
 * Generate docs/STAFF-PHASE3-ENFORCEMENT-AUDIT.md from Phase 1 inventory + current gates.
 * Usage: npx tsx scripts/generate-staff-phase3-audit.ts
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const phase1 = readFileSync("docs/STAFF-PHASE1-ADMIN-CHECK-AUDIT.md", "utf8");
const rows: { n: number; fileLine: string; what: string }[] = [];
for (const line of phase1.split("\n")) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/);
  if (m) rows.push({ n: Number(m[1]), fileLine: m[2], what: m[3].trim() });
}

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

type Hit = { file: string; line: number; text: string };
const hits: Hit[] = [];
const patterns = [
  /staffCan\s*\(/,
  /requireAdminApi\s*\(/,
  /requireAdminPage\s*\(/,
  /requireAdmin\s*\(/,
  /adminOnly:\s*true/,
  /passesAccessGate\s*\(/,
  /assertNeverDelegableBlocked\s*\(/,
  /canAccessProject\s*\(/,
  /staffMayAccessAdminPath\s*\(/,
  /visibleProjectIdsFor\s*\(/,
  /staffShouldReceiveNotification\s*\(/,
];

for (const f of walk("src")) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((text, i) => {
    if (patterns.some((p) => p.test(text))) {
      hits.push({ file: f, line: i + 1, text: text.trim().slice(0, 140) });
    }
  });
}

function inferKey(file: string, text: string): string {
  const staffCan = text.match(/staffCan\([^,]+,\s*["']([^"']+)["']/);
  if (staffCan) return staffCan[1];
  const perm = text.match(/permission:\s*["']([^"']+)["']/);
  if (perm) return perm[1];
  const area = text.match(/area:\s*["']([^"']+)["']/);
  if (area) return `area.${area[1]}`;
  if (/adminOnly:\s*true/.test(text)) return "admin only";
  if (
    /billing|stripe\/connect|custom-domain|onboarding|admin\/settings|admin\/staff|admin\/email|admin\/push|admin\/services|leads|platform/.test(
      file
    )
  ) {
    return "admin only";
  }
  if (/media/.test(file)) return "area.media";
  if (/clients/.test(file)) return "area.clients";
  if (/messages/.test(file)) return "area.messages";
  if (/calendar/.test(file)) return "area.calendar";
  if (
    /projects|quotes|payments|revisions|shoot|video-review|asset-review|tours|project-3d|shares|link-access|project-staff/.test(
      file
    )
  ) {
    return "area.projects";
  }
  if (/middleware|admin-access|staff-access|notifications/.test(file)) return "(path / helper)";
  return "admin only";
}

const hitMap = new Map(hits.map((h) => [`${h.file}:${h.line}`, h]));

let md = `# Staff Phase 3 — enforcement audit

Maps the Phase 1 **172** admin-check inventory to the permission key (or **admin only**) enforced in Phase 3.

Source: \`docs/STAFF-PHASE1-ADMIN-CHECK-AUDIT.md\` + current \`staffCan\` / \`requireAdminApi\` / \`requireAdminPage\` / \`adminOnly\` gates.

| # | file:line | permission key / gate | notes |
|---|---|---|---|
`;

for (const r of rows) {
  // Prefer a hit on the exact line; else search nearby hits in same file
  let hit = hitMap.get(r.fileLine);
  if (!hit) {
    const [file, lineStr] = r.fileLine.split(":");
    const line = Number(lineStr);
    hit = hits.find((h) => h.file === file && Math.abs(h.line - line) <= 5);
  }
  const text = hit?.text ?? r.what;
  const key = inferKey(r.fileLine.split(":")[0]!, text);
  const notes = (hit?.text ?? r.what).replace(/\|/g, "\\|").slice(0, 110);
  md += `| ${r.n} | \`${r.fileLine}\` | **${key}** | ${notes} |\n`;
}

md += `
**Total enumerated checks: ${rows.length}**

## Additional Phase 3 gates (beyond original 172)

`;

const covered = new Set(rows.map((r) => r.fileLine));
const extra = hits.filter((h) => !covered.has(`${h.file}:${h.line}`));
for (const h of extra) {
  const key = inferKey(h.file, h.text);
  md += `- \`${h.file}:${h.line}\` → **${key}** — \`${h.text.replace(/`/g, "'").slice(0, 100)}\`\n`;
}

md += `
## Enforcement summary

| Surface | Gate |
|---|---|
| Middleware \`/admin\` paths | \`staffMayAccessAdminPath\` + \`area.*\` |
| \`/billing\`, \`/onboarding\`, \`/admin/settings\` | **admin only** → \`staffHomePath\` |
| \`/staff\` | auth required; redirect if any area |
| Project list | \`visibleProjectIdsFor\` |
| Project detail | \`canAccessProject\` → **404** |
| Money UI (QuoteSection / AdminPaymentActions) | \`money.view\` via \`canViewMoney\` |
| Notifications | \`staffShouldReceiveNotification\` + assignment / \`projects.view_all\` |
| Never-delegable | billing, subscription, staff_management, partner_program, custom_domain, stripe_connect, delete_business |
`;

writeFileSync("docs/STAFF-PHASE3-ENFORCEMENT-AUDIT.md", md);
console.log(`Wrote docs/STAFF-PHASE3-ENFORCEMENT-AUDIT.md (${rows.length} rows, ${extra.length} extra gates)`);
