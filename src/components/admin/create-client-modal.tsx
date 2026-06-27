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
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });

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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create client");
      toast.success("Client created");
      onCreated(data as Client);
      setForm({ name: "", email: "", phone: "", company: "" });
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
