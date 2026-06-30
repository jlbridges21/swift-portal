"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { REFERRAL_SOURCES } from "@/lib/referral-sources";
import { normalizeStatus } from "@/lib/constants";
import { formatPropertyLabel } from "@/lib/address";
import type { ClientCrmProfile, ClientNote } from "@/lib/clients-crm";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  Users, Search, ExternalLink, Mail, Phone, Building, Plus, MapPin,
  DollarSign, FolderKanban, Pencil, Trash2, Copy, MessageSquare, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPaymentActions } from "@/components/admin/admin-payment-actions";
import type { Payment } from "@/lib/types";

export type { ClientListRow } from "@/lib/clients-crm";
import type { ClientListRow } from "@/lib/clients-crm";

interface ClientsTableProps {
  clients: ClientListRow[];
  showDeleted?: boolean;
}

type SortKey =
  | "name"
  | "created_at"
  | "active_projects"
  | "lifetime_revenue"
  | "outstanding_balance"
  | "last_activity_at";

type FilterKey =
  | "all"
  | "active"
  | "outstanding"
  | "repeat"
  | "new"
  | "stale";

export function ClientsTable({ clients, showDeleted = false }: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [referralFilter, setReferralFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const filtered = useMemo(() => {
    let list = [...clients];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.referral_source?.toLowerCase().includes(q)
      );
    }

    if (filter === "active") list = list.filter((c) => c.active_projects > 0);
    if (filter === "outstanding") list = list.filter((c) => c.has_outstanding);
    if (filter === "repeat") list = list.filter((c) => c.is_repeat);
    if (filter === "new") list = list.filter((c) => c.is_new);
    if (filter === "stale") list = list.filter((c) => c.stale_activity);

    if (referralFilter) {
      list = list.filter((c) => c.referral_source === referralFilter);
    }
    if (companyFilter.trim()) {
      const q = companyFilter.toLowerCase();
      list = list.filter((c) => c.company?.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "active_projects") cmp = a.active_projects - b.active_projects;
      else if (sortKey === "lifetime_revenue") cmp = a.lifetime_revenue - b.lifetime_revenue;
      else if (sortKey === "outstanding_balance") cmp = a.outstanding_balance - b.outstanding_balance;
      else if (sortKey === "last_activity_at") {
        const aT = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bT = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        cmp = aT - bT;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, search, sortKey, sortDir, filter, referralFilter, companyFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const SortBtn = ({ label, col }: { label: string; col: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="font-medium text-left hover:text-accent whitespace-nowrap"
    >
      {label}{sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  if (!clients.length) {
    return (
      <EmptyState
        icon={Users}
        title={showDeleted ? "No hidden clients" : "No clients yet"}
        description={
          showDeleted
            ? "Deleted clients will appear here and can be restored."
            : "Create your first client to start managing projects."
        }
      >
        {!showDeleted && (
          <Link href="/admin/clients/new">
            <Button variant="accent">New Client</Button>
          </Link>
        )}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {showDeleted ? "Hidden clients (soft deleted)" : "Active clients"}
        </p>
        <Link href={showDeleted ? "/admin/clients" : "/admin/clients?view=deleted"}>
          <Button variant="outline" size="sm">
            {showDeleted ? "Back to active clients" : "View hidden clients"}
          </Button>
        </Link>
      </div>
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search name, email, company, referral..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
              options={[
                { value: "all", label: "All clients" },
                { value: "active", label: "Active projects" },
                { value: "outstanding", label: "Outstanding balance" },
                { value: "repeat", label: "Repeat clients" },
                { value: "new", label: "New (14 days)" },
                { value: "stale", label: "No recent activity" },
              ]}
            />
            <Select
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value)}
              options={[
                { value: "", label: "All referrals" },
                ...REFERRAL_SOURCES.map((s) => ({ value: s, label: s })),
              ]}
            />
            <Input
              placeholder="Filter company..."
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
        <p className="text-xs text-muted">{filtered.length} of {clients.length} clients</p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs text-muted">
              <th className="px-3 py-2.5"><SortBtn label="Client" col="name" /></th>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5 hidden lg:table-cell">Phone</th>
              <th className="px-3 py-2.5 hidden xl:table-cell">Company</th>
              <th className="px-3 py-2.5 hidden xl:table-cell">Referral</th>
              <th className="px-3 py-2.5"><SortBtn label="Revenue" col="lifetime_revenue" /></th>
              <th className="px-3 py-2.5"><SortBtn label="Outstanding" col="outstanding_balance" /></th>
              <th className="px-3 py-2.5"><SortBtn label="Active" col="active_projects" /></th>
              <th className="px-3 py-2.5 hidden lg:table-cell">Delivered</th>
              <th className="px-3 py-2.5 hidden lg:table-cell"><SortBtn label="Last Activity" col="last_activity_at" /></th>
              <th className="px-3 py-2.5 hidden xl:table-cell">Last Login</th>
              <th className="px-3 py-2.5 hidden lg:table-cell"><SortBtn label="Created" col="created_at" /></th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr
                key={client.id}
                className="border-b border-border last:border-0 hover:bg-slate-50/80 cursor-pointer"
                onClick={() => { window.location.href = `/admin/clients/${client.id}`; }}
              >
                <td className="px-3 py-2.5 font-medium text-primary">{client.name}</td>
                <td className="px-3 py-2.5 text-muted text-xs">{client.email}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted text-xs">{client.phone || "—"}</td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-muted text-xs max-w-[120px] truncate">{client.company || "—"}</td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-muted text-xs max-w-[120px] truncate">{client.referral_source || "—"}</td>
                <td className="px-3 py-2.5 font-medium">{formatCurrency(client.lifetime_revenue)}</td>
                <td className="px-3 py-2.5">
                  {client.outstanding_balance > 0 ? (
                    <span className="font-medium text-amber-700">{formatCurrency(client.outstanding_balance)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">{client.active_projects}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted">{client.delivered_projects}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted text-xs">
                  {client.last_activity_at ? formatDate(client.last_activity_at) : "—"}
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-muted text-xs">
                  {client.last_login_at ? formatDate(client.last_login_at) : "—"}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted text-xs">{formatDate(client.created_at)}</td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/admin/clients/${client.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No clients match your filters.</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((client) => (
          <Link
            key={client.id}
            href={`/admin/clients/${client.id}`}
            className="block rounded-xl border border-border bg-white p-4 shadow-sm hover:bg-slate-50/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-primary">{client.name}</p>
                <p className="text-xs text-muted">{client.email}</p>
              </div>
              {client.outstanding_balance > 0 && (
                <span className="text-xs font-medium text-amber-700">{formatCurrency(client.outstanding_balance)} due</span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-semibold text-primary">{formatCurrency(client.lifetime_revenue)}</p>
                <p className="text-muted">Revenue</p>
              </div>
              <div>
                <p className="font-semibold text-primary">{client.active_projects}</p>
                <p className="text-muted">Active</p>
              </div>
              <div>
                <p className="font-semibold text-primary">{client.delivered_projects}</p>
                <p className="text-muted">Delivered</p>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No clients match your filters.</p>
        )}
      </div>
    </>
  );
}

function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface ClientCrmProfileProps {
  data: ClientCrmProfile;
}

export function ClientCrmProfile({ data: initialData }: ClientCrmProfileProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [notes, setNotes] = useState<ClientNote[]>(initialData.notes);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editForm, setEditForm] = useState({
    name: initialData.client.full_name || initialData.client.name,
    email: initialData.client.email,
    phone: initialData.client.phone || "",
    company: initialData.client.company || "",
    referral_source: initialData.client.referral_source || "",
  });

  const { client, stats, properties, projects, communications, recentActivities, lastLogin } = data;
  const [payments, setPayments] = useState(initialData.payments);
  const displayName = client.full_name || client.name;

  const activeProjects = projects.filter((p) => normalizeStatus(p.status) !== "delivered");
  const awaitingPayment = projects.filter((p) => normalizeStatus(p.status) === "awaiting_payment");
  const deliveredProjects = projects.filter((p) => normalizeStatus(p.status) === "delivered");

  const outstandingPayments = payments.filter((p) => ["pending", "sent", "draft"].includes(p.status));
  const paidPayments = payments.filter((p) => p.status === "paid");
  const failedPayments = payments.filter((p) => ["failed", "expired", "canceled"].includes(p.status));

  const lastContact = communications[0]?.created_at ?? client.last_activity_at ?? null;

  const { run: saveClient, pending: savingClient } = useAsyncAction(async () => {
    const res = await fetch("/api/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: client.id,
        full_name: editForm.name,
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        company: editForm.company || null,
        referral_source: editForm.referral_source || null,
      }),
    });
    if (!res.ok) throw new Error("Failed to save");
    const updated = await res.json();
    setData((d) => ({ ...d, client: { ...d.client, ...updated } }));
    setShowEdit(false);
    toast.success("Client updated");
    router.refresh();
  }, { loadingLabel: "Saving..." });

  const { run: hideClient, pending: hidingClient } = useAsyncAction(async () => {
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to hide client");
    toast.success("Client hidden from dashboard");
    router.push("/admin/clients");
    router.refresh();
  }, { loadingLabel: "Hiding..." });

  const { run: restoreClient, pending: restoringClient } = useAsyncAction(async () => {
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (!res.ok) throw new Error("Failed to restore client");
    toast.success("Client restored");
    router.push(`/admin/clients/${client.id}`);
    router.refresh();
  }, { loadingLabel: "Restoring..." });

  const { run: saveNote, pending: savingNote } = useAsyncAction(async () => {
    if (!noteText.trim()) return;
    const url = `/api/clients/${client.id}/notes`;
    const res = editingNote
      ? await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_id: editingNote.id, note: noteText }),
        })
      : await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: noteText }),
        });
    if (!res.ok) throw new Error("Failed to save note");
    const saved = await res.json();
    if (editingNote) {
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? { ...saved, author_name: editingNote.author_name } : n)));
    } else {
      setNotes((prev) => [saved, ...prev]);
    }
    setNoteText("");
    setShowNoteForm(false);
    setEditingNote(null);
    toast.success(editingNote ? "Note updated" : "Note added");
  }, { loadingLabel: "Saving..." });

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/clients/${client.id}/notes?note_id=${noteId}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    }
  }

  function copyPortalLink() {
    const url = `${window.location.origin}/login`;
    navigator.clipboard.writeText(url);
    toast.success("Portal login link copied");
  }

  function commLabel(type: string): string {
    const map: Record<string, string> = {
      email_sent: "Email sent",
      email_delivered: "Email delivered",
      email_opened: "Email opened",
      email_clicked: "Email clicked",
      email_bounced: "Email bounced",
      notification: "In-app notification",
      proposal: "Proposal",
      scheduling: "Scheduling",
      revision: "Revision",
      payment: "Payment",
    };
    return map[type] ?? type.replace(/_/g, " ");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">
            {clientInitials(displayName)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{displayName}</h1>
            {client.company && <p className="text-muted flex items-center gap-1.5"><Building className="h-4 w-4" />{client.company}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.email}</span>
              {client.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              {client.referral_source && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1">Referral: {client.referral_source}</span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Client since {formatDate(client.created_at)}</span>
              {client.last_activity_at && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1">Last activity {formatDate(client.last_activity_at)}</span>
              )}
              {lastLogin && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1">Last login {formatDate(lastLogin)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/projects/new?client=${client.id}`}>
            <Button variant="accent" size="sm"><Plus className="h-4 w-4" />New Project</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => { setShowNoteForm(true); setEditingNote(null); setNoteText(""); }}>
            <MessageSquare className="h-4 w-4" />Add Note
          </Button>
          <Button variant="outline" size="sm" onClick={copyPortalLink}><Copy className="h-4 w-4" />Portal Link</Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}><Pencil className="h-4 w-4" />Edit</Button>
          {client.deleted_at ? (
            <Button variant="outline" size="sm" disabled={restoringClient} onClick={() => restoreClient()}>
              Restore Client
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />Hide
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Lifetime Revenue", value: formatCurrency(stats.lifetime_revenue), icon: DollarSign },
          { label: "Outstanding", value: formatCurrency(stats.outstanding_balance), icon: DollarSign, warn: stats.outstanding_balance > 0 },
          { label: "Active Projects", value: String(stats.active_project_count), icon: FolderKanban },
          { label: "Delivered", value: String(stats.delivered_project_count), icon: FolderKanban },
          { label: "Total Projects", value: String(stats.total_project_count), icon: FolderKanban },
          { label: "Avg Project Value", value: stats.average_project_value ? formatCurrency(stats.average_project_value) : "—", icon: DollarSign },
          { label: "Last Payment", value: stats.last_payment_at ? formatDate(stats.last_payment_at) : "—", icon: Clock },
          { label: "Last Contact", value: lastContact ? formatDate(lastContact) : "—", icon: Mail },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.warn ? "text-amber-700" : "text-primary"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Properties */}
      {properties.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-primary mb-3">Properties</h2>
          <div className="space-y-2">
            {properties.map((property) => (
              <div key={property.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-primary">{formatPropertyLabel(property)}</p>
                    <p className="text-sm text-muted flex items-center gap-1.5 mt-1"><MapPin className="h-3.5 w-3.5" />{property.address}</p>
                  </div>
                  <span className="text-xs rounded-full bg-slate-100 px-2.5 py-1 text-muted">{property.property_type}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  <span>{property.project_count} project{property.project_count !== 1 ? "s" : ""}</span>
                  {property.last_project_at && <span>Last project {formatDate(property.last_project_at)}</span>}
                  {property.revenue_cents > 0 && <span>{formatCurrency(property.revenue_cents)} revenue</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      <section>
        <h2 className="text-base font-semibold text-primary mb-3">Projects</h2>
        <ProjectGroup title="Active" projects={activeProjects} empty="No active projects." />
        {awaitingPayment.length > 0 && (
          <ProjectGroup title="Awaiting Payment" projects={awaitingPayment} />
        )}
        <ProjectGroup title="Delivered / Completed" projects={deliveredProjects} empty="No delivered projects yet." />
      </section>

      {/* Payments */}
      <section>
        <h2 className="text-base font-semibold text-primary mb-3">Payments</h2>
        <PaymentGroup
          title="Outstanding"
          payments={outstandingPayments}
          onPaymentUpdated={(updated) =>
            setPayments((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
          }
        />
        <PaymentGroup
          title="Paid"
          payments={paidPayments}
          onPaymentUpdated={(updated) =>
            setPayments((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
          }
        />
        {failedPayments.length > 0 && (
          <PaymentGroup
            title="Failed / Expired"
            payments={failedPayments}
            onPaymentUpdated={(updated) =>
              setPayments((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
            }
          />
        )}
        {payments.length === 0 && <p className="text-sm text-muted py-4 text-center">No payments yet.</p>}
      </section>

      {/* Notes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary">Internal Notes</h2>
          <Button variant="outline" size="sm" onClick={() => { setShowNoteForm(true); setEditingNote(null); setNoteText(""); }}>
            <Plus className="h-4 w-4" />Add
          </Button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center rounded-xl border border-dashed border-border">No notes yet. Add context before your next interaction.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <p className="text-sm text-primary whitespace-pre-wrap">{note.note}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{note.author_name || "Admin"} · {formatDate(note.created_at)}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingNote(note); setNoteText(note.note); setShowNoteForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Communications */}
      <section>
        <h2 className="text-base font-semibold text-primary mb-3">Communication History</h2>
        {communications.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center rounded-xl border border-dashed border-border">No communications logged yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-white divide-y divide-border shadow-sm">
            {communications.slice(0, 20).map((comm) => (
              <div key={comm.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-primary">{comm.title || commLabel(comm.comm_type)}</p>
                  <span className="text-xs text-muted shrink-0">{formatDate(comm.created_at)}</span>
                </div>
                {comm.message && <p className="text-muted mt-0.5 line-clamp-2">{comm.message}</p>}
                <p className="text-xs text-muted mt-1 capitalize">{commLabel(comm.comm_type)} · {comm.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-base font-semibold text-primary mb-3">Recent Activity</h2>
        {recentActivities.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No activity yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-white divide-y divide-border shadow-sm">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="px-4 py-3 text-sm">
                <p className="text-primary">{activity.description}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                  <span>{formatDate(activity.created_at)}</span>
                  {activity.project_id && (
                    <Link href={`/admin/projects/${activity.project_id}`} className="text-accent hover:underline">
                      View project <ExternalLink className="inline h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit client modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Client"
        footer={
          <Button variant="accent" className="w-full min-h-11" disabled={savingClient} onClick={() => saveClient()}>
            {savingClient ? "Saving..." : "Save Changes"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Company</Label>
            <Input value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} />
          </div>
          <div>
            <Label>Referral Source</Label>
            <Select
              value={editForm.referral_source}
              onChange={(e) => setEditForm((f) => ({ ...f, referral_source: e.target.value }))}
              options={[
                { value: "", label: "Not set" },
                ...REFERRAL_SOURCES.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showNoteForm}
        onClose={() => { setShowNoteForm(false); setEditingNote(null); setNoteText(""); }}
        title={editingNote ? "Edit Note" : "Add Note"}
        footer={
          <Button
            variant="accent"
            className="w-full min-h-11"
            disabled={savingNote || !noteText.trim()}
            onClick={() => saveNote()}
          >
            {savingNote ? "Saving..." : editingNote ? "Update Note" : "Add Note"}
          </Button>
        }
      >
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Internal note — not visible to client..."
          rows={4}
        />
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Hide this client?"
        footer={
          <Button variant="accent" className="w-full min-h-11 bg-red-600 hover:bg-red-700" disabled={hidingClient} onClick={() => hideClient()}>
            {hidingClient ? "Hiding..." : "Hide from dashboard"}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          This will hide <strong>{displayName}</strong> and their projects from your admin dashboard and lists.
          Nothing is permanently erased — payment history, media, and notes remain in the database and can be restored later from Hidden Clients.
        </p>
      </Modal>
    </div>
  );
}

function ProjectGroup({
  title,
  projects,
  empty,
}: {
  title: string;
  projects: ClientCrmProfile["projects"];
  empty?: string;
}) {
  if (!projects.length) {
    if (!empty) return null;
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
        <p className="text-sm text-muted py-3 text-center rounded-lg border border-dashed border-border">{empty}</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-muted mb-2">{title} ({projects.length})</h3>
      <div className="space-y-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/admin/projects/${project.id}`}>
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm hover:bg-slate-50/80 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-primary">{project.project_name}</p>
                  <p className="text-sm text-muted">{project.property_address}</p>
                  <p className="text-xs text-muted mt-0.5">{project.service_type}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {project.shoot_date && <span>Shoot {formatDate(project.shoot_date)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PaymentGroup({
  title,
  payments,
  onPaymentUpdated,
}: {
  title: string;
  payments: ClientCrmProfile["payments"];
  onPaymentUpdated?: (payment: Payment) => void;
}) {
  if (!payments.length) return null;
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-muted mb-2">{title} ({payments.length})</h3>
      <div className="rounded-xl border border-border bg-white divide-y divide-border shadow-sm">
        {payments.map((payment) => (
          <div key={payment.id} className="px-4 py-3">
            <AdminPaymentActions
              payment={payment}
              onUpdated={onPaymentUpdated}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
