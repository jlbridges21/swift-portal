"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { W9_LINK_TTL_DAYS, type TaxInformationSettings } from "@/lib/w9-fields";
import type { W9SendEvent } from "@/lib/w9-send";

export type W9ClientOption = { id: string; name: string; email: string };

const CLASSIFICATIONS: { value: TaxInformationSettings["federalTaxClassification"]; label: string }[] = [
  { value: "", label: "Choose a classification" },
  { value: "individual", label: "Individual / sole proprietor" },
  { value: "c_corp", label: "C corporation" },
  { value: "s_corp", label: "S corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust / estate" },
  { value: "llc", label: "LLC" },
  { value: "other", label: "Other" },
];

type SignatureMode = "typed" | "blank";

function linkStatus(row: W9SendEvent): string {
  if (row.revoked_at) return "Revoked";
  if (row.downloaded_at) return "Downloaded";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "Expired";
  return "Link active";
}

export function TaxInformationSettings({
  tax,
  onChange,
  clients,
}: {
  tax: TaxInformationSettings;
  onChange: (patch: Partial<TaxInformationSettings>) => void;
  clients: W9ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [tinKind, setTinKind] = useState<"ssn" | "ein">("ssn");
  const [tin, setTin] = useState("");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("typed");
  const [attestation, setAttestation] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState<"download" | "send" | null>(null);
  const [history, setHistory] = useState<W9SendEvent[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/admin/w9", { credentials: "include" });
    const data = (await res.json().catch(() => null)) as { sends?: W9SendEvent[]; error?: string } | null;
    if (!res.ok) {
      setHistoryError(data?.error || "Could not load W-9 history.");
      return;
    }
    setHistoryError(null);
    setHistory(data?.sends ?? []);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function closeModal() {
    setOpen(false);
    setTin("");
    setAttestation(false);
  }

  function generationBody() {
    return {
      tinKind,
      tin,
      signatureMode,
      attestation,
      typedName,
    };
  }

  async function downloadPdf() {
    setBusy("download");
    try {
      const res = await fetch("/api/admin/w9/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(generationBody()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not generate the form.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "w-9.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
      closeModal();
      toast.success("W-9 downloaded. Nothing was saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the form.");
    } finally {
      setBusy(null);
      setTin("");
    }
  }

  async function sendLink() {
    if (!clientId) {
      toast.error("Choose a client.");
      return;
    }
    setBusy("send");
    try {
      const res = await fetch("/api/admin/w9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...generationBody(), clientId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; recipientEmail?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not send the form.");
      closeModal();
      toast.success(`Link emailed to ${data?.recipientEmail ?? "the client"}. The PDF was not attached.`);
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the form.");
    } finally {
      setBusy(null);
      setTin("");
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/w9/${id}/revoke`, { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not revoke the link.");
      toast.success("Link revoked.");
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke the link.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div id="settings-tax" tabIndex={-1} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Tax information</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These are the identity lines on IRS Form W-9. Your SSN or EIN is not saved. You type it each
            time you generate the form, and it is used only to fill the PDF.
          </p>
        </div>
        <Button type="button" variant="accent" onClick={() => setOpen(true)}>
          Generate W-9
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="w9-name">Line 1 — Name</Label>
            <Input
              id="w9-name"
              value={tax.name}
              onChange={(e) => onChange({ name: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="w9-entity">Line 2 — Business name / disregarded entity name</Label>
            <Input
              id="w9-entity"
              value={tax.disregardedEntityName}
              onChange={(e) => onChange({ disregardedEntityName: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w9-class">Line 3a — Federal tax classification</Label>
            <select
              id="w9-class"
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={tax.federalTaxClassification}
              onChange={(e) =>
                onChange({
                  federalTaxClassification: e.target.value as TaxInformationSettings["federalTaxClassification"],
                })
              }
            >
              {CLASSIFICATIONS.map((option) => (
                <option key={option.value || "empty"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {tax.federalTaxClassification === "llc" ? (
            <div className="space-y-2">
              <Label htmlFor="w9-llc">LLC tax classification letter</Label>
              <select
                id="w9-llc"
                className="flex h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={tax.llcTaxClassification}
                onChange={(e) =>
                  onChange({ llcTaxClassification: e.target.value as TaxInformationSettings["llcTaxClassification"] })
                }
              >
                <option value="">C, S, or P</option>
                <option value="C">C</option>
                <option value="S">S</option>
                <option value="P">P</option>
              </select>
            </div>
          ) : null}
          {tax.federalTaxClassification === "other" ? (
            <div className="space-y-2">
              <Label htmlFor="w9-other">Other classification</Label>
              <Input
                id="w9-other"
                value={tax.otherClassification}
                onChange={(e) => onChange({ otherClassification: e.target.value })}
                autoComplete="off"
              />
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={tax.foreignPartners}
              onChange={(e) => onChange({ foreignPartners: e.target.checked })}
            />
            <span>Line 3b — foreign partners, owners, or beneficiaries</span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="w9-exempt">Line 4 — Exempt payee code</Label>
            <Input
              id="w9-exempt"
              value={tax.exemptPayeeCode}
              onChange={(e) => onChange({ exemptPayeeCode: e.target.value })}
              placeholder="1–13, or blank"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w9-fatca">Line 5 — FATCA exemption code</Label>
            <Input
              id="w9-fatca"
              value={tax.fatcaExemptionCode}
              onChange={(e) => onChange({ fatcaExemptionCode: e.target.value })}
              placeholder="A–M, or blank"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="w9-address">Line 6 — Address</Label>
            <Input
              id="w9-address"
              value={tax.address}
              onChange={(e) => onChange({ address: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="w9-city">Line 7 — City, state, and ZIP</Label>
            <Input
              id="w9-city"
              value={tax.cityStateZip}
              onChange={(e) => onChange({ cityStateZip: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="w9-accounts">Account numbers (optional)</Label>
            <Input
              id="w9-accounts"
              value={tax.accountNumbers}
              onChange={(e) => onChange({ accountNumbers: e.target.value })}
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <h3 className="text-sm font-semibold text-primary">W-9 history</h3>
          <p className="text-sm text-muted">
            Who was emailed a link, whether they downloaded it, and whether the link has expired. The form
            itself is not kept here.
          </p>
          {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
          {history.length === 0 ? <p className="text-sm text-muted">No W-9 links sent yet.</p> : null}
          <ul className="space-y-3">
            {history.map((row) => {
              const status = linkStatus(row);
              const canRevoke = status === "Link active";
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm">
                  <div>
                    <p className="font-medium text-primary">
                      {row.client_name || "Client"} · {row.recipient_email}
                    </p>
                    <p className="text-muted">
                      Sent {new Date(row.created_at).toLocaleString()} · Expires{" "}
                      {new Date(row.expires_at).toLocaleString()} · {status}
                    </p>
                  </div>
                  {canRevoke ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revoking === row.id}
                      onClick={() => revoke(row.id)}
                    >
                      {revoking === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke link"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-primary">Generate W-9</h3>
            <p className="mt-2 text-sm text-muted">
              The taxpayer identification number is not saved. It is held only long enough to fill this PDF.
            </p>
            <div className="mt-4 space-y-4">
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="tin-kind" checked={tinKind === "ssn"} onChange={() => setTinKind("ssn")} />
                  SSN
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="tin-kind" checked={tinKind === "ein"} onChange={() => setTinKind("ein")} />
                  EIN
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w9-tin">Taxpayer identification number</Label>
                <Input
                  id="w9-tin"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="w9-signature"
                    checked={signatureMode === "typed"}
                    onChange={() => setSignatureMode("typed")}
                  />
                  <span>
                    Place a typed name and today&apos;s date on the signature line. This records that you
                    confirmed the certification printed in Part II. It is not a representation about how a
                    particular client will treat that signature.
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="w9-signature"
                    checked={signatureMode === "blank"}
                    onChange={() => setSignatureMode("blank")}
                  />
                  <span>Leave the signature line blank so it can be signed by hand.</span>
                </label>
              </div>
              {signatureMode === "typed" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="w9-typed-name">Name on the signature line</Label>
                    <Input
                      id="w9-typed-name"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={attestation}
                      onChange={(e) => setAttestation(e.target.checked)}
                    />
                    <span>I confirm the certification in Part II of Form W-9.</span>
                  </label>
                </>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="w9-client">Email a one-time link to a client</Label>
                <select
                  id="w9-client"
                  className="flex h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Choose a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id} disabled={!client.email}>
                      {client.name}
                      {client.email ? ` · ${client.email}` : " · no email"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  The email contains a link, not the PDF. The link works once, expires in {W9_LINK_TTL_DAYS}{" "}
                  days, and does not require a portal sign-in. Anyone who has the link can download the file.
                  Sending again asks for the taxpayer identification number again.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeModal} disabled={busy !== null}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={downloadPdf} disabled={busy !== null}>
                {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Download"}
              </Button>
              <Button type="button" variant="accent" onClick={sendLink} disabled={busy !== null}>
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email link"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
