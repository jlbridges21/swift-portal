"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { suggestReferralCodeFromBrand } from "@/lib/reserved-subdomains";
import type { PartnerApplicationRow, PartnerRow } from "@/lib/partners";

type Props = {
  initialApplications: PartnerApplicationRow[];
  initialPartners: PartnerRow[];
  /** Program default commission % — never hardcode in form defaults. */
  defaultCommissionRatePct: number;
};

export function PartnersManager({
  initialApplications,
  initialPartners,
  defaultCommissionRatePct,
}: Props) {
  const router = useRouter();
  const defaultRate = String(defaultCommissionRatePct);
  const [tab, setTab] = useState<"applications" | "partners">("applications");
  const [appStatus, setAppStatus] = useState("pending");
  const [partnerStatus, setPartnerStatus] = useState("all");
  const [applications, setApplications] = useState(initialApplications);
  const [partners, setPartners] = useState(initialPartners);
  const [busy, setBusy] = useState<string | null>(null);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveCode, setApproveCode] = useState("");
  const [approveRate, setApproveRate] = useState(defaultRate);
  const [approveNote, setApproveNote] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    brandName: "",
    website: "",
    referralCode: "",
    commissionRatePct: defaultRate,
    notes: "",
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    brandName: "",
    website: "",
    referralCode: "",
    commissionRatePct: defaultRate,
    status: "active",
    notes: "",
    useProgramDiscount: true,
    referralDiscountEnabled: true,
    referralDiscountAmountDollars: "5",
    referralDiscountDurationMonths: "3",
  });

  const filteredApps = useMemo(
    () =>
      appStatus === "all"
        ? applications
        : applications.filter((a) => a.status === appStatus),
    [applications, appStatus]
  );

  const filteredPartners = useMemo(
    () =>
      partnerStatus === "all"
        ? partners
        : partners.filter((p) => p.status === partnerStatus),
    [partners, partnerStatus]
  );

  function refresh() {
    router.refresh();
  }

  async function declineApp(id: string) {
    const note = window.prompt("Optional decline note:") ?? "";
    setBusy(id);
    try {
      const res = await fetch(`/api/platform/partners/applications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", reviewNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decline failed");
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? (data.application as PartnerApplicationRow) : a))
      );
      toast.success("Application declined");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Decline failed");
    } finally {
      setBusy(null);
    }
  }

  function startApprove(app: PartnerApplicationRow) {
    setApproveId(app.id);
    setApproveCode(suggestReferralCodeFromBrand(app.brand_name));
    setApproveRate(defaultRate);
    setApproveNote("");
  }

  async function confirmApprove() {
    if (!approveId) return;
    setBusy(approveId);
    try {
      const res = await fetch(`/api/platform/partners/applications/${approveId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          referralCode: approveCode,
          commissionRatePct: Number(approveRate),
          reviewNote: approveNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setApplications((prev) =>
        prev.map((a) =>
          a.id === approveId ? { ...a, status: "approved" as const } : a
        )
      );
      if (data.partner) setPartners((prev) => [data.partner as PartnerRow, ...prev]);
      toast.success(
        data.linkedExistingUser
          ? "Partner approved and linked to existing account (no invite)"
          : data.inviteSent
            ? "Partner approved and invite sent"
            : `Partner approved${data.inviteError ? ` (invite: ${data.inviteError})` : ""}`
      );
      if (data.inviteUrl) {
        console.info("[partner-invite] confirm URL (redact token in logs):", String(data.inviteUrl).replace(/token_hash=[^&]+/, "token_hash=REDACTED"));
      }
      setApproveId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  }

  async function createPartner() {
    setBusy("create");
    try {
      const res = await fetch("/api/platform/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          brandName: createForm.brandName,
          website: createForm.website || null,
          referralCode: createForm.referralCode,
          commissionRatePct: Number(createForm.commissionRatePct),
          notes: createForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setPartners((prev) => [data.partner as PartnerRow, ...prev]);
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        brandName: "",
        website: "",
        referralCode: "",
        commissionRatePct: defaultRate,
        notes: "",
      });
      toast.success(
        data.linkedExistingUser
          ? "Partner linked to existing account (no invite)"
          : data.inviteSent
            ? "Partner created and invited"
            : "Partner created"
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(p: PartnerRow) {
    const hasOverride =
      p.referral_discount_enabled != null ||
      p.referral_discount_amount_cents != null ||
      p.referral_discount_duration_months != null;
    setEditId(p.id);
    setEditForm({
      name: p.name,
      email: p.email,
      brandName: p.brand_name,
      website: p.website ?? "",
      referralCode: p.referral_code,
      commissionRatePct: String(p.commission_rate_pct),
      status: p.status,
      notes: p.notes ?? "",
      useProgramDiscount: !hasOverride,
      referralDiscountEnabled: p.referral_discount_enabled ?? true,
      referralDiscountAmountDollars: String(
        (p.referral_discount_amount_cents ?? 500) / 100
      ),
      referralDiscountDurationMonths: String(p.referral_discount_duration_months ?? 3),
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(editId);
    try {
      const res = await fetch(`/api/platform/partners/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          brandName: editForm.brandName,
          website: editForm.website || null,
          referralCode: editForm.referralCode,
          commissionRatePct: Number(editForm.commissionRatePct),
          status: editForm.status,
          notes: editForm.notes || null,
          clearReferralDiscountOverride: editForm.useProgramDiscount,
          ...(editForm.useProgramDiscount
            ? {}
            : {
                referralDiscountEnabled: editForm.referralDiscountEnabled,
                referralDiscountAmountCents: Math.round(
                  Number(editForm.referralDiscountAmountDollars) * 100
                ),
                referralDiscountDurationMonths: Math.round(
                  Number(editForm.referralDiscountDurationMonths)
                ),
              }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setPartners((prev) => prev.map((p) => (p.id === editId ? (data.partner as PartnerRow) : p)));
      setEditId(null);
      if (data.partner?.referralDiscountCouponSyncOk === false) {
        toast.error(
          data.partner.referralDiscountCouponSyncMessage ??
            "Partner saved but Stripe coupon sync failed — discount will not apply until fixed."
        );
      } else {
        toast.success("Partner updated");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "applications" ? "accent" : "outline"}
          onClick={() => setTab("applications")}
        >
          Applications
        </Button>
        <Button
          type="button"
          variant={tab === "partners" ? "accent" : "outline"}
          onClick={() => setTab("partners")}
        >
          Partners
        </Button>
        <Button type="button" variant="outline" className="ml-auto" onClick={() => setCreateOpen(true)}>
          Create partner
        </Button>
      </div>

      {tab === "applications" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">Applications</CardTitle>
            <Select
              value={appStatus}
              onChange={(e) => setAppStatus(e.target.value)}
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "declined", label: "Declined" },
                { value: "withdrawn", label: "Withdrawn" },
                { value: "all", label: "All" },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredApps.length === 0 ? (
              <p className="text-sm text-muted">No applications in this filter.</p>
            ) : (
              filteredApps.map((app) => (
                <div key={app.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-heading">{app.brand_name}</p>
                      <p className="text-sm text-muted">
                        {app.name} · {app.email}
                      </p>
                      {app.website ? (
                        <p className="text-sm text-muted">{app.website}</p>
                      ) : null}
                      {app.audience_size ? (
                        <p className="mt-1 text-sm text-muted">Audience: {app.audience_size}</p>
                      ) : null}
                      {app.promotion_plan ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-heading">{app.promotion_plan}</p>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                        {app.status} · {new Date(app.created_at).toLocaleString()}
                      </p>
                    </div>
                    {app.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          disabled={busy === app.id}
                          onClick={() => startApprove(app)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === app.id}
                          onClick={() => void declineApp(app.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {approveId === app.id ? (
                    <div className="mt-4 space-y-3 rounded-md border border-border bg-subtle/40 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Referral code</Label>
                          <Input
                            value={approveCode}
                            onChange={(e) => setApproveCode(e.target.value)}
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Commission rate %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={approveRate}
                            onChange={(e) => setApproveRate(e.target.value)}
                            className="min-h-11"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Review note (optional)</Label>
                        <Textarea
                          value={approveNote}
                          onChange={(e) => setApproveNote(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="accent"
                          disabled={busy === app.id}
                          onClick={() => void confirmApprove()}
                        >
                          Confirm approve + invite
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setApproveId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">Partners</CardTitle>
            <Select
              value={partnerStatus}
              onChange={(e) => setPartnerStatus(e.target.value)}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredPartners.length === 0 ? (
              <p className="text-sm text-muted">No partners in this filter.</p>
            ) : (
              filteredPartners.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-heading">{p.brand_name}</p>
                      <p className="text-sm text-muted">
                        {p.name} · {p.email}
                      </p>
                      <p className="mt-1 text-sm text-heading">
                        Code <span className="font-mono">{p.referral_code}</span> ·{" "}
                        {p.commission_rate_pct}% · {p.status}
                        {" · "}
                        {p.referred_business_count ?? 0} referred{" "}
                        {(p.referred_business_count ?? 0) === 1 ? "business" : "businesses"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/platform/partners/${p.id}`}>
                        <Button type="button" size="sm" variant="accent" className="min-h-11">
                          Detail
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {editId === p.id ? (
                    <div className="mt-4 space-y-3 rounded-md border border-border bg-subtle/40 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Email</Label>
                          <Input
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Brand name</Label>
                          <Input
                            value={editForm.brandName}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, brandName: e.target.value }))
                            }
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Website</Label>
                          <Input
                            value={editForm.website}
                            onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Referral code</Label>
                          <Input
                            value={editForm.referralCode}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, referralCode: e.target.value }))
                            }
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Commission rate %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={editForm.commissionRatePct}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, commissionRatePct: e.target.value }))
                            }
                            className="min-h-11"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={editForm.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                            options={[
                              { value: "active", label: "Active" },
                              { value: "suspended", label: "Suspended" },
                            ]}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Notes</Label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-3 rounded-md border border-border p-3">
                        <p className="text-sm font-medium text-heading">Referral signup discount</p>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.useProgramDiscount}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, useProgramDiscount: e.target.checked }))
                            }
                          />
                          Use program default discount
                        </label>
                        {!editForm.useProgramDiscount ? (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="flex items-center gap-2 text-sm sm:col-span-3">
                              <input
                                type="checkbox"
                                checked={editForm.referralDiscountEnabled}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    referralDiscountEnabled: e.target.checked,
                                  }))
                                }
                              />
                              Discount enabled for this partner
                            </label>
                            <div className="space-y-1">
                              <Label>Amount (USD/mo)</Label>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={editForm.referralDiscountAmountDollars}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    referralDiscountAmountDollars: e.target.value,
                                  }))
                                }
                                className="min-h-11"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Duration (paid months)</Label>
                              <Input
                                type="number"
                                min={1}
                                max={36}
                                value={editForm.referralDiscountDurationMonths}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    referralDiscountDurationMonths: e.target.value,
                                  }))
                                }
                                className="min-h-11"
                              />
                            </div>
                          </div>
                        ) : null}
                        <p className="text-xs text-muted">
                          Saving creates or reuses a Stripe coupon for this exact configuration.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="accent"
                          disabled={busy === p.id}
                          onClick={() => void saveEdit()}
                        >
                          Save
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setEditId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {createOpen ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create partner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Brand name</Label>
                <Input
                  value={createForm.brandName}
                  onChange={(e) => {
                    const brandName = e.target.value;
                    setCreateForm((f) => ({
                      ...f,
                      brandName,
                      referralCode: f.referralCode || suggestReferralCodeFromBrand(brandName),
                    }));
                  }}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Website</Label>
                <Input
                  value={createForm.website}
                  onChange={(e) => setCreateForm((f) => ({ ...f, website: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Referral code</Label>
                <Input
                  value={createForm.referralCode}
                  onChange={(e) => setCreateForm((f) => ({ ...f, referralCode: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Commission rate %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={createForm.commissionRatePct}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, commissionRatePct: e.target.value }))
                  }
                  className="min-h-11"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="accent"
                disabled={busy === "create"}
                onClick={() => void createPartner()}
              >
                Create + invite
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
