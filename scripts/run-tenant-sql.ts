/**
 * Run a SQL file against Supabase via the service-role SQL endpoint pattern.
 * Used for tenant-isolation harness when MCP is not in-process.
 *
 * Usage: npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-isolation.sql
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/run-tenant-sql.ts <path.sql>");
  process.exit(1);
}

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(k in process.env)) process.env[k] = v;
}

const sql = readFileSync(file, "utf8");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error(
      "Set SUPABASE_ACCESS_TOKEN (supabase login) or run tenant-isolation.sql via Supabase SQL Editor / MCP execute_sql."
    );
    console.error(`File ready: ${file} (${sql.length} bytes, project ${projectRef})`);
    process.exit(2);
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("SQL failed:", res.status, body);
    process.exit(1);
  }
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
