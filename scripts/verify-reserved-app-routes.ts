/**
 * Ensure RESERVED_APP_ROUTE_SLUGS covers every top-level src/app route segment.
 * Usage: npx tsx scripts/verify-reserved-app-routes.ts
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_APP_ROUTE_SLUGS } from "../src/lib/reserved-subdomains";

const APP = join(process.cwd(), "src/app");

function topLevelRouteSegments(): string[] {
  const out: string[] = [];
  for (const name of readdirSync(APP)) {
    if (name.startsWith("[") || name.startsWith("(") || name.startsWith("_")) continue;
    const full = join(APP, name);
    if (!statSync(full).isDirectory()) continue;
    // Route if it has page/route/layout or is a known segment folder
    const hasRoute =
      existsSync(join(full, "page.tsx")) ||
      existsSync(join(full, "page.ts")) ||
      existsSync(join(full, "route.ts")) ||
      existsSync(join(full, "route.tsx")) ||
      name === "api" ||
      name === "auth";
    if (hasRoute) out.push(name);
  }
  return out.sort();
}

const CRITICAL = [
  "pricing",
  "signup",
  "login",
  "admin",
  "platform",
  "partners",
  "how-it-works",
  "contact",
  "privacy",
  "terms",
  "billing",
  "dashboard",
  "onboarding",
  "auth",
  "request",
] as const;

function main() {
  const fsRoutes = topLevelRouteSegments();
  const reserved = new Set(RESERVED_APP_ROUTE_SLUGS.map((s) => s.toLowerCase()));
  const missing = fsRoutes.filter((r) => !reserved.has(r));
  const criticalMissing = CRITICAL.filter((r) => !reserved.has(r));

  console.log("Filesystem top-level routes:", fsRoutes.join(", "));
  console.log("RESERVED_APP_ROUTE_SLUGS:", [...RESERVED_APP_ROUTE_SLUGS].join(", "));

  console.log("\nCritical route reservation (acceptance):");
  for (const r of CRITICAL) {
    console.log(`  /${r}: ${reserved.has(r) ? "RESERVED ok" : "MISSING"}`);
  }

  if (missing.length || criticalMissing.length) {
    console.error("\nFAIL — reserved list missing:", missing.length ? missing : criticalMissing);
    process.exit(1);
  }
  console.log("\nok — every filesystem top-level route is reserved for partner landing slugs.");
}

main();
