#!/usr/bin/env node
/**
 * Summarize project-nav-bench result files into a comparison (JSON + Markdown).
 *
 *   node scripts/perf/compare.mjs perf-results/baseline-*.json perf-results/candidate-*.json \
 *     --out perf-results/comparison
 *
 * Median and p95 (nearest-rank; with 10 samples p95 is the slowest sample) over measured
 * iterations only (warm-ups excluded). Samples that never reached a milestone count as failures
 * and are reported, not dropped silently.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string", default: "perf-results/comparison" } } });

const pct = (xs, p) => {
  const v = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
};
const MILESTONES = ["feedback_visible", "primary_ready", "secondary_ready", "media_ready"];

const runs = positionals.map((f) => JSON.parse(readFileSync(f, "utf8")));
const summary = [];
for (const run of runs) {
  const groups = new Map();
  for (const r of run.results) {
    if (r.warmup) continue;
    const k = `${r.profile}|${r.scenario}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const [k, rs] of groups) {
    const [profile, scenario] = k.split("|");
    const row = { label: run.meta.label, sha: run.meta.sha, profile, scenario, n: rs.length, errors: rs.filter((r) => r.error).length };
    for (const m of MILESTONES) {
      const xs = rs.map((r) => r.milestones?.[m]);
      row[m] = { median: pct(xs, 50), p95: pct(xs, 95), missing: xs.filter((x) => x == null).length };
    }
    if (scenario === "direct") {
      for (const m of ["ttfb", "fcp", "lcp"]) row[m] = { median: pct(rs.map((r) => r.document?.[m]), 50), p95: pct(rs.map((r) => r.document?.[m]), 95) };
    } else {
      row.rscTtfb = { median: pct(rs.map((r) => r.rsc?.[0]?.ttfb), 50), p95: pct(rs.map((r) => r.rsc?.[0]?.ttfb), 95) };
      row.rscDone = { median: pct(rs.map((r) => r.rsc?.[0]?.done), 50), p95: pct(rs.map((r) => r.rsc?.[0]?.done), 95) };
      row.rscRequests = { median: pct(rs.map((r) => r.rsc?.length ?? 0), 50) };
      row.fullReloads = rs.filter((r) => r.fullDocumentNavigation).length;
      row.longTasksMs = { median: pct(rs.map((r) => r.longTasks?.totalMs), 50), p95: pct(rs.map((r) => r.longTasks?.totalMs), 95) };
      row.jsChunksAfterClick = { median: pct(rs.map((r) => r.window?.jsChunks?.length ?? 0), 50) };
      if (rs[0]?.projectsPage) {
        row.projectsPagePrefetchRsc = { median: pct(rs.map((r) => r.projectsPage?.rscPrefetchRequests), 50) };
        row.projectsPagePrefetchRoutes = { median: pct(rs.map((r) => r.projectsPage?.rscPrefetchRoutes), 50) };
      }
    }
    row.requests = { median: pct(rs.map((r) => r.window?.requests), 50), p95: pct(rs.map((r) => r.window?.requests), 95) };
    row.kb = { median: pct(rs.map((r) => Math.round((r.window?.finishedBytes ?? 0) / 1024)), 50) };
    row.duplicateKeys = [...new Set(rs.flatMap((r) => (r.window?.duplicates ?? []).map((d) => d.key)))];
    row.failedRequests = rs.reduce((s, r) => s + (r.window?.failed?.length ?? 0), 0);
    row.consoleErrors = rs.reduce((s, r) => s + (r.console?.filter((c) => c.type === "error" || c.type === "pageerror").length ?? 0), 0);
    row.hydrationWarnings = rs.reduce((s, r) => s + (r.console?.filter((c) => /hydrat/i.test(c.text)).length ?? 0), 0);
    // Server spans (median end time per label) when the deployment had tracing on.
    const spanEnds = new Map();
    for (const r of rs) for (const seg of r.serverTrace ?? []) for (const sp of seg.spans ?? []) {
      if (!spanEnds.has(sp.l)) spanEnds.set(sp.l, { s: [], e: [], n: sp.n });
      spanEnds.get(sp.l).s.push(sp.s);
      spanEnds.get(sp.l).e.push(sp.e);
    }
    row.serverSpans = [...spanEnds.entries()].map(([l, v]) => ({ l, start: pct(v.s, 50), end: pct(v.e, 50), rows: v.n })).sort((a, b) => a.start - b.start);
    const mw = rs.map((r) => (r.rsc?.[0]?.serverTiming ?? r.document?.serverTiming) || "").filter(Boolean);
    if (mw.length) {
      const parse = (h) => Object.fromEntries(h.split(",").map((p) => p.trim().match(/^([\w-]+);dur=([\d.]+)/)).filter(Boolean).map((m) => [m[1], Number(m[2])]));
      const keys = new Set(mw.flatMap((h) => Object.keys(parse(h))));
      row.middleware = Object.fromEntries([...keys].map((k) => [k, pct(mw.map((h) => parse(h)[k]), 50)]));
    }
    summary.push(row);
  }
}

writeFileSync(`${values.out}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), runs: runs.map((r) => r.meta), summary }, null, 2));

const f = (o) => (o == null || o.median == null ? "—" : `${o.median} / ${o.p95 ?? "—"}`);
const lines = [];
lines.push(`# Projects → project detail navigation`, "", `Generated ${new Date().toISOString()}. Values are **median / p95 ms** after click (warm-ups excluded).`, "");
lines.push("| Deployment | Profile | Scenario | n | feedback | primary | secondary | media | RSC TTFB | RSC done | requests | KB | long tasks ms | full reloads | errors |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of summary) {
  lines.push(`| ${r.label} | ${r.profile} | ${r.scenario} | ${r.n} | ${f(r.feedback_visible)} | ${f(r.primary_ready)} | ${f(r.secondary_ready)} | ${f(r.media_ready)} | ${f(r.rscTtfb)} | ${f(r.rscDone)} | ${f(r.requests)} | ${r.kb?.median ?? "—"} | ${f(r.longTasksMs)} | ${r.fullReloads ?? "—"} | ${r.errors + r.failedRequests + r.consoleErrors} |`);
}
const direct = summary.filter((r) => r.scenario === "direct");
if (direct.length) {
  lines.push("", "## Cold direct load", "", "| Deployment | Profile | TTFB | FCP | LCP | primary | media |", "|---|---|---|---|---|---|---|");
  for (const r of direct) lines.push(`| ${r.label} | ${r.profile} | ${f(r.ttfb)} | ${f(r.fcp)} | ${f(r.lcp)} | ${f(r.primary_ready)} | ${f(r.media_ready)} |`);
}
const pre = summary.filter((r) => r.projectsPagePrefetchRsc);
if (pre.length) {
  lines.push("", "## Projects page prefetching (cold, first visit)", "", "| Deployment | Profile | RSC prefetch requests | distinct routes |", "|---|---|---|---|");
  for (const r of pre) lines.push(`| ${r.label} | ${r.profile} | ${r.projectsPagePrefetchRsc.median} | ${r.projectsPagePrefetchRoutes.median} |`);
}
lines.push("", "## Duplicate requests (normalized URL + body hash) seen in any sample", "");
for (const r of summary) if (r.duplicateKeys.length) lines.push(`- **${r.label} ${r.profile} ${r.scenario}:** ${r.duplicateKeys.map((k) => `\`${k}\``).join(", ")}`);
writeFileSync(`${values.out}.md`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
