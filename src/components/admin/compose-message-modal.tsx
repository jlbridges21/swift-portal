"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClientOption = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

type ProjectOption = {
  id: string;
  project_name: string;
};

export function ComposeMessageModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = clients.find((c) => c.id === selectedClientId) ?? null;

  const searchClients = useCallback(async (q: string) => {
    setLoadingClients(true);
    try {
      const url = q.trim()
        ? `/api/clients?q=${encodeURIComponent(q.trim())}`
        : "/api/clients";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as ClientOption[];
      setClients(Array.isArray(data) ? data : []);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedClientId("");
    setProjectId("");
    setBody("");
    setProjects([]);
    void searchClients("");
  }, [open, searchClients]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void searchClients(query), 250);
    return () => window.clearTimeout(t);
  }, [query, open, searchClients]);

  useEffect(() => {
    if (!selectedClientId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    void (async () => {
      // Load projects this client owns or is attached to (tenant-scoped via clients CRM data).
      const res = await fetch(`/api/clients/${selectedClientId}/projects`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as ProjectOption[];
        setProjects(Array.isArray(data) ? data : []);
        return;
      }
      // Fallback: empty optional list if helper route missing
      setProjects([]);
    })();
  }, [selectedClientId]);

  function handleClientCreated(client: Client) {
    const option: ClientOption = {
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company,
    };
    setClients((prev) => {
      if (prev.some((c) => c.id === option.id)) return prev;
      return [option, ...prev];
    });
    setSelectedClientId(option.id);
    setQuery(option.name);
    setCreateOpen(false);
  }

  async function handleSend() {
    if (!selectedClientId || !body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_id: selectedClientId,
          body: body.trim(),
          project_id: projectId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to send");
        return;
      }
      toast.success("Message sent");
      onSent(selectedClientId);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="New message">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="compose-client-search">Client</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New client
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="compose-client-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedClientId("");
                }}
                placeholder="Search by name, email, or company…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <div
              role="listbox"
              aria-label="Clients"
              className="max-h-44 overflow-y-auto rounded-lg border border-border"
            >
              {loadingClients ? (
                <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </p>
              ) : clients.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted">No clients found.</p>
              ) : (
                clients.map((c) => {
                  const active = c.id === selectedClientId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setQuery(c.company ? `${c.name} (${c.company})` : c.name);
                      }}
                      className={cn(
                        "flex w-full flex-col items-start border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50",
                        active && "bg-accent/10"
                      )}
                    >
                      <span className="font-medium text-primary">{c.name}</span>
                      <span className="text-xs text-muted">
                        {[c.email, c.company].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {selected ? (
              <p className="text-xs text-muted">
                To: <span className="font-medium text-primary">{selected.name}</span>
                {selected.email ? ` · ${selected.email}` : ""}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="compose-project">Project (optional)</Label>
            <Select
              id="compose-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!selectedClientId}
              options={[
                { value: "", label: "No project" },
                ...projects.map((p) => ({ value: p.id, label: p.project_name })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="compose-body">Message</Label>
            <Textarea
              id="compose-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              maxLength={5000}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={sending || !selectedClientId || !body.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </div>
        </div>
      </Modal>

      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleClientCreated}
      />
    </>
  );
}
