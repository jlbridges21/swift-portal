"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import type { Client } from "@/lib/types";

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
}

export function CreateClientModal({ open, onClose, onCreated }: CreateClientModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    sendInvite: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          send_portal_invite: form.sendInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error || "Failed to create client");
      if (res.status === 207) {
        toast.warning(data.error || "Client created but the portal invite failed");
      } else if (form.sendInvite) {
        toast.success("Client created — portal invite sent");
      } else {
        toast.success("Client created");
      }
      onCreated(data as Client);
      setForm({ name: "", email: "", phone: "", company: "", sendInvite: true });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-client-name">Full Name *</Label>
          <Input
            id="new-client-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-client-email">Email *</Label>
          <Input
            id="new-client-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="min-h-11"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-client-phone">Phone</Label>
            <Input
              id="new-client-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-client-company">Company</Label>
            <Input
              id="new-client-company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="min-h-11"
            />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-slate-50/80 surface-dark:bg-subtle/80 p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-heading">
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={(e) => setForm({ ...form, sendInvite: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Email a portal invite
          </label>
          <p className="text-xs text-muted">
            The client gets a secure link to create their own password. A portal account is optional — you can
            work with them, send quotes, schedule and invoice either way, and invite them later.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-11">
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={saving} className="min-h-11">
            {saving ? "Creating…" : "Create Client"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
