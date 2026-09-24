"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Search, X } from "lucide-react";
import type { StaffSeatSnapshot } from "@/lib/staff";
import {
  STAFF_PERMISSION_GROUP_LABELS,
  STAFF_PERMISSION_META,
  STAFF_PERMISSION_PRESETS,
  applyStaffPermissionPreset,
  emptyStaffPermissions,
  sanitizeStaffPermissions,
  type StaffPermissionGroupId,
  type StaffPermissionKey,
  type StaffPermissionPresetId,
  type StaffPermissions,
} from "@/lib/staff-permissions";

type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  disabled_at: string | null;
  created_at: string;
  staff_permissions?: unknown;
};

type EditState = {
  userId: string;
  fullName: string;
  email: string;
  permissions: StaffPermissions;
  permissionSearch: string;
};

export function StaffPermissionsSettings() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [seats, setSeats] = useState<StaffSeatSnapshot | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff", { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as {
      staff?: StaffRow[];
      seats?: StaffSeatSnapshot;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load staff.");
      return;
    }
    setStaff(data.staff ?? []);
    setSeats(data.seats ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        seats?: StaffSeatSnapshot;
        inviteSent?: boolean;
        attachedExisting?: boolean;
        reinvited?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Invite failed.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      setEmail("");
      setFullName("");
      setSeats(data.seats ?? null);
      setNotice(
        data.reinvited
          ? "Staff member already on the team — no duplicate created."
          : data.attachedExisting && !data.inviteSent
            ? "Existing account linked as staff. They can sign in with their current password."
            : "Invite sent. They’ll set a password from the email link."
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: StaffRow) {
    const sanitized = sanitizeStaffPermissions(row.staff_permissions);
    setEdit({
      userId: row.id,
      fullName: row.full_name || "",
      email: row.email,
      permissions: sanitized.ok ? sanitized.permissions : emptyStaffPermissions(),
      permissionSearch: "",
    });
    setError(null);
    setNotice(null);
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: edit.userId,
          fullName: edit.fullName,
          email: edit.email,
          permissions: edit.permissions,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        refusedKeys?: string[];
      };
      if (!res.ok) {
        setError(data.error || "Could not save staff member.");
        return;
      }
      setNotice("Staff member updated. Permission changes apply on their next request.");
      setEdit(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(userId: string) {
    if (!window.confirm("Send a password reset email to this staff member?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send reset email.");
        return;
      }
      setNotice("Password reset email sent.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StaffRow) {
    const label = row.full_name || row.email;
    const ok = window.confirm(
      `Remove ${label}?\n\nThey will lose portal sign-in as staff and all project assignments. This does not delete their auth account.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/staff?userId=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        seats?: StaffSeatSnapshot;
      };
      if (!res.ok) {
        setError(data.error || "Could not remove staff.");
        return;
      }
      if (data.seats) setSeats(data.seats);
      if (edit?.userId === row.id) setEdit(null);
      setNotice(`${label} removed. Seat released.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(id: StaffPermissionPresetId) {
    if (!edit) return;
    setEdit({ ...edit, permissions: applyStaffPermissionPreset(id) });
  }

  function togglePerm(key: StaffPermissionKey, checked: boolean) {
    if (!edit) return;
    setEdit({
      ...edit,
      permissions: { ...edit.permissions, [key]: checked, v: edit.permissions.v },
    });
  }

  const active = staff.filter((s) => !s.disabled_at);
  const disabled = staff.filter((s) => s.disabled_at);

  const filteredMeta = useMemo(() => {
    if (!edit) return [];
    const q = edit.permissionSearch.trim().toLowerCase();
    if (!q) return STAFF_PERMISSION_META;
    return STAFF_PERMISSION_META.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        STAFF_PERMISSION_GROUP_LABELS[m.group].toLowerCase().includes(q)
    );
  }, [edit]);

  const grouped = useMemo(() => {
    const map = new Map<StaffPermissionGroupId, typeof STAFF_PERMISSION_META>();
    for (const m of filteredMeta) {
      const list = map.get(m.group) ?? [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [filteredMeta]);

  return (
    <div id="settings-staff" tabIndex={-1} className="scroll-mt-24 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Staff & Permissions</h2>
          <p className="mt-1 text-sm text-muted">
            Invite teammates and define what each can do. Staff access is enforced from these
            permissions — billing, settings, and staff management stay owner-only.
          </p>
        </div>
        {seats && seats.limit != null ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">
              {seats.used} / {seats.limit} seats used
            </span>
            {seats.planName ? <span className="text-slate-500"> · {seats.planName}</span> : null}
            {seats.remaining != null ? (
              <span className="block text-xs text-slate-500">
                {seats.remaining} remaining
                {seats.overLimit ? " · over limit (existing staff kept)" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Add staff</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-invite-email">Email</Label>
              <Input
                id="staff-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@studio.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="staff-invite-name">Name (optional)</Label>
              <Input
                id="staff-invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex"
                className="mt-1"
              />
            </div>
          </div>
          <Button type="button" disabled={busy || !email.trim()} onClick={() => void invite()}>
            Invite staff
          </Button>
        </CardContent>
      </Card>

      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {active.length === 0 && disabled.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-500">No staff members yet.</li>
        ) : null}
        {active.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{s.full_name || s.email}</p>
              <p className="text-xs text-slate-500">{s.email}</p>
              <p className="text-xs text-emerald-700">Active</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => openEdit(s)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void remove(s)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </li>
        ))}
        {disabled.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 opacity-60">
            <div>
              <p className="text-sm font-medium text-slate-900">{s.full_name || s.email}</p>
              <p className="text-xs text-slate-500">{s.email}</p>
              <p className="text-xs text-slate-500">Removed</p>
            </div>
          </li>
        ))}
      </ul>

      {edit ? (
        <div
          id="settings-staff-permissions"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit staff member</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Changes apply on their next request (profile is loaded fresh each time).
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="staff-edit-name">Name</Label>
                  <Input
                    id="staff-edit-name"
                    value={edit.fullName}
                    onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-edit-email">Email</Label>
                  <Input
                    id="staff-edit-email"
                    type="email"
                    value={edit.email}
                    onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void resetPassword(edit.userId)}
                >
                  Send password reset email
                </Button>
              </div>

              <div>
                <Label className="mb-2 block">Permission preset</Label>
                <div className="flex flex-wrap gap-2">
                  {STAFF_PERMISSION_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset(p.id)}
                      title={p.description}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Presets are a starting point — edit any toggle afterward.
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={edit.permissionSearch}
                  onChange={(e) => setEdit({ ...edit, permissionSearch: e.target.value })}
                  placeholder="Search permissions…"
                  className="pl-9"
                />
              </div>

              <div className="space-y-5">
                {[...grouped.entries()].map(([group, items]) => (
                  <div key={group}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {STAFF_PERMISSION_GROUP_LABELS[group]}
                    </h4>
                    <ul className="space-y-2">
                      {items.map((m) => (
                        <li
                          key={m.key}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{m.label}</p>
                            <p className="text-xs text-slate-500">{m.description}</p>
                          </div>
                          <Switch
                            checked={edit.permissions[m.key] === true}
                            onCheckedChange={(c) => togglePerm(m.key, c)}
                            aria-label={m.label}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {filteredMeta.length === 0 ? (
                  <p className="text-sm text-slate-500">No permissions match that search.</p>
                ) : null}
              </div>

              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Billing, staff management, partner program, custom domain, Stripe Connect, and
                deleting the business cannot be delegated and are not listed here.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setEdit(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveEdit()} disabled={busy}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
