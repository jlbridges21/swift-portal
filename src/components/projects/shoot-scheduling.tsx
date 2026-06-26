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
import { useAsyncAction } from "@/lib/use-async-action";
import { Calendar, Check, MessageSquare, X, Pencil, Clock } from "lucide-react";
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
  const [actionId, setActionId] = useState<string | null>(null);

  const { run: runPropose, pending: proposing } = useAsyncAction(async (body: object) => {
    const res = await fetch("/api/shoot-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed");
    return res;
  });

  const { run: runPatch, pending: patching } = useAsyncAction(async (body: object) => {
    const res = await fetch("/api/shoot-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed");
    return res;
  });

  const busy = proposing || patching;

  const pending = proposals.filter((p) => p.status === "pending");
  const confirmed = proposals.find((p) => p.status === "confirmed");
  const pendingFromAdmin = pending.filter((p) => p.proposed_by === "admin");
  const pendingFromClient = pending.filter((p) => p.proposed_by === "client");

  const canProposeNew = !confirmed && pending.length === 0;

  async function proposeShoot(e: React.FormEvent) {
    e.preventDefault();
    try {
      await runPropose({
        project_id: projectId,
        proposed_at: new Date(proposedAt).toISOString(),
        message,
      });
      toast.success(isAdmin ? "Shoot time proposed" : "Shoot time suggested");
      setShowForm(false);
      setProposedAt("");
      setMessage("");
      onUpdate();
    } catch {
      toast.error("Failed to propose date");
    }
  }

  async function rescheduleShoot(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleAt) return;
    try {
      await runPatch({
        action: "reschedule",
        project_id: projectId,
        proposed_at: new Date(rescheduleAt).toISOString(),
        message: rescheduleMsg,
      });
      toast.success("New shoot time proposed — awaiting confirmation");
      setShowReschedule(false);
      setRescheduleAt("");
      setRescheduleMsg("");
      onUpdate();
    } catch {
      toast.error("Failed to reschedule");
    }
  }

  async function acceptProposal(id: string) {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await runPatch({ id, action: "accept" });
      if (res) {
        toast.success("Shoot time approved!");
        onUpdate();
      }
    } catch {
      toast.error("Failed to approve time");
    } finally {
      setActionId(null);
    }
  }

  async function declineProposal(id: string) {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await runPatch({ id, action: "decline" });
      if (res) {
        toast.success("Proposal declined");
        onUpdate();
      }
    } catch {
      toast.error("Failed to decline proposal");
    } finally {
      setActionId(null);
    }
  }

  async function counterProposal(id: string) {
    if (!counterAt) return;
    try {
      await runPatch({
        id,
        action: "counter",
        proposed_at: new Date(counterAt).toISOString(),
        message: counterMsg,
      });
      toast.success("Alternative time sent");
      setShowCounter(null);
      setCounterAt("");
      setCounterMsg("");
      onUpdate();
    } catch {
      toast.error("Failed to send alternative time");
    }
  }

  function openCounter(id: string) {
    setShowCounter(id);
    setCounterAt("");
    setCounterMsg("");
  }

  function ProposalActions({
    proposal,
    viewerIsAdmin,
  }: {
    proposal: ShootProposal;
    viewerIsAdmin: boolean;
  }) {
    const fromOtherParty =
      (viewerIsAdmin && proposal.proposed_by === "client") ||
      (!viewerIsAdmin && proposal.proposed_by === "admin");

    if (!fromOtherParty) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="accent"
          size="sm"
          className="min-h-11"
          disabled={busy || actionId === proposal.id}
          onClick={() => acceptProposal(proposal.id)}
        >
          <Check className="h-4 w-4" /> {actionId === proposal.id ? "Approving..." : "Approve Time"}
        </Button>
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => openCounter(proposal.id)}>
          <MessageSquare className="h-4 w-4" /> Request a Different Time
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={busy || actionId === proposal.id}
          onClick={() => declineProposal(proposal.id)}
        >
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    );
  }

  return (
    <Card className="shadow-sm" id="scheduling">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-accent" /> Shoot Scheduling
        </CardTitle>
        {canProposeNew && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => setShowForm(!showForm)}
          >
            {isAdmin ? "Propose a Shoot Time" : "Suggest a Shoot Time"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmed && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0"
                  onClick={() => setShowReschedule(!showReschedule)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Reschedule
                </Button>
              )}
            </div>
          </div>
        )}

        {showReschedule && isAdmin && (
          <form onSubmit={rescheduleShoot} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-sm font-medium text-amber-900">Propose a new confirmed shoot time</p>
            <div className="space-y-2">
              <Label>New Date & Time</Label>
              <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message to client</Label>
              <Textarea value={rescheduleMsg} onChange={(e) => setRescheduleMsg(e.target.value)} rows={2} placeholder="Reason for reschedule..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="accent" size="sm" className="min-h-11" disabled={busy}>
                Send New Time
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setShowReschedule(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {showForm && canProposeNew && (
          <form onSubmit={proposeShoot} className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-primary">
              {isAdmin ? "Propose a shoot date and time for the client to review." : "Suggest a date and time that works for your shoot."}
            </p>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder={isAdmin ? "Weather backup, access notes..." : "Access instructions or scheduling notes..."}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="accent" size="sm" className="min-h-11" disabled={busy}>
                {isAdmin ? "Send Proposal" : "Send Suggestion"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!isAdmin && pendingFromClient.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
            <Clock className="h-5 w-5 shrink-0 mt-0.5" />
            <p>Your suggested shoot time is awaiting review from Swift Aerial Media.</p>
          </div>
        )}

        {isAdmin && pendingFromAdmin.length > 0 && pendingFromClient.length === 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted">
            <Clock className="h-5 w-5 shrink-0 mt-0.5" />
            <p>Waiting for the client to respond to your proposed shoot time.</p>
          </div>
        )}

        {pending.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{formatShootDateTime(p.proposed_at)}</p>
                <p className="text-xs text-muted mt-0.5">
                  Proposed by {p.proposed_by === "admin" ? "Swift Aerial Media" : "Client"}
                </p>
                {p.message && <p className="text-sm text-muted mt-2">{p.message}</p>}
              </div>
              <Badge variant={p.proposed_by === "admin" ? "default" : "warning"} className="shrink-0 w-fit">
                Awaiting response
              </Badge>
            </div>

            <ProposalActions proposal={p} viewerIsAdmin={isAdmin} />

            {isAdmin && p.proposed_by === "admin" && (
              <div className="mt-3">
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => declineProposal(p.id)}>
                  <X className="h-4 w-4" /> Withdraw Proposal
                </Button>
              </div>
            )}

            {showCounter === p.id && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium text-primary">Request a different time</p>
                <Input type="datetime-local" value={counterAt} onChange={(e) => setCounterAt(e.target.value)} required />
                <Textarea
                  value={counterMsg}
                  onChange={(e) => setCounterMsg(e.target.value)}
                  placeholder="Brief message..."
                  rows={2}
                />
                <Button size="sm" variant="accent" className="min-h-11" disabled={busy} onClick={() => counterProposal(p.id)}>
                  Send Alternative Time
                </Button>
              </div>
            )}
          </div>
        ))}

        {proposals.length === 0 && !showForm && (
          <p className="text-sm text-muted text-center py-4">
            {isAdmin
              ? "Propose a shoot date and time for the client to confirm."
              : "No shoot time scheduled yet. Suggest a date and time that works for you."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
