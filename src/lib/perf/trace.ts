import { cache } from "react";
import { cookies } from "next/headers";
import { PERF_TRACE_COOKIE, perfTraceEnvEnabled } from "@/lib/perf/env";

/**
 * Opt-in server render tracing for performance benchmarks (scripts/perf/).
 *
 * Inert unless BOTH hold:
 *   1. the deployment runs with PERF_TRACE=1 and is not production (VERCEL_ENV !== "production"),
 *   2. the request carries the `sp_perf_trace=<run-id>` cookie (set by the benchmark browser).
 *
 * Records only operation labels, timings (ms since the trace started) and row counts. Never
 * values, ids, URLs, tokens or anything a customer typed.
 */
const RUN_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

type Span = { l: string; s: number; e: number; n?: number; err?: 1 };
type Trace = { id: string; t0: number; spans: Span[] };

const getTrace = cache(async (): Promise<Trace | null> => {
  if (!perfTraceEnvEnabled()) return null;
  const runId = (await cookies()).get(PERF_TRACE_COOKIE)?.value;
  if (!runId || !RUN_ID_RE.test(runId)) return null;
  return { id: runId, t0: performance.now(), spans: [] };
});

/** Starts the request's trace clock (call first thing in the traced page). */
export async function perfStart(): Promise<void> {
  await getTrace();
}

function rowCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data: unknown }).data;
    if (Array.isArray(data)) return data.length;
    return data == null ? 0 : 1;
  }
  return undefined;
}

/**
 * Times one operation. Pass the promise (or a thunk) unchanged; the result is returned as-is.
 * Row count defaults to array length / Supabase `{ data }` shape.
 */
export async function perfSpan<T>(label: string, work: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T> {
  const trace = await getTrace();
  const run = typeof work === "function" ? (work as () => PromiseLike<T>)() : work;
  if (!trace) return run;
  const s = performance.now() - trace.t0;
  try {
    const value = await run;
    trace.spans.push({ l: label, s: Math.round(s), e: Math.round(performance.now() - trace.t0), n: rowCount(value) });
    return value;
  } catch (err) {
    trace.spans.push({ l: label, s: Math.round(s), e: Math.round(performance.now() - trace.t0), err: 1 });
    throw err;
  }
}

/** Marks a point in time (e.g. when a streamed section finished rendering). */
export async function perfMark(label: string): Promise<void> {
  const trace = await getTrace();
  if (!trace) return;
  const t = Math.round(performance.now() - trace.t0);
  trace.spans.push({ l: label, s: t, e: t });
}

/** Snapshot for <PerfTraceScript>; null when tracing is off. */
export async function perfSnapshot(segment: string): Promise<{ run: string; segment: string; spans: Span[] } | null> {
  const trace = await getTrace();
  if (!trace) return null;
  return { run: trace.id, segment, spans: [...trace.spans] };
}
