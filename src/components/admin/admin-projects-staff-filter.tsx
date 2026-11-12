"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const STORAGE_KEY = "admin.projects.staffFilter";

/** Sentinel for projects with no staff assignments. */
export const STAFF_FILTER_UNASSIGNED = "__unassigned__";

type StaffOption = { id: string; email: string; full_name: string | null };

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function writeStored(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode
  }
}

export function AdminProjectsStaffFilter({
  staff,
  projectStaffIds,
  onFilterChange,
  defaultSelected,
  trailing,
  end,
}: {
  staff: StaffOption[];
  /** project_id → user_id[] */
  projectStaffIds: Record<string, string[]>;
  onFilterChange: (selected: string[]) => void;
  /** Initial selection (e.g. staff "assigned to me"). Overrides empty session storage. */
  defaultSelected?: string[];
  /** Rendered right after the "Filter by staff" button (e.g. the Client View toggle). */
  trailing?: React.ReactNode;
  /** Right-aligned on the same row (e.g. Hidden projects / New Project). Wraps below on narrow screens. */
  end?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const isPhone = useMediaQuery(PHONE_QUERY);

  useEffect(() => {
    if (defaultSelected && defaultSelected.length > 0) {
      setSelected(defaultSelected);
      onFilterChange(defaultSelected);
      writeStored(defaultSelected);
      return;
    }
    const stored = readStored();
    setSelected(stored);
    onFilterChange(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from session / defaults
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeStored(next);
      onFilterChange(next);
      return next;
    });
  }

  function apply(next: string[]) {
    setSelected(next);
    writeStored(next);
    onFilterChange(next);
  }

  function clear() {
    apply([]);
  }

  function toggleOpen() {
    if (!open) setDraft(selected);
    setOpen((o) => !o);
  }

  const label = useMemo(() => {
    if (selected.length === 0) return "All staff";
    const names = selected.map((id) => {
      if (id === STAFF_FILTER_UNASSIGNED) return "Unassigned";
      const s = staff.find((x) => x.id === id);
      return s?.full_name || s?.email || "Staff";
    });
    return names.join(", ");
  }, [selected, staff]);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          ref={setTrigger}
          onClick={toggleOpen}
          aria-expanded={open}
        >
          Filter by staff
          {selected.length > 0 ? (
            <Badge className="ml-2 border border-accent/40 bg-white surface-dark:bg-card text-heading">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
        {trailing}
        {selected.length > 0 ? (
          <>
            <span className="max-w-xs truncate text-xs text-muted" title={label}>
              {label}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </>
        ) : null}
        {end ? <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div> : null}
      </div>

      {open && !isPhone ? (
        <>
          <button
            type="button"
            aria-label="Close staff filter"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white surface-dark:bg-card p-3 shadow-lg">
            <p className="mb-2 text-xs font-medium text-slate-500 surface-dark:text-muted">
              Multi-select — show projects for any selected staff
            </p>
            <StaffOptionList staff={staff} selected={selected} onToggle={toggle} />
          </div>
        </>
      ) : null}

      <BottomSheet
        open={open && isPhone}
        onClose={() => setOpen(false)}
        title="Filter by staff"
        description="Show projects for any selected staff"
        surfaceFrom={trigger}
        footer={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={draft.length === 0}
              onClick={() => setDraft([])}
            >
              Clear filters
            </Button>
            <Button
              type="button"
              variant="accent"
              className="h-11 flex-[1.4]"
              onClick={() => {
                apply(draft);
                setOpen(false);
              }}
            >
              Apply{draft.length > 0 ? ` (${draft.length})` : ""}
            </Button>
          </div>
        }
      >
        <StaffOptionList
          staff={staff}
          selected={draft}
          onToggle={(id) => setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          sheet
        />
      </BottomSheet>

      {/* projectStaffIds kept for callers; filtering happens in parent */}
      <span className="sr-only">{Object.keys(projectStaffIds).length} projects mapped</span>
    </div>
  );
}

/** Unassigned + each staff member, shared by the desktop dropdown and the phone sheet. */
function StaffOptionList({
  staff,
  selected,
  onToggle,
  sheet = false,
}: {
  staff: StaffOption[];
  selected: string[];
  onToggle: (id: string) => void;
  sheet?: boolean;
}) {
  const rowClass = cn(
    "flex cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle",
    sheet ? "min-h-12 gap-3 text-[15px]" : "py-1.5"
  );
  const boxClass = cn(sheet && "h-5 w-5 shrink-0 accent-[var(--color-accent)]");
  return (
    <ul className={cn("space-y-1", !sheet && "max-h-64 overflow-y-auto")}>
      <li>
        <label className={rowClass}>
          <input
            type="checkbox"
            className={boxClass}
            checked={selected.includes(STAFF_FILTER_UNASSIGNED)}
            onChange={() => onToggle(STAFF_FILTER_UNASSIGNED)}
          />
          Unassigned
        </label>
      </li>
      {staff.map((s) => (
        <li key={s.id}>
          <label className={rowClass}>
            <input type="checkbox" className={boxClass} checked={selected.includes(s.id)} onChange={() => onToggle(s.id)} />
            <span className="truncate">{s.full_name || s.email}</span>
          </label>
        </li>
      ))}
      {staff.length === 0 ? (
        <li className="px-2 py-2 text-xs text-slate-500 surface-dark:text-muted">No staff members yet.</li>
      ) : null}
    </ul>
  );
}

/** Returns true if project passes the staff multi-select filter. */
export function projectMatchesStaffFilter(
  projectId: string,
  selected: string[],
  projectStaffIds: Record<string, string[]>
): boolean {
  if (selected.length === 0) return true;
  const assigned = projectStaffIds[projectId] ?? [];
  const wantsUnassigned = selected.includes(STAFF_FILTER_UNASSIGNED);
  const staffIds = selected.filter((id) => id !== STAFF_FILTER_UNASSIGNED);

  if (wantsUnassigned && assigned.length === 0) return true;
  if (staffIds.some((id) => assigned.includes(id))) return true;
  return false;
}
