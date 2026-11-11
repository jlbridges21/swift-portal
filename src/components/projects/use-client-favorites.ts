"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** What the client gallery needs to show and toggle hearts. */
export type ClientFavoritesController = {
  ids: ReadonlySet<string>;
  count: number;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
};

/**
 * The signed-in client's photo likes for one project. Optimistic: the heart flips at once and
 * rolls back (with a toast) if the server refuses. Saved per client, so it follows them
 * across devices.
 */
export function useClientFavorites(projectId: string, initialIds: string[]): ClientFavoritesController {
  const [ids, setIds] = useState<Set<string>>(() => new Set(initialIds));
  const inFlight = useRef(new Map<string, number>());
  // Latest set, read synchronously by toggle (only toggle changes `ids`, and it updates this too).
  const idsRef = useRef(ids);

  const toggle = useCallback(
    (id: string) => {
      const next = !idsRef.current.has(id);
      const optimistic = new Set(idsRef.current);
      if (next) optimistic.add(id);
      else optimistic.delete(id);
      idsRef.current = optimistic;
      setIds(optimistic);
      // Last click wins when a heart is tapped quickly several times.
      const seq = (inFlight.current.get(id) ?? 0) + 1;
      inFlight.current.set(id, seq);
      void (async () => {
        const favorite = next;
        try {
          const res = await fetch(`/api/projects/${projectId}/favorites`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_asset_id: id, favorite }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error || "Couldn't save your favorite");
          }
        } catch (e) {
          if (inFlight.current.get(id) !== seq) return;
          const rolledBack = new Set(idsRef.current);
          if (favorite) rolledBack.delete(id);
          else rolledBack.add(id);
          idsRef.current = rolledBack;
          setIds(rolledBack);
          toast.error(e instanceof Error ? e.message : "Couldn't save your favorite");
        }
      })();
    },
    [projectId]
  );

  return useMemo(
    () => ({ ids, count: ids.size, isFavorite: (id: string) => ids.has(id), toggle }),
    [ids, toggle]
  );
}
