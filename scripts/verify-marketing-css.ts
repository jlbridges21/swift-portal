/**
 * Guard: marketing.css must stay scoped under .marketing-root.
 * Fails on top-level :root, html, body, @theme, or any --color-* definition.
 *
 * Run: npx tsx scripts/verify-marketing-css.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "src/app/(marketing)/marketing.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function main() {
  const raw = readFileSync(FILE, "utf8");
  const css = stripComments(raw);
  const findings: string[] = [];

  for (const [label, re] of [
    [":root", /^\s*:root\b/m],
    ["html", /^\s*html\b/m],
    ["body", /^\s*body\b/m],
    ["@theme", /^\s*@theme\b/m],
  ] as const) {
    if (re.test(css)) {
      findings.push(`top-level ${label} selector/at-rule is not allowed`);
    }
  }

  if (/--color-[a-zA-Z0-9-]+\s*:/.test(css)) {
    findings.push("must not redefine --color-* (use --mk-* instead)");
  }

  if (findings.length) {
    console.error(`verify-marketing-css: ${findings.length} finding(s) in ${FILE}`);
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log("verify-marketing-css: ok");
}

main();
