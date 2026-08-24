/**
 * Run async tasks with a fixed concurrency limit.
 * When one finishes, the next queued task starts immediately.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  options?: { signal?: AbortSignal }
): Promise<PromiseSettledResult<T>[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      if (options?.signal?.aborted) {
        const aborted = nextIndex;
        nextIndex = tasks.length;
        for (let i = aborted; i < tasks.length; i++) {
          if (!results[i]) {
            results[i] = { status: "rejected", reason: new DOMException("Aborted", "AbortError") };
          }
        }
        return;
      }

      const index = nextIndex++;
      const task = tasks[index];
      try {
        const value = await task();
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
