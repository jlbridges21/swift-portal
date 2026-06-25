"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import type { Revision } from "@/lib/types";
import { toast } from "sonner";

interface RevisionDrawerProps {
  revision: Revision | null;
  onClose: () => void;
  onUpdate: (revision: Revision) => void;
}

export function RevisionDrawer({ revision, onClose, onUpdate }: RevisionDrawerProps) {
  const [status, setStatus] = useState(revision?.status ?? "pending");
  const [adminNotes, setAdminNotes] = useState(revision?.admin_notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (revision) {
      setStatus(revision.status);
      setAdminNotes(revision.admin_notes ?? "");
    }
  }, [revision]);

  async function save() {
    if (!revision) return;
    setSaving(true);
    const res = await fetch("/api/revisions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: revision.id, status, admin_notes: adminNotes }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
      toast.success("Revision updated");
      onClose();
    } else {
      toast.error("Failed to save");
    }
  }

  return (
    <Modal open={!!revision} onClose={onClose} title="Revision Request">
      {revision && (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 border border-border p-4 text-sm">
            <p className="text-xs font-medium text-muted uppercase mb-2">Client Request</p>
            <p className="text-foreground whitespace-pre-wrap">{revision.description}</p>
            <p className="text-xs text-muted mt-3">
              Submitted {new Date(revision.created_at).toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as Revision["status"])}
              options={[
                { value: "pending", label: "Pending" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Reply to Client</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder="Your response will be visible to the client..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save & Notify Client"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
