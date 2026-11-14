"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IMPORT_MAX_ROWS, mapImportRows, parseCsv, type ImportPreviewRow } from "@/lib/clients-workspace";
import { cn } from "@/lib/utils";

type ServerSkip = { index: number; email: string; reason: string };
type Check = { ready: number; skipped: ServerSkip[] };

const TEMPLATE = "Name,Email,Phone,Company,Referral Source,Notes\r\nJane Smith,jane@example.com,(555) 010-2030,Example Realty,Referral,Prefers morning shoots\r\n";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Import clients from a CSV: parse in the browser, preview problems, ask the server which rows
 * are duplicates (dry run), then import the rest in one request. Nothing is emailed.
 */
export function ImportClientsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setFileName(null);
    setRows([]);
    setFatal(null);
    setCheck(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (importing) return;
    reset();
    onClose();
  }

  const valid = rows.filter((r) => !r.problem);
  const payload = valid.map((r) => r.input);

  async function serverCheck(list: typeof payload) {
    setChecking(true);
    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: list, dry_run: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { ready?: number; skipped?: ServerSkip[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Couldn’t check this file.");
      setCheck({ ready: body.ready ?? 0, skipped: body.skipped ?? [] });
    } catch (err) {
      setFatal(err instanceof Error ? err.message : "Couldn’t check this file.");
    } finally {
      setChecking(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFileName(file.name);
    if (!/\.(csv|txt)$/i.test(file.name) && file.type && !file.type.includes("csv") && !file.type.startsWith("text/")) {
      setFatal("Choose a .csv file. In Excel or Google Sheets use File → Download / Save As → CSV.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFatal("That file is larger than 2 MB. Split it into smaller files.");
      return;
    }
    const table = parseCsv(await file.text());
    const mapped = mapImportRows(table);
    if (mapped.missingColumns.length) {
      setFatal(`Missing column${mapped.missingColumns.length > 1 ? "s" : ""}: ${mapped.missingColumns.join(" and ")}. The first row must be column headings.`);
      return;
    }
    if (!mapped.rows.length) {
      setFatal("No clients found under the heading row.");
      return;
    }
    if (mapped.rows.length > IMPORT_MAX_ROWS) {
      setFatal(`This file has ${mapped.rows.length.toLocaleString()} rows. Import up to ${IMPORT_MAX_ROWS} at a time.`);
      return;
    }
    setRows(mapped.rows);
    const ok = mapped.rows.filter((r) => !r.problem).map((r) => r.input);
    if (ok.length) await serverCheck(ok);
  }

  async function runImport() {
    if (!check || check.ready === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: payload }),
      });
      const body = (await res.json().catch(() => ({}))) as { created?: number; skipped?: ServerSkip[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Import failed — nothing was added.");
      const skippedTotal = (body.skipped?.length ?? 0) + (rows.length - valid.length);
      toast.success(`Imported ${plural(body.created ?? 0, "client")}`, {
        description: skippedTotal ? `${plural(skippedTotal, "row")} skipped. Invite them from the Not Invited tab when you’re ready.` : "Invite them from the Not Invited tab when you’re ready.",
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed — nothing was added.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shootportal-clients-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const problems: { line: number; label: string; reason: string }[] = [
    ...rows.filter((r) => r.problem).map((r) => ({ line: r.line, label: r.input.email || r.input.name || "(blank)", reason: r.problem! })),
    ...(check?.skipped ?? []).map((s) => ({ line: valid[s.index]?.line ?? 0, label: s.email, reason: s.reason })),
  ].sort((a, b) => a.line - b.line);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import clients"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11 sm:min-h-10" onClick={close} disabled={importing}>
            Cancel
          </Button>
          <Button variant="accent" className="min-h-11 sm:min-h-10" disabled={!check || check.ready === 0 || checking || importing} onClick={runImport}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-hidden /> Import {check ? plural(check.ready, "client") : "clients"}
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors",
            dragOver ? "border-accent bg-accent-subtle/60" : "border-border hover:border-accent/40 hover:bg-subtle/50"
          )}
        >
          <FileSpreadsheet className="h-8 w-8 text-accent" aria-hidden />
          <span className="text-sm font-semibold text-heading">{fileName ?? "Choose a CSV file or drop it here"}</span>
          <span className="text-xs text-muted">Columns: Name, Email (required) · Phone, Company, Referral Source, Notes</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          <Download className="h-4 w-4" aria-hidden /> Download a template
        </button>

        {fatal ? (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 surface-dark:border-red-500/30 surface-dark:bg-red-500/10 surface-dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {fatal}
          </p>
        ) : null}

        {checking ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking for clients you already have…
          </p>
        ) : null}

        {rows.length && !fatal && !checking ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 surface-dark:border-emerald-500/30 surface-dark:bg-emerald-500/10">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 surface-dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {plural(check?.ready ?? 0, "client")}
                </p>
                <p className="text-xs text-emerald-700 surface-dark:text-emerald-300/80">ready to import</p>
              </div>
              <div className={cn("rounded-xl border px-3 py-2.5", problems.length ? "border-amber-200 bg-amber-50 surface-dark:border-amber-500/30 surface-dark:bg-amber-500/10" : "border-border bg-subtle/50")}>
                <p className={cn("flex items-center gap-1.5 text-sm font-semibold", problems.length ? "text-amber-800 surface-dark:text-amber-300" : "text-heading")}>
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {plural(problems.length, "row")}
                </p>
                <p className="text-xs text-muted">will be skipped</p>
              </div>
            </div>
            {problems.length ? (
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border text-xs">
                {problems.map((p, i) => (
                  <li key={`${p.line}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-heading">
                      <span className="text-muted">Row {p.line} · </span>
                      {p.label}
                    </span>
                    <span className="shrink-0 text-muted">{p.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted">No emails are sent. Imported clients start as Not Invited.</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
