import { isSameMonth, parseISO, compareAsc } from "date-fns";

export type AgendaShoot = { id: string; proposed_at: string };

/** Confirmed shoots whose start falls in the anchor month, earliest first. */
export function agendaShootsForMonth<T extends AgendaShoot>(shoots: T[], anchor: Date): T[] {
  return shoots
    .filter((s) => {
      const at = parseISO(s.proposed_at);
      return !Number.isNaN(at.getTime()) && isSameMonth(at, anchor);
    })
    .sort((a, b) => compareAsc(parseISO(a.proposed_at), parseISO(b.proposed_at)));
}
