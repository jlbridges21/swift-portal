/**
 * Client-side hero image optimization (src/lib/optimize-upload-image.ts).
 *
 * 1. Pure checks (no browser): type resolution, size limits, aspect-ratio fitting, encode plan.
 * 2. Browser checks: the helper is transpiled and run in headless Chromium against generated
 *    fixtures (small JPEG, >4MB noise JPEG, EXIF-rotated 4032×3024 phone photo, large PNG with
 *    transparency, large opaque WebP, GIF/TXT/corrupt/fake-HEIC/26MB files, and a browser that
 *    can't encode WebP). Outputs are inspected with sharp (format, size, dimensions, alpha,
 *    orientation via pixel colour). Nothing is uploaded; no server or database is touched.
 *
 *   npm run test:optimize-upload-image          (SKIP_BROWSER=1 for pure checks only)
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ts from "typescript";
import { chromium, type Page } from "playwright";
import {
  IMAGE_UPLOAD_HINT,
  IMAGE_UPLOAD_MAX_EDGE,
  IMAGE_UPLOAD_PROCESSED_MAX_BYTES,
  ImageOptimizationError,
  buildEncodePlan,
  canUploadOriginal,
  fitWithin,
  outputFileName,
  resolveImageType,
  validateImageForOptimization,
} from "../src/lib/optimize-upload-image";
import { preparePartnerLandingImage } from "../src/lib/partner-landing-image";

const ROOT = join(__dirname, "..");
const MB = 1024 * 1024;

let failures = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}
function throwsCode(fn: () => unknown, code: string): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof ImageOptimizationError && e.code === code;
  }
}

function pureChecks() {
  console.log("Pure checks");
  check(IMAGE_UPLOAD_HINT === "JPEG, PNG or WebP. Large images are automatically optimized.", "help text is exact");
  check(resolveImageType({ name: "a.jpg", type: "image/jpeg" }) === "image/jpeg", "jpeg by MIME");
  check(resolveImageType({ name: "a.PNG", type: "" }) === "image/png", "png by extension when MIME empty");
  check(resolveImageType({ name: "a.webp", type: "application/octet-stream" }) === "image/webp", "webp by extension when octet-stream");
  check(resolveImageType({ name: "a.gif", type: "image/gif" }) === null, "gif rejected");
  check(resolveImageType({ name: "a.jpg", type: "text/plain" }) === null, "explicit wrong MIME beats extension");
  check(resolveImageType({ name: "IMG_1.HEIC", type: "image/heic" }) === "image/heic", "heic accepted best-effort");
  check(throwsCode(() => validateImageForOptimization({ name: "a.gif", type: "image/gif", size: 10 }), "unsupported_type"), "validate: wrong type");
  check(throwsCode(() => validateImageForOptimization({ name: "a.jpg", type: "image/jpeg", size: 26 * MB }), "too_large"), "validate: >25MB");
  check(validateImageForOptimization({ name: "a.jpg", type: "image/jpeg", size: 24 * MB }) === "image/jpeg", "validate: 24MB ok");
  check(throwsCode(() => validateImageForOptimization({ name: "a.jpg", type: "image/jpeg", size: 0 }), "decode_failed"), "validate: empty file");

  const f = fitWithin(4032, 3024, 2560);
  check(f.width === 2560 && f.height === 1920, "fit 4032×3024 → 2560×1920", f);
  const p = fitWithin(3024, 4032, 2560);
  check(p.width === 1920 && p.height === 2560, "fit portrait → 1920×2560", p);
  const s = fitWithin(800, 600, 2560);
  check(s.width === 800 && s.height === 600, "never upscales", s);
  const pano = fitWithin(12000, 2000, 2560);
  check(pano.width === 2560 && pano.height === 427, "panorama keeps ratio", pano);

  check(canUploadOriginal({ type: "image/jpeg", size: 2 * MB, width: 2000, height: 1500 }), "small jpeg passes through");
  check(!canUploadOriginal({ type: "image/jpeg", size: 5 * MB, width: 2000, height: 1500 }), ">4MB re-encoded");
  check(!canUploadOriginal({ type: "image/jpeg", size: 1 * MB, width: 4000, height: 3000 }), "oversized dims re-encoded");
  check(!canUploadOriginal({ type: "image/heic", size: 1 * MB, width: 800, height: 600 }), "heic always converted");

  const plan = buildEncodePlan(4032, false);
  check(plan[0].maxEdge === IMAGE_UPLOAD_MAX_EDGE && plan[0].quality === 0.9, "plan starts at 2560 @ q0.9", plan[0]);
  check(plan.every((a, i) => i === 0 || a.maxEdge <= plan[i - 1].maxEdge), "plan edges never grow");
  check(Math.min(...plan.map((a) => a.maxEdge)) === 1280, "plan bottoms out at 1280");
  const small = buildEncodePlan(1000, false);
  check(small.every((a) => a.maxEdge === 1000), "plan for small source never upscales", small.map((a) => a.maxEdge));
  const png = buildEncodePlan(3000, true);
  check(png.length === 4 && png.every((a) => a.quality === 1), "lossless plan = edge steps only", png);

  check(outputFileName("IMG_0042.HEIC", "image/jpeg") === "IMG_0042.jpg", "rename heic → jpg");
  check(outputFileName("logo.final.png", "image/webp") === "logo.final.webp", "rename keeps inner dots");
  check(outputFileName(".png", "image/jpeg") === "image.jpg", "empty basename fallback");
}

/* ---------------------------- fixtures ---------------------------- */

function noise(width: number, height: number, channels: 3 | 4, amplitude = 255): Buffer {
  const buf = Buffer.alloc(width * height * channels);
  for (let i = 0; i < buf.length; i += 1) {
    const c = i % channels;
    if (channels === 4 && c === 3) continue;
    const x = Math.floor(i / channels) % width;
    buf[i] = (((x * 255) / width + Math.random() * amplitude) | 0) & 0xff;
  }
  return buf;
}

async function makeFixtures(dir: string) {
  const out: Record<string, string> = {};
  const save = (name: string, data: Buffer) => {
    const p = join(dir, name);
    writeFileSync(p, data);
    out[name] = p;
  };

  save("small.jpg", await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3366aa" } }).jpeg().toBuffer());
  save(
    "small-alpha.png",
    await sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.4 } } })
      .png()
      .toBuffer()
  );
  // Worst case for compression: full-amplitude noise, 4000×3000, ~15MB+.
  save("big-noise.jpg", await sharp(noise(4000, 3000, 3), { raw: { width: 4000, height: 3000, channels: 3 } }).jpeg({ quality: 95 }).toBuffer());

  // Phone photo: raw 4032×3024 landscape, EXIF orientation 6 (display = rotate 90° CW → portrait).
  // Raw top-left quadrant red; after correct rotation red ends up in the top-RIGHT.
  const W = 4032;
  const H = 3024;
  const raw = noise(W, H, 3, 60);
  for (let y = 0; y < H / 2; y += 1)
    for (let x = 0; x < W / 2; x += 1) {
      const i = (y * W + x) * 3;
      raw[i] = 230;
      raw[i + 1] = 20;
      raw[i + 2] = 20;
    }
  save("phone-exif6.jpg", await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 92 }).withMetadata({ orientation: 6 }).toBuffer());

  // Large PNG with a transparent half — must keep alpha.
  const aw = 3000;
  const ah = 2000;
  const rgba = noise(aw, ah, 4);
  for (let y = 0; y < ah; y += 1)
    for (let x = 0; x < aw; x += 1) rgba[(y * aw + x) * 4 + 3] = x < aw / 2 ? 0 : 255;
  save("alpha-large.png", await sharp(rgba, { raw: { width: aw, height: ah, channels: 4 } }).png().toBuffer());

  save("opaque-large.webp", await sharp(noise(5000, 3000, 3, 120), { raw: { width: 5000, height: 3000, channels: 3 } }).webp({ quality: 95 }).toBuffer());
  save("anim.gif", await sharp({ create: { width: 10, height: 10, channels: 3, background: "#f00" } }).gif().toBuffer());
  save("notes.txt", Buffer.from("not an image"));
  save("corrupt.jpg", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5000, 7)]));
  save("IMG_0001.HEIC", Buffer.concat([Buffer.from("....ftypheic"), Buffer.alloc(4000, 1)]));
  save("huge.jpg", Buffer.alloc(26 * MB, 1));
  return out;
}

/* ---------------------------- browser ----------------------------- */

type RunResult =
  | { ok: true; optimized: boolean; name: string; type: string; size: number; width: number; height: number; b64: string; ms: number }
  | { ok: false; code: string | null; message: string };

async function run(page: Page, path: string, mime?: string): Promise<RunResult> {
  const name = path.split("/").pop()!;
  await page.setInputFiles("#f", mime ? { name, mimeType: mime, buffer: readFileSync(path) } : path);
  return page.evaluate(async () => {
    const w = window as unknown as { __opt: typeof import("../src/lib/optimize-upload-image") };
    const file = (document.getElementById("f") as HTMLInputElement).files![0];
    const t = performance.now();
    try {
      const r = await w.__opt.optimizeImageForUpload(file);
      const bytes = new Uint8Array(await r.file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return {
        ok: true as const,
        optimized: r.optimized,
        name: r.file.name,
        type: r.file.type,
        size: r.file.size,
        width: r.width,
        height: r.height,
        b64: btoa(bin),
        ms: Math.round(performance.now() - t),
      };
    } catch (e) {
      return {
        ok: false as const,
        code: (e as { code?: string }).code ?? null,
        message: w.__opt.imageOptimizationErrorMessage(e),
      };
    }
  });
}

/** The upload route runs this on hero images after its type + 4MB checks; it must accept our output. */
async function serverAccepts(r: { type: string; name: string; size: number; b64: string }): Promise<boolean> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(r.type) || r.size > IMAGE_UPLOAD_PROCESSED_MAX_BYTES) return false;
  try {
    const out = await preparePartnerLandingImage({ kind: "photo", buffer: Buffer.from(r.b64, "base64"), contentType: r.type, ext: r.name.split(".").pop()! });
    return out.width > 0;
  } catch {
    return false;
  }
}

async function browserChecks() {
  const dir = mkdtempSync(join(tmpdir(), "opt-upload-"));
  const fx = await makeFixtures(dir);
  const sizes = Object.fromEntries(Object.entries(fx).map(([k, p]) => [k, (readFileSync(p).length / MB).toFixed(1) + "MB"]));
  console.log("Fixtures", sizes);

  const src = readFileSync(join(ROOT, "src/lib/optimize-upload-image.ts"), "utf8");
  const js =
    ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText +
    "\nwindow.__opt = { optimizeImageForUpload, imageOptimizationErrorMessage, ImageOptimizationError };";

  const browser = await chromium.launch();
  try {
    for (const viewport of [
      { label: "desktop", width: 1280, height: 800, isMobile: false },
      { label: "mobile (iPhone-sized, touch)", width: 390, height: 844, isMobile: true },
    ]) {
      console.log(`Browser checks — ${viewport.label}`);
      const ctx = await browser.newContext({ viewport, isMobile: viewport.isMobile, hasTouch: viewport.isMobile, deviceScaleFactor: viewport.isMobile ? 3 : 1 });
      const page = await ctx.newPage();
      await page.setContent('<input id="f" type="file">');
      await page.addScriptTag({ type: "module", content: js });
      await page.waitForFunction(() => "__opt" in window);

      const small = await run(page, fx["small.jpg"]);
      check(small.ok && !small.optimized && small.size === readFileSync(fx["small.jpg"]).length, "small JPEG uploaded as-is", small.ok ? undefined : small);

      const smallAlpha = await run(page, fx["small-alpha.png"]);
      check(smallAlpha.ok && !smallAlpha.optimized && smallAlpha.type === "image/png", "small PNG uploaded as-is");

      const big = await run(page, fx["big-noise.jpg"]);
      if (big.ok) {
        const meta = await sharp(Buffer.from(big.b64, "base64")).metadata();
        check(big.type === "image/jpeg" && meta.format === "jpeg", "big JPEG → JPEG", meta.format);
        check(big.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES, `big JPEG under 4MB (${(big.size / MB).toFixed(2)}MB, ${big.width}×${big.height}, ${big.ms}ms)`);
        check(Math.abs(big.width / big.height - 4 / 3) < 0.01, "big JPEG keeps 4:3");
      } else check(false, "big JPEG optimized", big);

      const phone = await run(page, fx["phone-exif6.jpg"]);
      if (phone.ok) {
        const buf = Buffer.from(phone.b64, "base64");
        const meta = await sharp(buf).metadata();
        check(phone.optimized && phone.width === 1920 && phone.height === 2560, `phone photo → portrait 1920×2560 (${(phone.size / MB).toFixed(2)}MB, ${phone.ms}ms)`, [phone.width, phone.height]);
        check(!meta.orientation || meta.orientation === 1, "no leftover EXIF rotation", meta.orientation);
        const px = async (x: number, y: number) => {
          const { data } = await sharp(buf).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
          return [data[0], data[1], data[2]];
        };
        const tr = await px(1800, 100);
        const tl = await px(100, 100);
        check(tr[0] > 180 && tr[1] < 80 && tl[0] < 180, "pixels rotated correctly (red top-right, not top-left)", { tr, tl });
        check(phone.name === "phone-exif6.jpg", "filename kept with .jpg");
        check(await serverAccepts(phone), "server pipeline accepts phone output");
      } else check(false, "phone photo optimized", phone);

      const alpha = await run(page, fx["alpha-large.png"]);
      if (alpha.ok) {
        const buf = Buffer.from(alpha.b64, "base64");
        const meta = await sharp(buf).metadata();
        const { data } = await sharp(buf).ensureAlpha().extract({ left: 10, top: 10, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
        check(alpha.type === "image/webp" && meta.format === "webp" && meta.hasAlpha === true, "transparent PNG → WebP with alpha", { type: alpha.type, hasAlpha: meta.hasAlpha });
        check(data[3] === 0, "transparent pixels stay transparent", data[3]);
        check(alpha.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES && alpha.width === 2560 && alpha.height === 1707, `alpha output ${alpha.width}×${alpha.height}, ${(alpha.size / MB).toFixed(2)}MB`);
        check(alpha.name === "alpha-large.webp", "alpha file renamed .webp", alpha.name);
        check(await serverAccepts(alpha), "server pipeline accepts WebP-with-alpha output");
      } else check(false, "alpha PNG optimized", alpha);

      const webp = await run(page, fx["opaque-large.webp"]);
      check(webp.ok && webp.type === "image/jpeg" && webp.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES && webp.width === 2560, "opaque large WebP → JPEG ≤4MB", webp.ok ? { type: webp.type, w: webp.width } : webp);

      for (const [name, code] of [
        ["anim.gif", "unsupported_type"],
        ["notes.txt", "unsupported_type"],
        ["corrupt.jpg", "decode_failed"],
        ["IMG_0001.HEIC", "decode_failed"],
        ["huge.jpg", "too_large"],
      ] as const) {
        const r = await run(page, fx[name]);
        check(!r.ok && r.code === code && r.message.length > 10, `${name} → ${code}: "${r.ok ? "" : r.message}"`, r.ok ? "resolved" : r.code);
      }

      // Browser that can't encode WebP (canvas.toBlob silently returns PNG) → PNG fallback, still ≤4MB.
      await page.evaluate(() => {
        const orig = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
          return orig.call(this, cb, type === "image/webp" ? "image/png" : type, q);
        };
      });
      const fallback = await run(page, fx["alpha-large.png"]);
      if (fallback.ok) {
        const meta = await sharp(Buffer.from(fallback.b64, "base64")).metadata();
        check(fallback.type === "image/png" && meta.hasAlpha === true && fallback.size <= IMAGE_UPLOAD_PROCESSED_MAX_BYTES, `no-WebP browser → PNG with alpha ${fallback.width}×${fallback.height} ${(fallback.size / MB).toFixed(2)}MB`);
      } else check(false, "no-WebP fallback", fallback);
      await ctx.close();
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  pureChecks();
  if (!process.env.SKIP_BROWSER) await browserChecks();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

void main();
