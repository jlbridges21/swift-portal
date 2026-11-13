/**
 * Shared by the proxy and server components. See src/lib/perf/trace.ts.
 * A host-only cookie (not a header) carries the opt-in, so the benchmark browser never adds
 * non-standard headers to cross-origin Supabase / Stripe requests (CORS preflights).
 */
export const PERF_TRACE_COOKIE = "sp_perf_trace";

export function perfTraceEnvEnabled(): boolean {
  return process.env.PERF_TRACE === "1" && process.env.VERCEL_ENV !== "production";
}
