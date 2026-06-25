"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShootProposal } from "@/lib/types";
import { formatShootDateTime } from "@/lib/scheduling";
import { Calendar, Check, MessageSquare, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ShootSchedulingProps {
  projectId: string;
  proposals: ShootProposal[];
  isAdmin: boolean;
  onUpdate: () => void;
}

export function ShootScheduling({ projectId, proposals, isAdmin, onUpdate }: ShootSchedulingProps) {
  const [showForm, setShowForm] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCounter, setShowCounter] = useState<string | null>(null);
  const [proposedAt, setProposedAt] = useState("");
  const [message, setMessage] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleMsg, setRescheduleMsg] = useState("");
  const [counterAt, setCounterAt] = useState("");
  const [counterMsg, setCounterMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const pending = proposals.filter((p) => p.status === "pending");
  const confirmed = proposals.find((p) => p.status === "confirmed");

  async function proposeShoot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/shoot-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: projectId,
        proposed_at: new Date(proposedAt).toISOString(),
        message,
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Shoot date proposed");
      setShowForm(false);
      setProposedAt("");
      setMessage("");
      onUpdate();
    } else {
      toast.error("Failed to propose date");
    }
  }

  async function rescheduleShoot(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleAt) return;
    setLoading(true);
    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "reschedule",
        project_id: projectId,
        proposed_at: new Date(rescheduleAt).toISOString(),
        message: rescheduleMsg,
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Shoot rescheduled — awaiting client confirmation");
      setShowReschedule(false);
      setRescheduleAt("");
      setRescheduleMsg("");
      onUpdate();
    } else {
      toast.error("Failed to reschedule");
    }
  }

  async function acceptProposal(id: string) {
    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "accept" }),
    });
    if (res.ok) {
      toast.success("Shoot scheduled!");
      onUpdate();
    }
  }

  async function declineProposal(id: string) {
    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "decline" }),
    });
    if (res.ok) {
      toast.success("Proposal declined");
      onUpdate();
    } else {
      toast.error("Failed to decline proposal");
    }
  }

  async function counterProposal(id: string) {
    if (!counterAt) return;
    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id,
        action: "counter",
        proposed_at: new Date(counterAt).toISOString(),
        message: counterMsg,
      }),
    });
    if (res.ok) {
      toast.success("Alternative date proposed");
      setShowCounter(null);
      onUpdate();
    }
  }

  return (
    <Card className="shadow-sm" id="scheduling">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-accent" /> Shoot Scheduling
        </CardTitle>
        {isAdmin && !confirmed && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            Propose Date
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmed && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-800">Shoot Scheduled</p>
                <p className="text-sm text-emerald-700 mt-1">
                  {formatShootDateTime(confirmed.proposed_at)}
                </p>
                {confirmed.message && (
                  <p className="text-sm text-emerald-600 mt-2">{confirmed.message}</p>
                )}
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowReschedule(!showReschedule)}>
                  <Pencil className="h-3.5 w-3.5" /> Reschedule
                </Button>
              )}
            </div>
          </div>
        )}

        {showReschedule && isAdmin && (
          <form onSubmit={rescheduleShoot} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-sm font-medium text-amber-900">Reschedule confirmed shoot</p>
            <div className="space-y-2">
              <Label>New Date & Time</Label>
              <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message to client</Label>
              <Textarea value={rescheduleMsg} onChange={(e) => setRescheduleMsg(e.target.value)} rows={2} placeholder="Reason for reschedule..." />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="accent" size="sm" disabled={loading}>Send New Date</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReschedule(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {showForm && isAdmin && (
          <form onSubmit={proposeShoot} className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Weather backup, access notes..." />
            </div>
            <Button type="submit" variant="accent" size="sm" disabled={loading}>Send Proposal</Button>
          </form>
        )}

        {pending.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{new Date(p.proposed_at).toLocaleString()}</p>
                <p className="text-xs text-muted mt-0.5">
                  Proposed by {p.proposed_by === "admin" ? "Swift Aerial Media" : "You"}
                </p>
                {p.message && <p className="text-sm text-muted mt-2">{p.message}</p>}
              </div>
              <Badge variant={p.proposed_by === "admin" ? "default" : "warning"}>
                {p.status === "pending" ? "Awaiting response" : p.status}
              </Badge>
            </div>
            {!isAdmin && p.proposed_by === "admin" && p.status === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="accent" size="sm" onClick={() => acceptProposal(p.id)}>
                  <Check className="h-4 w-4" /> Accept
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCounter(p.id)}>
                  <MessageSquare className="h-4 w-4" /> Request Different Time
                </Button>
                <Button variant="outline" size="sm" onClick={() => declineProposal(p.id)}>
                  <X className="h-4 w-4" /> Decline
                </Button>
              </div>
            )}
            {isAdmin && p.proposed_by === "client" && p.status === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="accent" size="sm" onClick={() => acceptProposal(p.id)}>Confirm</Button>
                <Button variant="outline" size="sm" onClick={() => setShowCounter(p.id)}>Counter</Button>
                <Button variant="outline" size="sm" onClick={() => declineProposal(p.id)}>Decline</Button>
              </div>
            )}
            {isAdmin && p.proposed_by === "admin" && p.status === "pending" && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => declineProposal(p.id)}>
                  <X className="h-4 w-4" /> Withdraw
                </Button>
              </div>
            )}
            {showCounter === p.id && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <Input type="datetime-local" value={counterAt} onChange={(e) => setCounterAt(e.target.value)} />
                <Textarea value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} placeholder="Brief message..." rows={2} />
                <Button size="sm" variant="accent" onClick={() => counterProposal(p.id)}>Send Alternative</Button>
              </div>
            )}
          </div>
        ))}

        {proposals.length === 0 && !showForm && (
          <p className="text-sm text-muted text-center py-4">
            {isAdmin ? "Propose a shoot date for the client to confirm." : "No shoot dates proposed yet — we'll reach out soon."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
