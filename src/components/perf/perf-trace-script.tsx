import { perfMark, perfSnapshot } from "@/lib/perf/trace";

/**
 * Emits the request's server span list as inert JSON for the benchmark to read
 * (`script[data-perf-trace]`). Renders nothing unless tracing is enabled for this request
 * (see src/lib/perf/trace.ts) — production deployments never render it.
 */
export async function PerfTraceScript({ segment }: { segment: string }) {
  await perfMark(`render:${segment}`);
  const snap = await perfSnapshot(segment);
  if (!snap) return null;
  return (
    <script
      type="application/json"
      data-perf-trace={segment}
      // Labels and numbers only; escape "<" so the JSON can never close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(snap).replace(/</g, "\\u003c") }}
    />
  );
}
