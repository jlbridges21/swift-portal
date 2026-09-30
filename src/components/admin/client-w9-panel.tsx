"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { W9GenerateDialog, type W9ClientOption } from "@/components/admin/w9-generate-dialog";
import { W9HistoryList } from "@/components/admin/w9-history-list";
import type { W9SendEvent } from "@/lib/w9-send";

export function ClientW9Panel({
  client,
  taxReady,
}: {
  client: W9ClientOption;
  taxReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"typed" | "blank">("typed");
  const [typedName, setTypedName] = useState("");
  const [history, setHistory] = useState<W9SendEvent[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/admin/w9?clientId=${encodeURIComponent(client.id)}`, { credentials: "include" });
    const data = (await res.json().catch(() => null)) as { sends?: W9SendEvent[]; error?: string } | null;
    if (!res.ok) {
      setHistoryError(data?.error || "Could not load W-9 history.");
      return;
    }
    setHistoryError(null);
    setHistory(data?.sends ?? []);
  }, [client.id]);

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

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm" data-w9-client-panel="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-primary">Form W-9</h2>
          <p className="mt-1 text-sm text-muted">
            Send this client a one-time download link. The taxpayer identification number is typed when you send it
            and is not saved.
          </p>
        </div>
        {taxReady ? (
          <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)} data-w9-send="">
            Send W-9
          </Button>
        ) : null}
      </div>
      {taxReady ? null : (
        <p className="mt-3 text-sm text-primary" data-w9-tax-prompt="">
          Add your tax information before sending a W-9.{" "}
          <Link href="/admin/settings#settings-tax" className="font-medium text-accent underline">
            Open tax information
          </Link>
        </p>
      )}
      <div className="mt-4">
        <W9HistoryList
          rows={history}
          error={historyError}
          revoking={revoking}
          onRevoke={(id) => void revoke(id)}
          empty="No W-9 links sent to this client yet."
          showClient={false}
        />
      </div>
      {taxReady ? (
        <W9GenerateDialog
          open={open}
          onClose={() => setOpen(false)}
          clients={[]}
          lockedClient={client}
          showDownload={false}
          signatureMode={signatureMode}
          setSignatureMode={setSignatureMode}
          typedName={typedName}
          setTypedName={setTypedName}
          onSent={() => void loadHistory()}
        />
      ) : null}
    </section>
  );
}
