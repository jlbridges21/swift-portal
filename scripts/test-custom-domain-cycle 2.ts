/**
 * Exercise claim → remove → claim against Vercel for a domain (idempotency).
 * Usage: npx tsx scripts/test-custom-domain-cycle.ts portal.swiftaerialmedia.com
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  isVercelDomainApiConfigured,
  vercelAddProjectDomain,
  vercelGetProjectDomain,
  vercelRemoveProjectDomain,
} from "../src/lib/vercel-domains";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

async function cycle(domain: string, n: number) {
  console.log(`\n=== cycle ${n}: ${domain} ===`);
  const before = await vercelGetProjectDomain(domain);
  console.log("before get:", before.ok ? `ok verified=${before.data.verified}` : `fail ${before.error.status} ${before.error.message}`);

  if (!before.ok) {
    const added = await vercelAddProjectDomain(domain);
    console.log("add:", added.ok ? `ok verified=${added.data.verified}` : `fail ${added.error.status} ${added.error.message}`);
    if (!added.ok && (added.error.status === 409 || /already|conflict/i.test(added.error.message))) {
      const again = await vercelGetProjectDomain(domain);
      console.log("add-conflict get:", again.ok ? "ok" : `fail ${again.error.message}`);
      if (!again.ok) throw new Error(`cycle ${n}: cannot claim`);
    } else if (!added.ok) {
      throw new Error(`cycle ${n}: add failed`);
    }
  }

  const removed = await vercelRemoveProjectDomain(domain);
  console.log("remove:", removed.ok ? "ok" : `fail ${removed.error.status} ${removed.error.message}`);
  if (!removed.ok && removed.error.status !== 404) {
    throw new Error(`cycle ${n}: remove failed`);
  }

  const afterRemove = await vercelGetProjectDomain(domain);
  console.log("after remove get:", afterRemove.ok ? "UNEXPECTED still present" : `ok missing (${afterRemove.error.status})`);

  const reAdd = await vercelAddProjectDomain(domain);
  console.log("re-add:", reAdd.ok ? `ok verified=${reAdd.data.verified}` : `fail ${reAdd.error.status} ${reAdd.error.message}`);
  if (!reAdd.ok) {
    if (reAdd.error.status === 409) {
      const again = await vercelGetProjectDomain(domain);
      console.log("re-add conflict resolve:", again.ok ? "ok" : again.error.message);
      if (!again.ok) throw new Error(`cycle ${n}: reconnect failed`);
    } else {
      throw new Error(`cycle ${n}: re-add failed`);
    }
  }

  const final = await vercelGetProjectDomain(domain);
  console.log("final get:", final.ok ? `ok verified=${final.data.verified}` : `fail ${final.error.message}`);
  if (!final.ok) throw new Error(`cycle ${n}: final missing`);
}

async function main() {
  const domain = process.argv[2] || "portal.swiftaerialmedia.com";
  if (!isVercelDomainApiConfigured()) {
    console.error("VERCEL_API_TOKEN / VERCEL_PROJECT_ID not configured");
    process.exit(1);
  }
  for (let i = 1; i <= 3; i++) {
    await cycle(domain, i);
  }
  console.log("\nAll 3 connect/disconnect/reconnect cycles passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
