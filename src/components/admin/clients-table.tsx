"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { Users, Search, ExternalLink, Mail, Phone } from "lucide-react";

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
  activeProjects: number;
  deliveredProjects: number;
  lastActivity: string | null;
  lastLogin: string | null;
  latestAddress: string | null;
  projectLinks: { id: string; name: string; status: string }[];
}

interface ClientsTableProps {
  clients: ClientRow[];
}

type SortKey = "name" | "created_at" | "activeProjects" | "lastActivity";

export function ClientsTable({ clients }: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("all");
  const [selected, setSelected] = useState<ClientRow | null>(null);

  const filtered = useMemo(() => {
    let list = [...clients];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      );
    }

    if (filter === "active") list = list.filter((c) => c.activeProjects > 0);
    if (filter === "delivered") list = list.filter((c) => c.deliveredProjects > 0);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "activeProjects") cmp = a.activeProjects - b.activeProjects;
      else if (sortKey === "lastActivity") {
        const aT = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const bT = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        cmp = aT - bT;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, search, sortKey, sortDir, filter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const SortBtn = ({ label, col }: { label: string; col: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="font-medium text-left hover:text-accent"
    >
      {label}{sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  if (!clients.length) {
    return (
      <EmptyState
        icon={Users}
        title="No clients yet"
        description="Create your first client to start managing projects."
      >
        <Link href="/admin/clients/new">
          <Button variant="accent">New Client</Button>
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            options={[
              { value: "all", label: "All clients" },
              { value: "active", label: "With active projects" },
              { value: "delivered", label: "With delivered projects" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs text-muted">
              <th className="px-4 py-3"><SortBtn label="Client" col="name" /></th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3 hidden lg:table-cell">Phone</th>
              <th className="px-4 py-3 hidden lg:table-cell">Company</th>
              <th className="px-4 py-3 hidden xl:table-cell">Address</th>
              <th className="px-4 py-3"><SortBtn label="Active" col="activeProjects" /></th>
              <th className="px-4 py-3 hidden sm:table-cell">Delivered</th>
              <th className="px-4 py-3 hidden lg:table-cell">Last Login</th>
              <th className="px-4 py-3 hidden md:table-cell"><SortBtn label="Last Activity" col="lastActivity" /></th>
              <th className="px-4 py-3 hidden sm:table-cell"><SortBtn label="Created" col="created_at" /></th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr
                key={`client-row-${client.id}`}
                className="border-b border-border last:border-0 hover:bg-slate-50/80 cursor-pointer"
                onClick={() => setSelected(client)}
              >
                <td className="px-4 py-3 font-medium text-primary">{client.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{client.email}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted">{client.phone || "—"}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted">{client.company || "—"}</td>
                <td className="px-4 py-3 hidden xl:table-cell text-muted max-w-[160px] truncate">{client.latestAddress || "—"}</td>
                <td className="px-4 py-3">
                  {client.activeProjects > 0 ? (
                    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      {client.projectLinks
                        .filter((p) => p.status !== "delivered")
                        .slice(0, 3)
                        .map((p) => (
                          <Link
                            key={`active-${client.id}-${p.id}`}
                            href={`/admin/projects/${p.id}`}
                            className="text-xs text-accent hover:underline"
                          >
                            {p.name}
                          </Link>
                        ))}
                      {client.activeProjects > 3 && (
                        <span className="text-xs text-muted">+{client.activeProjects - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted">{client.deliveredProjects}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted text-xs">
                  {client.lastLogin ? formatDate(client.lastLogin) : "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted text-xs">
                  {client.lastActivity ? formatDate(client.lastActivity) : "—"}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted text-xs">{formatDate(client.created_at)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/admin/clients/${client.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No clients match your search.</p>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Client"}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-muted"><Mail className="h-4 w-4" /> {selected.email}</p>
              {selected.phone && <p className="flex items-center gap-2 text-muted"><Phone className="h-4 w-4" /> {selected.phone}</p>}
              {selected.company && <p className="text-muted">Company: {selected.company}</p>}
              {selected.latestAddress && <p className="text-muted">Latest property: {selected.latestAddress}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{selected.activeProjects}</p>
                <p className="text-xs text-muted">Active projects</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{selected.deliveredProjects}</p>
                <p className="text-xs text-muted">Delivered</p>
              </div>
            </div>
            {selected.projectLinks.length > 0 && (
              <div>
                <p className="font-medium text-primary mb-2">Projects</p>
                <ul className="space-y-1">
                  {selected.projectLinks.map((p) => (
                    <li key={`drawer-${selected.id}-${p.id}`}>
                      <Link href={`/admin/projects/${p.id}`} className="text-accent hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-muted ml-2 text-xs">{p.status.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href={`/admin/clients/${selected.id}`}>
              <Button variant="accent" className="w-full">
                Full Client Profile <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}
