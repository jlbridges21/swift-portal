/**
 * Public video sharing — pure-logic checks (no database).
 * Run: npm run test:video-shares
 */
import assert from "node:assert/strict";
import {
  BACKGROUND_EMBED_OPTIONS,
  DEFAULT_EMBED_OPTIONS,
  aspectPaddingPercent,
  buildEmbedCode,
  buildEmbedSrc,
  embedPresetFor,
  embedQueryString,
  isWellFormedPublicVideoId,
  parseEmbedQuery,
  sanitizeEmbedOptions,
} from "../src/lib/video-embed-options";
import { estimateBufferedBytes } from "../src/lib/video-public-shares";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("video-embed-options");

check("default options produce a clean URL", () => {
  assert.equal(embedQueryString(DEFAULT_EMBED_OPTIONS), "");
  assert.equal(buildEmbedSrc("https://x.test/embed/abc", DEFAULT_EMBED_OPTIONS), "https://x.test/embed/abc");
});

check("background preset round-trips through the query string", () => {
  const qs = embedQueryString(BACKGROUND_EMBED_OPTIONS);
  assert.equal(qs, "?autoplay=1&muted=1&loop=1&controls=0&title=0&branding=0&fit=cover");
  assert.deepEqual(parseEmbedQuery(new URLSearchParams(qs.slice(1))), BACKGROUND_EMBED_OPTIONS);
});

check("background=1 shorthand and YouTube-style mute=1 are accepted", () => {
  assert.deepEqual(parseEmbedQuery({ background: "1" }), BACKGROUND_EMBED_OPTIONS);
  assert.equal(parseEmbedQuery({ mute: "1" }).muted, true);
  assert.equal(parseEmbedQuery({ background: "1", controls: "1" }).controls, true);
});

check("unknown / hostile values fall back to defaults", () => {
  assert.deepEqual(parseEmbedQuery({ autoplay: "yes", fit: "javascript:alert(1)" }), DEFAULT_EMBED_OPTIONS);
  assert.deepEqual(sanitizeEmbedOptions({ autoplay: "1", evil: "<script>" }), { ...DEFAULT_EMBED_OPTIONS, autoplay: true });
  assert.deepEqual(sanitizeEmbedOptions(null), DEFAULT_EMBED_OPTIONS);
});

check("presets are detected", () => {
  assert.equal(embedPresetFor(DEFAULT_EMBED_OPTIONS), "standard");
  assert.equal(embedPresetFor(BACKGROUND_EMBED_OPTIONS), "background");
  assert.equal(embedPresetFor({ ...DEFAULT_EMBED_OPTIONS, loop: true }), "custom");
});

check("embed code is responsive, escaped, and lazy only when not autoplaying", () => {
  const code = buildEmbedCode({
    embedBaseUrl: "https://agent.example.com/embed/abc",
    options: DEFAULT_EMBED_OPTIONS,
    title: 'Tour "123" <Main> & Co',
    width: 1920,
    height: 1080,
  });
  assert.match(code, /padding-top:56\.25%/);
  assert.match(code, /title="Tour &quot;123&quot; &lt;Main&gt; &amp; Co"/);
  assert.match(code, /loading="lazy"/);
  assert.match(code, /allow="autoplay; fullscreen; picture-in-picture; encrypted-media"/);
  assert.match(code, /allowfullscreen/);
  assert.doesNotMatch(code, /<script/i);

  const bg = buildEmbedCode({
    embedBaseUrl: "https://agent.example.com/embed/abc",
    options: BACKGROUND_EMBED_OPTIONS,
    title: "Hero",
    fill: true,
  });
  assert.doesNotMatch(bg, /loading="lazy"/);
  assert.doesNotMatch(bg, /padding-top/);
  assert.match(bg, /src="https:\/\/agent\.example\.com\/embed\/abc\?autoplay=1&amp;muted=1/);
});

check("aspect ratio handles portrait, unknown and absurd sizes", () => {
  assert.equal(aspectPaddingPercent(1080, 1920), 177.78);
  assert.equal(aspectPaddingPercent(null, null), 56.25);
  assert.equal(aspectPaddingPercent(10000, 1), 56.25);
});

check("public id format", () => {
  assert.equal(isWellFormedPublicVideoId("AbCdEfGhIjKlMnOpQrStUv"), true);
  assert.equal(isWellFormedPublicVideoId("short"), false);
  assert.equal(isWellFormedPublicVideoId("../../etc/passwd/aaaaaaaa"), false);
});

console.log("bandwidth estimate");

check("bytes scale with buffered seconds and cap at one file", () => {
  const video = { file_size: 100_000_000, duration_seconds: 100 };
  assert.equal(estimateBufferedBytes(video, 10), 10_000_000);
  assert.equal(estimateBufferedBytes(video, 10_000), 100_000_000);
  assert.equal(estimateBufferedBytes(video, -5), 0);
  assert.equal(estimateBufferedBytes(video, Number.NaN), 0);
});

check("falls back to player-reported duration, else records nothing", () => {
  assert.equal(estimateBufferedBytes({ file_size: 50_000_000, duration_seconds: null }, 5, 50), 5_000_000);
  assert.equal(estimateBufferedBytes({ file_size: 50_000_000, duration_seconds: null }, 5), 0);
  assert.equal(estimateBufferedBytes({ file_size: null, duration_seconds: 10 }, 5), 0);
});

console.log(`\n${passed} checks passed`);
