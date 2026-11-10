#!/usr/bin/env node
/**
 * Partner document builder.
 *
 *   node docs/platform-api/partner-docs/build.mjs skyytask
 *
 * Takes the generic templates in ./template, fills them with
 * ./partners/<slug>/config.json, and renders each document to PDF using the
 * Google Chrome already installed on this Mac (headless print-to-PDF). Nothing
 * is installed. It also writes a PNG preview of every page and fails loudly if
 * any page overflows, so a broken layout is caught before anyone sees it.
 *
 * Template syntax (deliberately tiny):
 *   {{path.to.value}}            text (HTML-escaped)
 *   {{{path}}}                   raw HTML
 *   {{#each list}}…{{/each}}     loop; inside, {{this.x}} / {{this}} / {{@n}} (1-based)
 *   {{#if path}}…{{else}}…{{/if}}
 *   {{> partialName}}            include template/partials/partialName.html
 *   {{icon "name" size}}         inline Lucide icon (ISC license) as crisp SVG
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const slug = process.argv[2] || "skyytask";
const only = process.argv[3]; // optional: build just one doc id

const partnerDir = path.join(HERE, "partners", slug);
const config = JSON.parse(fs.readFileSync(path.join(partnerDir, "config.json"), "utf8"));
const templateDir = path.join(HERE, "template");
const buildDir = path.join(partnerDir, "build");
const previewDir = path.join(partnerDir, "previews");
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

// ---------------------------------------------------------------- icons
const iconCache = new Map();
function icon(name, size = 16) {
  if (!iconCache.has(name)) {
    const dir = path.join(REPO, "node_modules/lucide-react/dist/esm/icons");
    let src = fs.readFileSync(path.join(dir, `${name}.mjs`), "utf8");
    // Some icons are aliases ("export { default } from './other.mjs'"): follow them.
    const alias = src.match(/from '\.\/([\w-]+)\.mjs'/);
    if (!src.includes("__iconNode") && alias) src = fs.readFileSync(path.join(dir, `${alias[1]}.mjs`), "utf8");
    const literal = src.match(/const __iconNode = (\[[\s\S]*?\]);\n/)[1];
    // eslint-disable-next-line no-new-func
    const nodes = new Function(`return ${literal}`)();
    const inner = nodes
      .map(([tag, attrs]) => {
        const a = Object.entries(attrs)
          .filter(([k]) => k !== "key")
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ");
        return `<${tag} ${a}/>`;
      })
      .join("");
    iconCache.set(name, inner);
  }
  return `<svg class="ic" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconCache.get(name)}</svg>`;
}

// ---------------------------------------------------------------- templating
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function lookup(ctx, p) {
  if (p === "this") return ctx.this;
  if (p === "@n") return ctx["@n"];
  return p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

function render(tpl, ctx) {
  // partials first (may themselves contain tags)
  const partialRe = /\{\{>\s*([\w-]+)\s*\}\}/g;
  while (/\{\{>\s*[\w-]+\s*\}\}/.test(tpl)) {
    tpl = tpl.replace(partialRe, (_, name) =>
      fs.readFileSync(path.join(templateDir, "partials", `${name}.html`), "utf8")
    );
  }
  // each (innermost-first so nested loops work)
  const eachRe = /\{\{#each ([\w.@]+)\}\}((?:(?!\{\{#each )[\s\S])*?)\{\{\/each\}\}/;
  let m;
  while ((m = tpl.match(eachRe))) {
    const list = lookup(ctx, m[1]) || [];
    const out = list
      .map((item, i) => render(m[2], { ...ctx, this: item, "@n": i + 1, ...(typeof item === "object" ? { item } : {}) }))
      .join("");
    tpl = tpl.replace(m[0], () => out);
  }
  // if / else (innermost-first)
  const ifRe = /\{\{#if ([\w.@]+)\}\}((?:(?!\{\{#if )[\s\S])*?)\{\{\/if\}\}/;
  while ((m = tpl.match(ifRe))) {
    const [yes, no = ""] = m[2].split("{{else}}");
    tpl = tpl.replace(m[0], () => (lookup(ctx, m[1]) ? yes : no));
  }
  tpl = tpl.replace(/\{\{icon "([\w-]+)"(?: (\d+))?\}\}/g, (_, n, s) => icon(n, s ? Number(s) : 16));
  tpl = tpl.replace(/\{\{icon ([\w.]+)(?: (\d+))?\}\}/g, (_, p, s) => icon(lookup(ctx, p), s ? Number(s) : 16));
  tpl = tpl.replace(/\{\{\{\s*([\w.@]+)\s*\}\}\}/g, (_, p) => String(lookup(ctx, p) ?? ""));
  tpl = tpl.replace(/\{\{\s*([\w.@]+)\s*\}\}/g, (_, p) => {
    const v = lookup(ctx, p);
    if (v === undefined) throw new Error(`Template variable not found: ${p}`);
    return esc(v);
  });
  return tpl;
}

// Headless Chrome occasionally stalls; retry a couple of times before failing.
function chrome(args, opts) {
  for (let attempt = 1; ; attempt++) {
    try { return execFileSync(CHROME, args, opts); }
    catch (e) { if (attempt >= 3) throw e; }
  }
}

// ---------------------------------------------------------------- build
const docs = config.documents.filter((d) => !only || d.id === only);
const rel = (p) => path.relative(buildDir, p).split(path.sep).join("/");
const ctxBase = {
  ...config,
  asset: {
    template: rel(path.join(templateDir, "assets")),
    partner: rel(path.join(partnerDir, "assets")),
  },
};

let failed = false;
for (const doc of docs) {
  const tpl = fs.readFileSync(path.join(templateDir, `${doc.template}.html`), "utf8");
  const html = render(tpl, { ...ctxBase, doc });
  const htmlPath = path.join(buildDir, `${doc.id}.html`);
  fs.writeFileSync(htmlPath, html);
  const url = pathToFileURL(htmlPath).href;

  // 1. layout check: a script in the page marks overflowing pages
  const dom = chrome(
    ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000", "--window-size=816,1056", "--dump-dom", `${url}?qa=1`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], timeout: 60000 }
  );
  const pages = Number((dom.match(/data-pages="(\d+)"/) || [])[1] || 0);
  const overflow = (dom.match(/data-overflow="([^"]*)"/) || [])[1] || "";
  if (overflow) {
    failed = true;
    console.error(`✗ ${doc.id}: overflow → ${overflow}`);
  }

  // 2. PDF
  const outPdf = path.join(REPO, "docs/platform-api", doc.output);
  chrome([
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000",
    `--print-to-pdf=${outPdf}`, url,
  ], { stdio: "ignore", timeout: 90000 });

  // 3. PNG preview per page (2x for sharp inspection)
  for (let p = 1; p <= pages; p++) {
    chrome([
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000",
      "--window-size=816,1056", "--force-device-scale-factor=2",
      `--screenshot=${path.join(previewDir, `${doc.id}-p${p}.png`)}`, `${url}?page=${p}`,
    ], { stdio: "ignore", timeout: 60000 });
  }
  console.log(`${overflow ? "✗" : "✓"} ${doc.id}: ${pages} page(s) → ${path.relative(REPO, outPdf)}`);
}
if (failed) process.exit(1);
