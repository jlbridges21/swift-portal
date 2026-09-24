"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffSeatSnapshot } from "@/lib/staff";

type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  disabled_at: string | null;
  created_at: string;
};

export function StaffTeamCard() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [seats, setSeats] = useState<StaffSeatSnapshot | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function remove(userId: string) {
    if (!window.confirm("Remove this staff member?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/staff?userId=${encodeURIComponent(userId)}`, {
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
      await load();
    } finally {
      setBusy(false);
    }
  }

  const active = staff.filter((s) => !s.disabled_at);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="mt-1 text-sm text-slate-600">
            Invite teammates. Staff are unlimited; admin seats are limited by plan.
          </p>
        </div>
        {seats && seats.limit != null ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">
              {seats.used} of {seats.limit} admin seats
            </span>
            {seats.planName ? (
              <span className="text-slate-500"> · {seats.planName}</span>
            ) : null}
            <span className="block text-xs text-slate-500">Staff: unlimited</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@studio.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="staff-name">Name (optional)</Label>
          <Input
            id="staff-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex"
            className="mt-1"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !email.trim()} onClick={() => void invite()}>
          Invite staff
        </Button>
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
        {active.length === 0 ? (
          <li className="py-4 text-sm text-slate-500">No staff members yet.</li>
        ) : null}
        {active.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{s.full_name || s.email}</p>
              <p className="text-xs text-slate-500">{s.email}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void remove(s.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
