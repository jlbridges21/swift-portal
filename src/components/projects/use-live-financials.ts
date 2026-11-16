"use client";

import { useCallback, useMemo, useState } from "react";
import type { Payment, ProjectQuote } from "@/lib/types";

type Row = { id: string; updated_at?: string | null; created_at: string };

/** Server rows, with local changes laid over them until the server's copy is as new. */
function overlay<T extends Row>(server: T[], local: Record<string, T>): T[] {
  const stamp = (r: Row) => r.updated_at || r.created_at;
  const seen = new Set<string>();
  const merged = server.map((row) => {
    seen.add(row.id);
    const mine = local[row.id];
    return mine && stamp(mine) > stamp(row) ? mine : row;
  });
  const added = Object.values(local).filter((row) => !seen.has(row.id));
  return added.length ? [...added, ...merged] : merged;
}

/**
 * Client project page: proposals and payments the client just changed (approving a
 * proposal returns the approved row and its invoice) show at once — summary panel, nav
 * badge, Payments list — instead of after the background refresh lands. Server data
 * wins as soon as it is at least as new, so webhooks and refreshes stay the source of truth.
 */
export function useLiveFinancials(serverQuotes: ProjectQuote[], serverPayments: Payment[]) {
  const [localQuotes, setLocalQuotes] = useState<Record<string, ProjectQuote>>({});
  const [localPayments, setLocalPayments] = useState<Record<string, Payment>>({});
  const quotes = useMemo(() => overlay(serverQuotes, localQuotes), [serverQuotes, localQuotes]);
  const payments = useMemo(() => overlay(serverPayments, localPayments), [serverPayments, localPayments]);
  const upsertQuote = useCallback((q: ProjectQuote) => setLocalQuotes((prev) => ({ ...prev, [q.id]: q })), []);
  const upsertPayment = useCallback((p: Payment) => setLocalPayments((prev) => ({ ...prev, [p.id]: p })), []);
  return { quotes, payments, upsertQuote, upsertPayment };
}
