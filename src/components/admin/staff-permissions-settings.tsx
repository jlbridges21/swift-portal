"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { ChevronDown, Crown, Mail, Pencil, Search, Shield, Trash2, User, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/admin/settings-tabs/shared";
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
};

type InviteRole = "staff" | "admin";

const PILL = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold";
const CHIP = "rounded-md bg-subtle px-2 py-0.5 text-xs font-semibold text-foreground";

const AREA_CHIPS: { key: StaffPermissionKey; label: string }[] = [
  { key: "area.projects", label: "Projects" },
  { key: "area.clients", label: "Clients" },
  { key: "area.media", label: "Media" },
  { key: "area.calendar", label: "Calendar" },
  { key: "area.messages", label: "Messages" },
];

function initials(row: TeamRow): string {
  const base = (row.full_name || row.email || "?").trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  const out = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : base.slice(0, 2);
  return out.toUpperCase();
}

/** Short "Can access" summary from the real permission matrix. */
function accessChips(row: TeamRow, isOwner: boolean): string[] {
  if (isOwner || row.role === "admin") return ["Everything"];
  const sanitized = sanitizeStaffPermissions(row.staff_permissions);
  if (!sanitized.ok) return [];
  const p = sanitized.permissions;
  const chips = AREA_CHIPS.filter((a) => p[a.key] === true).map((a) => a.label);
  const hasMoney = STAFF_PERMISSION_META.some((m) => m.group === "money" && p[m.key] === true);
  if (hasMoney) chips.push("Money");
  return chips;
}

function RolePill({ isOwner, role }: { isOwner: boolean; role: string }) {
  if (isOwner) {
    return (
      <span className={cn(PILL, "bg-accent-subtle text-accent")}>
        <Crown className="h-3 w-3" aria-hidden /> Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className={cn(PILL, "bg-accent-subtle text-accent")}>
        <Shield className="h-3 w-3" aria-hidden /> Admin
      </span>
    );
  }
  return <span className={cn(PILL, "bg-subtle text-muted")}>Staff</span>;
}

function AccessChips({ chips }: { chips: string[] }) {
  if (chips.length === 0) return <span className="text-xs text-muted">No areas yet</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c} className={CHIP}>
          {c}
        </span>
      ))}
    </div>
  );
}

const ACTIVE_PILL = cn(
  PILL,
  "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
);

/** Presets + searchable toggle list for a staff member's permission matrix. */
function PermissionPicker({
  permissions,
  onChange,
  disabled,
  onPromoteAdmin,
}: {
  permissions: StaffPermissions;
  onChange: (next: StaffPermissions) => void;
  disabled?: boolean;
  onPromoteAdmin?: () => void;
}) {
  const [search, setSearch] = useState("");

  const filteredMeta = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STAFF_PERMISSION_META;
    return STAFF_PERMISSION_META.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        STAFF_PERMISSION_GROUP_LABELS[m.group].toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<StaffPermissionGroupId, typeof STAFF_PERMISSION_META>();
    for (const m of filteredMeta) {
      const list = map.get(m.group) ?? [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [filteredMeta]);

  function togglePerm(key: StaffPermissionKey, checked: boolean) {
    onChange({ ...permissions, [key]: checked, v: permissions.v });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Start from a preset</Label>
        <div className="flex flex-wrap gap-2">
          {onPromoteAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 sm:h-8"
              disabled={disabled}
              title="Make them an Admin: full owner access, uses an admin seat"
              onClick={onPromoteAdmin}
            >
              Admin
            </Button>
          ) : null}
          {STAFF_PERMISSION_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-11 sm:h-8"
              disabled={disabled}
              onClick={() => onChange(applyStaffPermissionPreset(p.id as StaffPermissionPresetId))}
              title={p.description}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {onPromoteAdmin ? "Admin gives full owner access and uses an admin seat. " : ""}
          Presets are a starting point; change any toggle after.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions…"
          aria-label="Search permissions"
          className="pl-9"
        />
      </div>

      <div className="space-y-5">
        {[...grouped.entries()].map(([group, items]) => (
          <div key={group}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {STAFF_PERMISSION_GROUP_LABELS[group]}
            </h4>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {items.map((m) => (
                <li key={m.key} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">{m.label}</p>
                    <p className="text-[13px] text-muted">{m.description}</p>
                  </div>
                  <Switch
                    checked={permissions[m.key] === true}
                    onCheckedChange={(c) => togglePerm(m.key, c)}
                    aria-label={m.label}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {filteredMeta.length === 0 ? (
          <p className="text-sm text-muted">No permissions match that search.</p>
        ) : null}
      </div>
    </div>
  );
}

const NEVER_DELEGATED_NOTE = (
  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
    Billing, staff management, partner program, custom domain, Stripe Connect, and deleting the
    business can&apos;t be given to staff.
  </p>
);

export function StaffPermissionsSettings() {
  const [staff, setStaff] = useState<TeamRow[]>([]);
  const [seats, setSeats] = useState<StaffSeatSnapshot | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("staff");
  const [invitePerms, setInvitePerms] = useState<StaffPermissions>(() => emptyStaffPermissions());
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  function openInvite() {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("staff");
    setInvitePerms(emptyStaffPermissions());
    setInviteError(null);
    setInviteOpen(true);
  }

  async function postJson(body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    const res = await fetch("/api/admin/staff", {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      seats?: StaffSeatSnapshot;
      userId?: string;
      inviteSent?: boolean;
      attachedExisting?: boolean;
      reinvited?: boolean;
    };
    return { ok: res.ok, data };
  }

  async function invite() {
    setBusy(true);
    setInviteError(null);
    setError(null);
    setNotice(null);
    try {
      const { ok, data } = await postJson({ email: inviteEmail, fullName: inviteName });
      if (!ok) {
        setInviteError(data.error || "Invite failed.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      if (data.seats) setSeats(data.seats);
      const base = data.reinvited
        ? "Staff member reactivated (same account, no duplicate)."
        : data.attachedExisting && !data.inviteSent
          ? "Existing account linked as staff. They can sign in with their current password."
          : "Invite sent. They’ll set a password from the email link.";

      // Apply the chosen role / permissions to the new teammate.
      let follow = "";
      if (data.userId && inviteRole === "admin") {
        const promoted = await postJson({ action: "promote_admin", userId: data.userId });
        if (promoted.data.seats) setSeats(promoted.data.seats);
        follow = promoted.ok
          ? " They're an Admin now."
          : ` They were added as Staff: ${promoted.data.error || "could not make them an Admin."}`;
      } else if (data.userId && Object.entries(invitePerms).some(([k, v]) => k !== "v" && v === true)) {
        const patched = await postJson({ userId: data.userId, permissions: invitePerms }, "PATCH");
        follow = patched.ok
          ? ""
          : ` Permissions were not saved: ${patched.data.error || "try Edit."}`;
      }

      setNotice(base + follow);
      setInviteOpen(false);
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
      const { ok, data } = await postJson(
        {
          userId: edit.userId,
          fullName: edit.fullName,
          email: edit.email,
          permissions: edit.role === "staff" ? edit.permissions : undefined,
        },
        "PATCH"
      );
      if (!ok) {
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
      const { ok, data } = await postJson({ action: "promote_admin", userId });
      if (!ok) {
        setError(data.error || "Could not promote to admin.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      setSeats(data.seats ?? null);
      setNotice("Promoted to admin: full owner-equivalent access.");
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
      const { ok, data } = await postJson({
        action: "demote_staff",
        userId,
        permissions: emptyStaffPermissions(),
      });
      if (!ok) {
        setError(data.error || "Could not demote.");
        if (data.seats) setSeats(data.seats);
        return;
      }
      setSeats(data.seats ?? null);
      setNotice("Changed to staff with all permissions off. Admin seat freed.");
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
      const { ok, data } = await postJson({ action: "reset_password", userId });
      if (!ok) {
        setError(data.error || "Could not send reset email.");
        return;
      }
      setNotice("Password reset email sent.");
    } finally {
      setBusy(false);
    }
  }

  /** Re-invite an existing staff member: the API re-sends the invite only if they never finished setup. */
  async function resendInvite(email: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { ok, data } = await postJson({ email });
      if (!ok) {
        setError(data.error || "Could not resend the invite.");
        return;
      }
      setNotice(
        data.inviteSent
          ? "Invite email sent again."
          : "They've already set up their account, so no invite was needed."
      );
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

  const active = staff.filter((s) => !s.disabled_at);
  const disabled = staff.filter((s) => s.disabled_at);
  const staffCount = active.filter((s) => s.role === "staff").length;
  const seatPct =
    seats && seats.limit ? Math.min(100, Math.round((seats.used / Math.max(1, seats.limit)) * 100)) : 0;

  const rows = active.map((s) => {
    const isOwner = ownerUserId === s.id;
    return { row: s, isOwner, chips: accessChips(s, isOwner) };
  });

  function rowActions(s: TeamRow, isOwner: boolean) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 sm:h-8"
          disabled={busy}
          onClick={() => openEdit(s)}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </Button>
        {!isOwner ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-11 text-muted sm:h-8"
            disabled={busy}
            onClick={() => void remove(s)}
            aria-label={`Remove ${s.full_name || s.email}`}
            title="Remove from team"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="sm:sr-only">Remove</span>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div id="settings-staff" tabIndex={-1} className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading id="staff">Staff & Permissions</SectionHeading>
          <p className="mt-1 text-sm text-muted">Invite your team and choose what each person can do.</p>
        </div>
        <Button type="button" variant="accent" className="h-11" onClick={openInvite} disabled={busy}>
          <UserPlus className="h-4 w-4" aria-hidden /> Invite teammate
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[13px] font-semibold text-muted">Admin seats</p>
          <p className="mt-1 text-2xl font-bold text-heading">
            {seats?.used ?? "–"}{" "}
            <span className="text-sm font-medium text-muted">
              {seats?.limit != null ? `of ${seats.limit} used` : "· unlimited"}
            </span>
          </p>
          {seats?.limit != null ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle"
              role="progressbar"
              aria-label="Admin seats used"
              aria-valuemin={0}
              aria-valuemax={seats.limit}
              aria-valuenow={seats.used}
            >
              <div
                className={cn("h-full rounded-full", seats.overLimit ? "bg-amber-500" : "bg-accent")}
                style={{ width: `${seatPct}%` }}
              />
            </div>
          ) : null}
          {seats?.overLimit ? (
            <p className="mt-2 text-xs text-amber-700 surface-dark:text-amber-300">
              Over your plan&apos;s limit. Existing admins keep access; new admins can&apos;t be added.
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[13px] font-semibold text-muted">Staff seats</p>
          <p className="mt-1 text-2xl font-bold text-heading">
            {staffCount}{" "}
            <span className="text-sm font-medium text-muted">
              · unlimited{seats?.planName ? ` on ${seats.planName}` : ""}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">Staff don&apos;t use a seat.</p>
        </div>
      </div>

      {notice ? <p className="text-sm text-emerald-700 surface-dark:text-emerald-300" role="status">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600 surface-dark:text-red-400" role="alert">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No team members yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Can access</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ row: s, isOwner, chips }) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                          {initials(s)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-heading">{s.full_name || s.email}</p>
                          <p className="truncate text-[13px] text-muted">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RolePill isOwner={isOwner} role={s.role} />
                    </td>
                    <td className="px-3 py-3">
                      <AccessChips chips={chips} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={ACTIVE_PILL}>Active</span>
                    </td>
                    <td className="px-5 py-3">{rowActions(s, isOwner)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map(({ row: s, isOwner, chips }) => (
                <li key={s.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(s)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-heading">{s.full_name || s.email}</p>
                      <p className="truncate text-[13px] text-muted">{s.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <RolePill isOwner={isOwner} role={s.role} />
                        <span className={ACTIVE_PILL}>Active</span>
                      </div>
                    </div>
                  </div>
                  <AccessChips chips={chips} />
                  {rowActions(s, isOwner)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: Crown, title: "Owner", text: "Created the business. Full access." },
          { icon: Shield, title: "Admin", text: "Full access, same as the owner. Uses an admin seat." },
          { icon: User, title: "Staff", text: "Only the areas you pick, like projects or media." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-heading">
              <Icon className="h-4 w-4 text-accent" aria-hidden /> {title}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted">{text}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <button
          type="button"
          aria-expanded={showRemoved}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-medium text-foreground hover:bg-subtle"
          onClick={() => setShowRemoved((v) => !v)}
        >
          <span>Show removed team members</span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition", showRemoved && "rotate-180")} aria-hidden />
        </button>
        {showRemoved ? (
          <ul className="divide-y divide-border border-t border-border">
            {disabled.length === 0 ? (
              <li className="px-5 py-4 text-sm text-muted">No removed members.</li>
            ) : (
              disabled.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 opacity-70">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted">
                    {initials(s)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-heading">{s.full_name || s.email}</p>
                    <p className="truncate text-[13px] text-muted">{s.email} · Removed. Invite again to reactivate.</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {/* Invite teammate */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!busy) setInviteOpen(false);
        }}
        title="Invite teammate"
        className="sm:max-w-2xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setInviteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              className="h-11"
              onClick={() => void invite()}
              disabled={busy || !inviteEmail.trim()}
            >
              <Mail className="h-4 w-4" aria-hidden /> {busy ? "Sending…" : "Send invite"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-invite-email">Email</Label>
              <Input
                id="staff-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mt-1 h-11"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="staff-invite-name">Name (optional)</Label>
              <Input
                id="staff-invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Alex"
                className="mt-1 h-11"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-heading">Role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["staff", "Staff", "Only the areas you pick below. No seat used."],
                  [
                    "admin",
                    "Admin",
                    seats?.limit != null
                      ? `Full access. Uses an admin seat (${seats.used} of ${seats.limit} used).`
                      : "Full access, same as the owner. Uses an admin seat.",
                  ],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3",
                    inviteRole === value ? "border-accent bg-accent-subtle" : "border-border hover:bg-subtle"
                  )}
                >
                  <input
                    type="radio"
                    name="staff-invite-role"
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                    checked={inviteRole === value}
                    onChange={() => setInviteRole(value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-heading">{label}</span>
                    <span className="block text-[13px] text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {inviteRole === "staff" ? (
            <PermissionPicker permissions={invitePerms} onChange={setInvitePerms} disabled={busy} />
          ) : null}

          {NEVER_DELEGATED_NOTE}
          {inviteError ? <p className="text-sm text-red-600 surface-dark:text-red-400" role="alert">{inviteError}</p> : null}
        </div>
      </Modal>

      {/* Edit teammate (existing permissions editor) */}
      <Modal
        open={edit != null}
        onClose={() => setEdit(null)}
        title={edit?.role === "admin" ? "Edit admin" : "Edit staff member"}
        className="sm:max-w-2xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setEdit(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="accent" className="h-11" onClick={() => void saveEdit()} disabled={busy}>
              Save changes
            </Button>
          </div>
        }
      >
        {edit ? (
          <div id="settings-staff-permissions" className="space-y-4">
            <p className="text-sm text-muted">Changes apply on their next request.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="staff-edit-name">Name</Label>
                <Input
                  id="staff-edit-name"
                  value={edit.fullName}
                  onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="staff-edit-email">Email</Label>
                <Input
                  id="staff-edit-email"
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="mt-1 h-11"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                disabled={busy}
                onClick={() => void resetPassword(edit.userId)}
              >
                Send password reset email
              </Button>
              {edit.role === "staff" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-8"
                  disabled={busy}
                  title="Sends the invite again if they haven't set up their account yet"
                  onClick={() => void resendInvite(edit.email)}
                >
                  Resend invite
                </Button>
              ) : null}
            </div>
            {notice ? <p className="text-sm text-emerald-700 surface-dark:text-emerald-300" role="status">{notice}</p> : null}
            {error ? <p className="text-sm text-red-600 surface-dark:text-red-400" role="alert">{error}</p> : null}

            {edit.role === "staff" ? (
              <PermissionPicker
                permissions={edit.permissions}
                onChange={(permissions) => setEdit({ ...edit, permissions })}
                disabled={busy}
                onPromoteAdmin={() => void promoteToAdmin(edit.userId)}
              />
            ) : (
              <div className="space-y-3 rounded-xl bg-subtle px-4 py-3 text-sm text-foreground">
                <p>
                  This person is an <strong className="text-heading">admin</strong> with full dashboard and
                  settings access. Change them to staff to pick their areas and free an admin seat.
                </p>
                {ownerUserId === edit.userId ? (
                  <p className="text-xs text-amber-700 surface-dark:text-amber-300">
                    This is the original business owner and can&apos;t be changed to staff or removed.
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 sm:h-8"
                    disabled={busy}
                    onClick={() => void demoteToStaff(edit.userId)}
                  >
                    Change to staff
                  </Button>
                )}
              </div>
            )}

            {NEVER_DELEGATED_NOTE}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
