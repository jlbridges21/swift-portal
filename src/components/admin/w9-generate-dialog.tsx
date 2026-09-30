"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { W9_LINK_TTL_DAYS } from "@/lib/w9-fields";

export type W9ClientOption = { id: string; name: string; email: string };

type SignatureMode = "typed" | "blank";

export function W9GenerateDialog({
  open,
  onClose,
  clients,
  lockedClient,
  showDownload,
  signatureMode,
  setSignatureMode,
  typedName,
  setTypedName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  clients: W9ClientOption[];
  lockedClient: W9ClientOption | null;
  showDownload: boolean;
  signatureMode: SignatureMode;
  setSignatureMode: (mode: SignatureMode) => void;
  typedName: string;
  setTypedName: (name: string) => void;
  onSent: () => void;
}) {
  const [tinKind, setTinKind] = useState<"ssn" | "ein">("ssn");
  const [tin, setTin] = useState("");
  const [attestation, setAttestation] = useState(false);
  const [clientId, setClientId] = useState(lockedClient?.id ?? "");
  const [busy, setBusy] = useState<"download" | "send" | null>(null);

  if (!open) return null;

  function generationBody() {
    return { tinKind, tin, signatureMode, attestation, typedName };
  }

  function finish() {
    setTin("");
    setAttestation(false);
    onClose();
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
      finish();
      toast.success("W-9 downloaded. Nothing was saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the form.");
    } finally {
      setBusy(null);
      setTin("");
    }
  }

  async function sendLink() {
    const target = lockedClient?.id || clientId;
    if (!target) {
      toast.error("Choose a client.");
      return;
    }
    setBusy("send");
    try {
      const res = await fetch("/api/admin/w9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...generationBody(), clientId: target }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; recipientEmail?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not send the form.");
      finish();
      toast.success(`Link emailed to ${data?.recipientEmail ?? "the client"}. The PDF was not attached.`);
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the form.");
    } finally {
      setBusy(null);
      setTin("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90dvh] w-full min-w-0 max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-primary">
          {lockedClient ? `Send W-9 to ${lockedClient.name}` : "Generate W-9"}
        </h3>
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
          <SignatureChoice
            radioName="w9-signature-dialog"
            signatureMode={signatureMode}
            setSignatureMode={setSignatureMode}
            typedName={typedName}
            setTypedName={setTypedName}
            attestation={attestation}
            setAttestation={setAttestation}
          />
          {lockedClient ? (
            <p className="text-sm text-muted">
              This link goes to {lockedClient.email || "this client"}. The email contains a link, not the PDF. The
              link works once, expires in {W9_LINK_TTL_DAYS} days, and does not require a portal sign-in. Anyone who
              has the link can download the file.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="w9-client">Email a one-time link to a client</Label>
              <select
                id="w9-client"
                className="flex h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm"
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
                The email contains a link, not the PDF. The link works once, expires in {W9_LINK_TTL_DAYS} days, and
                does not require a portal sign-in. Anyone who has the link can download the file. Sending again asks
                for the taxpayer identification number again.
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={finish} disabled={busy !== null}>
            Cancel
          </Button>
          {showDownload ? (
            <Button type="button" variant="outline" onClick={downloadPdf} disabled={busy !== null}>
              {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Download"}
            </Button>
          ) : null}
          <Button type="button" variant="accent" onClick={sendLink} disabled={busy !== null || Boolean(lockedClient && !lockedClient.email)}>
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : lockedClient ? "Send W-9" : "Email link"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SignatureChoice({
  radioName,
  signatureMode,
  setSignatureMode,
  typedName,
  setTypedName,
  attestation,
  setAttestation,
  showAttestation = true,
  nameInputId = "w9-typed-name",
}: {
  radioName: string;
  signatureMode: SignatureMode;
  setSignatureMode: (mode: SignatureMode) => void;
  typedName: string;
  setTypedName: (name: string) => void;
  attestation: boolean;
  setAttestation: (value: boolean) => void;
  showAttestation?: boolean;
  nameInputId?: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="radio"
          name={radioName}
          checked={signatureMode === "typed"}
          onChange={() => setSignatureMode("typed")}
        />
        <span>
          Place a typed name and today&apos;s date on the signature line. This records that you confirmed the
          certification printed in Part II. It is not a representation about how a particular client will treat that
          signature.
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input
          type="radio"
          name={radioName}
          checked={signatureMode === "blank"}
          onChange={() => setSignatureMode("blank")}
        />
        <span>Leave the signature line blank so it can be signed by hand.</span>
      </label>
      {signatureMode === "typed" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={nameInputId}>Name on the signature line</Label>
            <Input
              id={nameInputId}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="name"
            />
          </div>
          {showAttestation ? (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={attestation}
                onChange={(e) => setAttestation(e.target.checked)}
              />
              <span>I confirm the certification in Part II of Form W-9.</span>
            </label>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
