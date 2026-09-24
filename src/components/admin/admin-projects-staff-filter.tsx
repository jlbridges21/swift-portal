"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}: {
  staff: StaffOption[];
  /** project_id → user_id[] */
  projectStaffIds: Record<string, string[]>;
  onFilterChange: (selected: string[]) => void;
  /** Initial selection (e.g. staff "assigned to me"). Overrides empty session storage. */
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? []);
  const [open, setOpen] = useState(false);

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

  function clear() {
    setSelected([]);
    writeStored([]);
    onFilterChange([]);
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
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          Filter by staff
          {selected.length > 0 ? (
            <Badge className="ml-2 border border-accent/40 bg-white text-primary">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
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
      </div>

      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-border bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Multi-select — show projects for any selected staff
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            <li>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.includes(STAFF_FILTER_UNASSIGNED)}
                  onChange={() => toggle(STAFF_FILTER_UNASSIGNED)}
                />
                Unassigned
              </label>
            </li>
            {staff.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="truncate">{s.full_name || s.email}</span>
                </label>
              </li>
            ))}
            {staff.length === 0 ? (
              <li className="px-2 py-2 text-xs text-slate-500">No staff members yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* projectStaffIds kept for callers; filtering happens in parent */}
      <span className="sr-only">{Object.keys(projectStaffIds).length} projects mapped</span>
    </div>
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
