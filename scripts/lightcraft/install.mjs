#!/usr/bin/env node
/**
 * Installs the LightCraft browser build (the Photo Editor's engine) into public/lightcraft/.
 *
 * LightCraft — https://github.com/storytold/lightcraft — MIT OR Apache-2.0.
 * The pinned release zip is downloaded once, verified against its published SHA-256, and only
 * the runtime files + licence/notice files are extracted. public/lightcraft/ is gitignored.
 *
 * To upgrade: bump LIGHTCRAFT_VERSION + LIGHTCRAFT_SHA256 (from the release's SHA256SUMS.txt),
 * then re-test the bridge in src/components/photo-editor/lightcraft-bridge.ts (command ids and
 * the `lightcraft:*` messages are the integration surface).
 *
 * Usage: node scripts/lightcraft/install.mjs [--force]
 * Runs automatically before `npm run dev` and `npm run build`. Set LIGHTCRAFT_SKIP_INSTALL=1 to skip.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

export const LIGHTCRAFT_VERSION = "0.20.0";
const LIGHTCRAFT_SHA256 = "720087af36cd56800974012a35badae0d235fc132dc414d1366a52e7f40b783f";
const RELEASE_URL = `https://github.com/storytold/lightcraft/releases/download/v${LIGHTCRAFT_VERSION}/lightcraft-web-${LIGHTCRAFT_VERSION}.zip`;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const target = join(root, "public", "lightcraft");
const marker = join(target, ".installed-version");
const cacheDir = join(root, "node_modules", ".cache", "lightcraft");
const cachedZip = join(cacheDir, `lightcraft-web-${LIGHTCRAFT_VERSION}.zip`);

/** Runtime files. The 16 MB Chinese UI font is intentionally not shipped (ShootPortal's UI is English; LightCraft falls back gracefully). */
const RUNTIME = new Set(["lightcraft_web.js", "lightcraft_web_bg.wasm", "worker.js"]);
const isLegal = (name) => name === "NOTICE" || name.startsWith("LICENSE") || /^OFL-.*\.txt$/.test(name);
const isSnippet = (name) => name.startsWith("snippets/") && name.endsWith(".js");

function log(msg) {
  console.log(`[lightcraft] ${msg}`);
}

async function download() {
  if (existsSync(cachedZip)) return readFileSync(cachedZip);
  log(`downloading v${LIGHTCRAFT_VERSION} (~74 MB)…`);
  const res = await fetch(RELEASE_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachedZip, buf);
  return buf;
}

async function main() {
  if (process.env.LIGHTCRAFT_SKIP_INSTALL === "1") return log("skipped (LIGHTCRAFT_SKIP_INSTALL=1)");
  const force = process.argv.includes("--force");
  const hostPage = join(here, "host.html");
  if (!force && existsSync(marker) && readFileSync(marker, "utf8").trim() === LIGHTCRAFT_VERSION) {
    // Host page is ours and may change between deploys without a LightCraft bump.
    copyFileSync(hostPage, join(target, "index.html"));
    return;
  }

  const zipBuf = await download();
  const digest = createHash("sha256").update(zipBuf).digest("hex");
  if (digest !== LIGHTCRAFT_SHA256) {
    rmSync(cachedZip, { force: true });
    throw new Error(`checksum mismatch for v${LIGHTCRAFT_VERSION}: got ${digest}`);
  }

  const zip = await JSZip.loadAsync(zipBuf);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let count = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const rel = entry.name.replace(/^lightcraft-web-[^/]+\//, "");
    if (rel.includes("..")) continue;
    if (!(RUNTIME.has(rel) || isLegal(rel) || isSnippet(rel))) continue;
    const out = join(target, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await entry.async("nodebuffer"));
    count += 1;
  }
  if (!existsSync(join(target, "lightcraft_web_bg.wasm"))) throw new Error("release zip is missing lightcraft_web_bg.wasm");
  copyFileSync(hostPage, join(target, "index.html"));
  writeFileSync(marker, `${LIGHTCRAFT_VERSION}\n`);
  log(`installed v${LIGHTCRAFT_VERSION} (${count} files) → public/lightcraft/`);
}

main().catch((err) => {
  console.error(`[lightcraft] ${err instanceof Error ? err.message : err}`);
  // A failed install must not silently ship an editor that cannot load.
  process.exit(1);
});
