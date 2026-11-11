"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Search, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

type ProjectClientRow = {
  id: string;
  client_id: string;
  is_primary: boolean;
  clients?: Client & { user_id?: string | null };
};

type ClientOption = Pick<Client, "id" | "name" | "email" | "company">;

/**
 * Details-tab client card. Mirrors the Staff card's look and drives the same
 * project-client handlers as the sidebar "Manage clients" dialog, so both stay
 * in sync through the parent's `projectClients` state.
 */
export function ProjectClientsDetailsCard({
  primaryClient,
  primaryClientId,
  projectClients,
  allClients,
  onAddClient,
  onSetPrimary,
  onRemove,
  onCreateClient,
}: {
  primaryClient: Client | null;
  primaryClientId: string | null;
  projectClients: ProjectClientRow[];
  allClients: ClientOption[];
  onAddClient: (clientId: string) => Promise<boolean>;
  onSetPrimary: (pcId: string, clientId: string) => void | Promise<void>;
  onRemove: (pcId: string) => void | Promise<void>;
  onCreateClient: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientOption | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const associated = useMemo(() => {
    const rows = [...projectClients];
    if (primaryClientId && primaryClient && !rows.some((pc) => pc.client_id === primaryClientId)) {
      rows.unshift({ id: "primary-fallback", client_id: primaryClientId, is_primary: true, clients: primaryClient });
    }
    // Primary first, then the order they were added.
    return rows.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  }, [projectClients, primaryClientId, primaryClient]);

  const available = useMemo(() => {
    const taken = new Set(associated.map((pc) => pc.client_id));
    return allClients.filter((c) => !taken.has(c.id));
  }, [allClients, associated]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? available.filter((c) =>
          [c.name, c.email, c.company].some((v) => v?.toLowerCase().includes(q))
        )
      : available;
    return list.slice(0, 8);
  }, [available, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A selection that has since been assigned (e.g. from the sidebar dialog) is no longer valid.
  useEffect(() => {
    if (selected && !available.some((c) => c.id === selected.id)) {
      setSelected(null);
      setQuery("");
    }
  }, [available, selected]);

  function pick(c: ClientOption) {
    setSelected(c);
    setQuery(c.company ? `${c.name} (${c.company})` : c.name);
    setOpen(false);
  }

  async function add() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const ok = await onAddClient(selected.id);
      if (ok) {
        setSelected(null);
        setQuery("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Clients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Everyone here can see this project in their client portal once they activate it.
        </p>

        <ul className="divide-y divide-slate-100 surface-dark:divide-border rounded-lg border border-slate-100 surface-dark:border-border">
          {associated.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500 surface-dark:text-muted">No clients assigned.</li>
          ) : (
            associated.map((pc) => {
              const client = pc.clients;
              const name = client?.full_name || client?.name || client?.email || "Client";
              const email = client?.email;
              return (
                <li key={pc.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900 surface-dark:text-heading">
                      <span className="truncate">{name}</span>
                      {pc.is_primary ? (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    {email && email !== name ? (
                      <p className="truncate text-xs text-slate-500 surface-dark:text-muted">{email}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {!pc.is_primary ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="px-2 text-xs"
                        onClick={() => void onSetPrimary(pc.id, pc.client_id)}
                      >
                        Make primary
                      </Button>
                    ) : null}
                    <Link
                      href={`/admin/clients/${pc.client_id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-50 hover:text-heading surface-dark:hover:bg-subtle"
                      aria-label={`View ${name}`}
                      title="View client"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    {pc.id !== "primary-fallback" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onRemove(pc.id)}
                        aria-label={`Remove ${name} from project`}
                        title="Remove from project"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex max-w-xl flex-wrap items-end gap-2">
          <div ref={wrapRef} className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label="Search clients to add"
              placeholder={available.length ? "Search clients…" : "No other clients yet"}
              disabled={available.length === 0}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setHighlight(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setHighlight((h) => Math.min(h + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (open && matches[highlight]) pick(matches[highlight]);
                  else if (selected) void add();
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              className="flex h-10 w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 surface-dark:bg-card surface-dark:focus-visible:ring-offset-background"
            />
            {open && available.length > 0 ? (
              <ul
                id={listId}
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-white p-1 shadow-lg surface-dark:bg-card"
              >
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No matching clients.</li>
                ) : (
                  matches.map((c, i) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={selected?.id === c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(c);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                        i === highlight ? "bg-slate-50 surface-dark:bg-subtle" : ""
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-heading">
                          {c.name}
                          {c.company ? <span className="font-normal text-muted"> · {c.company}</span> : null}
                        </span>
                        {c.email ? <span className="block truncate text-xs text-muted">{c.email}</span> : null}
                      </span>
                      {selected?.id === c.id ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
                    </li>
                  ))
                )}
                <li
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    onCreateClient();
                  }}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border-t border-border px-3 py-2 text-sm font-medium text-accent hover:bg-slate-50 surface-dark:hover:bg-subtle"
                >
                  <UserPlus className="h-4 w-4" /> Add new client
                </li>
              </ul>
            ) : null}
          </div>
          <Button type="button" size="sm" disabled={busy || !selected} onClick={() => void add()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
        <button
          type="button"
          onClick={onCreateClient}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add new client
        </button>
      </CardContent>
    </Card>
  );
}
