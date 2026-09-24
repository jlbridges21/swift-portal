"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UserCog, X } from "lucide-react";

type StaffOption = { id: string; email: string; full_name: string | null };
type AssignedRow = {
  id: string;
  user_id: string;
  profiles?: { id: string; email: string; full_name: string | null } | null;
};

export function ProjectStaffCard({ projectId }: { projectId: string }) {
  const [assigned, setAssigned] = useState<AssignedRow[]>([]);
  const [assignable, setAssignable] = useState<StaffOption[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/project-staff?project_id=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      assigned?: AssignedRow[];
      assignable?: StaffOption[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load project staff.");
      return;
    }
    setAssigned(data.assigned ?? []);
    setAssignable(data.assignable ?? []);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedIds = new Set(assigned.map((a) => a.user_id));
  const available = assignable.filter((s) => !assignedIds.has(s.id));

  async function add() {
    if (!addUserId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/project-staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_id: addUserId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not assign staff.");
        return;
      }
      setAddUserId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/project-staff?project_id=${encodeURIComponent(projectId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not remove staff.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" /> Staff
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Assign staff to this project. Removing the last person is fine — the project belongs to
          the business.
        </p>

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {assigned.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">No staff assigned.</li>
          ) : (
            assigned.map((row) => {
              const label =
                row.profiles?.full_name || row.profiles?.email || row.user_id;
              const email = row.profiles?.email;
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    {email && email !== label ? (
                      <p className="text-xs text-slate-500">{email}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void remove(row.user_id)}
                    aria-label={`Remove ${label}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })
          )}
        </ul>

        {available.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                options={[
                  { value: "", label: "Select staff…" },
                  ...available.map((s) => ({
                    value: s.id,
                    label: s.full_name ? `${s.full_name} (${s.email})` : s.email,
                  })),
                ]}
              />
            </div>
            <Button type="button" size="sm" disabled={busy || !addUserId} onClick={() => void add()}>
              Add
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {assignable.length === 0
              ? "Invite staff in Settings → Staff & Permissions first."
              : "All active staff are already on this project."}
          </p>
        )}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
