"use client";

import { useState } from "react";
import { Plus, Search, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { ALL_CLIENTS, searchClients, type ClientViewClient } from "@/lib/client-view";
import type { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClientSidebar({
  clients,
  counts,
  selectedId,
  onSelect,
  canCreateClient,
  onClientCreated,
}: {
  clients: ClientViewClient[];
  /** client id → project count on the board. */
  counts: Record<string, number>;
  selectedId: string;
  onSelect: (clientId: string) => void;
  canCreateClient: boolean;
  onClientCreated: (client: Client) => void;
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const matches = searchClients(clients, query);

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="text-base font-semibold text-heading">Clients</h2>
        {canCreateClient ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Add a new client"
            title="Add a new client"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <label className="relative block">
          <span className="sr-only">Search clients</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients..."
            className="h-10 pl-9"
          />
        </label>
      </div>

      <nav aria-label="Clients" className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-2 py-2 max-lg:max-h-64">
        <ul className="space-y-0.5">
          {!query.trim() ? (
            <li>
              <ClientRow
                label="All Clients"
                count={clients.length}
                countTitle={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
                icon={Users}
                selected={selectedId === ALL_CLIENTS}
                onClick={() => onSelect(ALL_CLIENTS)}
              />
            </li>
          ) : null}
          {matches.map((client) => (
            <li key={client.id}>
              <ClientRow
                label={client.name}
                sublabel={client.company && client.company !== client.name ? client.company : null}
                count={counts[client.id] ?? 0}
                countTitle={`${counts[client.id] ?? 0} project${counts[client.id] === 1 ? "" : "s"}`}
                icon={User}
                selected={selectedId === client.id}
                onClick={() => onSelect(client.id)}
              />
            </li>
          ))}
        </ul>
        {matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">
            {clients.length === 0 ? "No clients yet." : "No clients match your search."}
          </p>
        ) : null}
      </nav>

      {canCreateClient ? (
        <CreateClientModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(client) => {
            setCreateOpen(false);
            setQuery("");
            onClientCreated(client);
          }}
        />
      ) : null}
    </aside>
  );
}

function ClientRow({
  label,
  sublabel,
  count,
  countTitle,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  sublabel?: string | null;
  count: number;
  countTitle: string;
  icon: typeof User;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
        selected
          ? "bg-accent-subtle font-medium text-accent"
          : "text-foreground hover:bg-slate-50 surface-dark:hover:bg-subtle"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-accent" : "text-muted")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sublabel ? <span className="block truncate text-xs font-normal text-muted">{sublabel}</span> : null}
      </span>
      <span
        title={countTitle}
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
          selected ? "bg-card text-accent" : count > 0 ? "bg-slate-100 text-muted surface-dark:bg-subtle" : "text-muted/60"
        )}
      >
        {count}
      </span>
    </button>
  );
}
