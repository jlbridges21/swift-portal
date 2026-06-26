"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Prevents duplicate in-flight async actions from double-clicks.
 * Returns pending state and a locked runner.
 */
export function useAsyncAction<T extends (...args: never[]) => Promise<unknown>>(
  action: T,
  options?: { loadingLabel?: string }
) {
  const [pending, setPending] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setPending(true);
      try {
        return (await action(...args)) as Awaited<ReturnType<T>>;
      } finally {
        lockRef.current = false;
        setPending(false);
      }
    },
    [action]
  );

  return {
    run,
    pending,
    loadingLabel: options?.loadingLabel,
  };
}
