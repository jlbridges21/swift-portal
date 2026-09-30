"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TaxInformationSettings } from "@/lib/w9-fields";
import type { W9SendEvent } from "@/lib/w9-send";
import { W9HistoryList } from "@/components/admin/w9-history-list";
import { SignatureChoice, W9GenerateDialog, type W9ClientOption } from "@/components/admin/w9-generate-dialog";
import { W9PdfPreview } from "@/components/admin/w9-pdf-preview";

export type { W9ClientOption };

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

export function TaxInformationSettings({
  tax,
  onChange,
  clients,
  nav,
  footer,
}: {
  tax: TaxInformationSettings;
  onChange: (patch: Partial<TaxInformationSettings>) => void;
  clients: W9ClientOption[];
  nav: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("typed");
  const [typedName, setTypedName] = useState("");
  const [pane, setPane] = useState<"form" | "preview">("form");
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

  const form = (
    <div id="settings-tax" tabIndex={-1} className="min-w-0 scroll-mt-24 space-y-4 [&_input]:min-w-0 [&_select]:min-w-0">
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
          <W9HistoryList
            rows={history}
            error={historyError}
            revoking={revoking}
            onRevoke={(id) => void revoke(id)}
            empty="No W-9 links sent yet."
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <h3 className="text-sm font-semibold text-primary">Signature on the preview</h3>
          <p className="text-sm text-muted">
            A typed name and today&apos;s date appear on the preview. Generating the form still asks you to confirm
            Part II, and still asks for the taxpayer identification number, which is not shown here.
          </p>
          <SignatureChoice
            radioName="w9-signature-form"
            signatureMode={signatureMode}
            setSignatureMode={setSignatureMode}
            typedName={typedName}
            setTypedName={setTypedName}
            attestation={false}
            setAttestation={() => undefined}
            showAttestation={false}
            nameInputId="w9-preview-typed-name"
          />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <TaxEditorShell
      nav={nav}
      form={form}
      preview={<W9PdfPreview tax={tax} signatureMode={signatureMode} typedName={typedName} />}
      footer={footer}
      pane={pane}
      onPane={setPane}
      dialog={
        <W9GenerateDialog
          open={open}
          onClose={() => setOpen(false)}
          clients={clients}
          lockedClient={null}
          showDownload
          signatureMode={signatureMode}
          setSignatureMode={setSignatureMode}
          typedName={typedName}
          setTypedName={setTypedName}
          onSent={() => void loadHistory()}
        />
      }
    />
  );
}

function TaxEditorShell({
  nav,
  form,
  preview,
  footer,
  pane,
  onPane,
  dialog,
}: {
  nav: ReactNode;
  form: ReactNode;
  preview: ReactNode;
  footer?: ReactNode;
  pane: "form" | "preview";
  onPane: (pane: "form" | "preview") => void;
  dialog: ReactNode;
}) {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="flex min-w-0 flex-col lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16 lg:z-40 lg:flex-row lg:overflow-hidden lg:bg-background"
      data-w9-editor-shell=""
    >
      <aside className="min-w-0 shrink-0 lg:flex lg:w-56 lg:flex-col lg:overflow-y-scroll lg:border-r lg:border-border lg:bg-card lg:px-3 lg:py-4">
        <div className="min-w-0">{nav}</div>
      </aside>
      <div className="flex min-w-0 flex-col lg:w-[28rem] lg:shrink-0 lg:overflow-hidden lg:border-r lg:border-border">
        <div className="flex shrink-0 gap-2 border-b border-border p-3 lg:hidden">
          <Button type="button" size="sm" variant={pane === "form" ? "accent" : "outline"} onClick={() => onPane("form")}>
            Form
          </Button>
          <Button type="button" size="sm" variant={pane === "preview" ? "accent" : "outline"} onClick={() => onPane("preview")}>
            Preview
          </Button>
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 space-y-4 overflow-y-scroll px-1 py-1 lg:px-4 lg:py-4",
            pane === "preview" && "hidden lg:block"
          )}
        >
          {form}
        </div>
        {footer ? (
          <div className={cn("shrink-0 border-t border-border bg-card/95 px-3 py-3 backdrop-blur-md lg:px-4", pane === "preview" && "hidden lg:block")}>
            {footer}
          </div>
        ) : null}
      </div>
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", pane === "form" && "hidden lg:flex")}>
        {preview}
      </div>
      {dialog}
    </div>
  );
}
