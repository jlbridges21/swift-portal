"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Search, X, ChevronDown } from "lucide-react";
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

type TeamRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  disabled_at: string | null;
  created_at: string;
  staff_permissions?: unknown;
};

type EditState = {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  permissions: StaffPermissions;
  permissionSearch: string;
};

export function StaffPermissionsSettings() {
  const [staff, setStaff] = useState<TeamRow[]>([]);
  const [seats, setSeats] = useState<StaffSeatSnapshot | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removedOpen, setRemovedOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    const qs = showRemoved ? "?includeDisabled=1" : "";
    const res = await fetch(`/api/admin/staff${qs}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as {
      staff?: TeamRow[];
      seats?: StaffSeatSnapshot;
      ownerUserId?: string | null;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load staff.");
      return;
    }
    setStaff(data.staff ?? []);
    setSeats(data.seats ?? null);
    setOwnerUserId(data.ownerUserId ?? null);
    setError(null);
  }, [showRemoved]);

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
          ? "Staff member reactivated — same account, no duplicate."
          : data.attachedExisting && !data.inviteSent
            ? "Existing account linked as staff. They can sign in with their current password."
            : "Invite sent. They’ll set a password from the email link."
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: TeamRow) {
    const sanitized = sanitizeStaffPermissions(row.staff_permissions);
    setEdit({
      userId: row.id,
      fullName: row.full_name || "",
      email: row.email,
      role: row.role,
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
          permissions: edit.role === "staff" ? edit.permissions : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      setNotice("Saved. Changes apply on their next request.");
      setEdit(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function promoteToAdmin(userId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote_admin", userId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        seats?: StaffSeatSnapshot;
      };
      if (!res.ok) {
        setError(data.error || "Could not promote to admin.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      setSeats(data.seats ?? null);
      setNotice("Promoted to admin — full owner-equivalent access.");
      setEdit(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function demoteToStaff(userId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "demote_staff",
          userId,
          permissions: emptyStaffPermissions(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        seats?: StaffSeatSnapshot;
      };
      if (!res.ok) {
        setError(data.error || "Could not demote.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      setSeats(data.seats ?? null);
      setNotice("Demoted to staff — permission matrix restored (all off). Admin seat freed.");
      setEdit(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(userId: string) {
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

  async function remove(row: TeamRow) {
    const label = row.full_name || row.email;
    if (!window.confirm(`Remove ${label} from the team? Their history stays; they disappear from this list.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
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
        setError(data.error || "Could not remove.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      if (edit?.userId === row.id) setEdit(null);
      setSeats(data.seats ?? null);
      setNotice(`${label} removed.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(id: StaffPermissionPresetId) {
    if (!edit || edit.role !== "staff") return;
    setEdit({ ...edit, permissions: applyStaffPermissionPreset(id) });
  }

  function togglePerm(key: StaffPermissionKey, checked: boolean) {
    if (!edit || edit.role !== "staff") return;
    setEdit({
      ...edit,
      permissions: { ...edit.permissions, [key]: checked, v: edit.permissions.v },
    });
  }

  const active = staff.filter((s) => !s.disabled_at);
  const disabled = staff.filter((s) => s.disabled_at);

  const filteredMeta = useMemo(() => {
    if (!edit || edit.role !== "staff") return [];
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
            Invite teammates and define what each can do. Promote someone to Admin for full
            owner-equivalent access (uses an admin seat). Staff seats are unlimited.
          </p>
        </div>
        {seats && seats.limit != null ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">
              {seats.used} of {seats.limit} admin seats
            </span>
            {seats.planName ? <span className="text-slate-500"> · {seats.planName}</span> : null}
            <span className="block text-xs text-slate-500">Staff: unlimited</span>
          </div>
        ) : seats ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Admin seats: unlimited</span>
            <span className="block text-xs text-slate-500">Staff: unlimited</span>
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
        {active.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-500">No team members yet.</li>
        ) : null}
        {active.map((s) => {
          const isOwner = ownerUserId === s.id;
          const isAdmin = s.role === "admin";
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{s.full_name || s.email}</p>
                <p className="text-xs text-slate-500">{s.email}</p>
                <p className="text-xs text-emerald-700">
                  {isOwner ? "Owner" : isAdmin ? "Admin" : "Staff"} · Active
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isOwner || s.role === "staff" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {!isOwner ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void remove(s)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-slate-600"
          onClick={() => {
            const next = !showRemoved;
            setShowRemoved(next);
            setRemovedOpen(next);
          }}
        >
          <span>Show removed team members</span>
          <ChevronDown
            className={`h-4 w-4 transition ${removedOpen && showRemoved ? "rotate-180" : ""}`}
          />
        </button>
        {showRemoved && removedOpen ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
            {disabled.length === 0 ? (
              <li className="px-4 py-4 text-sm text-slate-500">No removed members.</li>
            ) : (
              disabled.map((s) => (
                <li key={s.id} className="px-4 py-3 opacity-70">
                  <p className="text-sm font-medium text-slate-900">{s.full_name || s.email}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                  <p className="text-xs text-slate-500">Removed — re-invite to reactivate</p>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {edit ? (
        <div
          id="settings-staff-permissions"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Edit {edit.role === "admin" ? "admin" : "staff member"}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Changes apply on their next request.
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

              {edit.role === "staff" ? (
                <>
                  <div>
                    <Label className="mb-2 block">Permission preset</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        title="Promote to role=admin — full owner access, uses an admin seat"
                        onClick={() => void promoteToAdmin(edit.userId)}
                      >
                        Admin
                      </Button>
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
                      Admin promotes to role=admin (not a permission). Other presets are a starting
                      point — edit any toggle afterward.
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
                </>
              ) : (
                <div className="space-y-3 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p>
                    This person is an <strong>admin</strong> with full dashboard and settings access.
                    Demote to staff to restore a permission matrix and free an admin seat.
                  </p>
                  {ownerUserId === edit.userId ? (
                    <p className="text-xs text-amber-800">
                      This is the original business owner and cannot be demoted or removed.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void demoteToStaff(edit.userId)}
                    >
                      Demote to staff
                    </Button>
                  )}
                </div>
              )}

              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Billing, staff management, partner program, custom domain, Stripe Connect, and
                deleting the business cannot be delegated to staff.
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
