"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatFileSize } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DOCUMENT_ACCEPT,
  validateDefaultDocument,
  type DefaultProjectDocument,
} from "@/lib/default-project-documents-shared";

const API = "/api/admin/settings/default-documents";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return (data?.error as string) || fallback;
  } catch {
    return fallback;
  }
}

/** sign → PUT to storage → save row. Throws with a user-facing message. */
async function uploadDefaultDocument(file: File, replaceId?: string): Promise<DefaultProjectDocument> {
  const check = validateDefaultDocument({ fileName: file.name, mimeType: file.type, fileSize: file.size });
  if (!check.ok) throw new Error(check.error);

  const signRes = await fetch(`${API}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
  });
  if (!signRes.ok) throw new Error(await readError(signRes, `Couldn't upload ${file.name}`));
  const { signedUrl, filePath, mimeType } = (await signRes.json()) as {
    signedUrl: string;
    filePath: string;
    mimeType: string;
  };

  const put = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
  if (!put.ok) throw new Error(`Storage rejected ${file.name} (HTTP ${put.status})`);

  const saveRes = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ filePath, fileName: file.name, mimeType, fileSize: file.size, replaceId }),
  });
  if (!saveRes.ok) throw new Error(await readError(saveRes, `Couldn't save ${file.name}`));
  const { document } = (await saveRes.json()) as { document: DefaultProjectDocument };
  return document;
}

function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-100 hover:text-foreground surface-dark:hover:bg-subtle disabled:opacity-50",
        destructive && "hover:bg-red-50 hover:text-red-600"
      )}
    >
      {children}
    </button>
  );
}

export function DefaultDocumentsSettingsCard() {
  const [documents, setDocuments] = useState<DefaultProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<DefaultProjectDocument | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<DefaultProjectDocument | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't load default documents"));
      const data = (await res.json()) as { documents: DefaultProjectDocument[]; migrationRequired?: boolean };
      setDocuments(data.documents ?? []);
      setMigrationRequired(Boolean(data.migrationRequired));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load default documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    for (const file of files) {
      setUploading((prev) => [...prev, file.name]);
      try {
        const doc = await uploadDefaultDocument(file);
        setDocuments((prev) => [...prev, doc]);
        toast.success(`${file.name} added to default documents`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Couldn't upload ${file.name}`);
      } finally {
        setUploading((prev) => {
          const i = prev.indexOf(file.name);
          return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
        });
      }
    }
  }

  async function replaceFile(target: DefaultProjectDocument, file: File) {
    setBusyId(target.id);
    try {
      const doc = await uploadDefaultDocument(file, target.id);
      setDocuments((prev) => prev.map((d) => (d.id === target.id ? doc : d)));
      toast.success(`${target.file_name} replaced with ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't replace document");
    } finally {
      setBusyId(null);
    }
  }

  async function openDocument(doc: DefaultProjectDocument, download: boolean) {
    // Open synchronously so pop-up blockers allow it, then point it at the signed URL.
    const win = download ? null : window.open("", "_blank");
    try {
      const res = await fetch(`${API}/${doc.id}${download ? "?download=1" : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't open document"));
      const { url } = (await res.json()) as { url: string };
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      win?.close();
      toast.error(err instanceof Error ? err.message : "Couldn't open document");
    }
  }

  async function removeDocument(doc: DefaultProjectDocument) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`${API}/${doc.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't remove document"));
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`${doc.file_name} removed from default documents`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove document");
    } finally {
      setBusyId(null);
      setConfirmRemove(null);
    }
  }

  const disabled = migrationRequired;

  return (
    <Card className="shadow-sm" id="settings-default-documents">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Default documents</CardTitle>
        <p className="text-sm text-muted">
          Added to the Documents section of every new project — each project gets its own copy. Existing
          projects aren&apos;t changed. Clients see them when the project&apos;s Documents section is visible.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {migrationRequired && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Default documents need database migration v114 before they can be uploaded.
          </p>
        )}

        <label
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-slate-50 surface-dark:hover:bg-subtle",
            dragOver && "border-accent bg-accent-subtle",
            disabled && "pointer-events-none opacity-60"
          )}
        >
          <Upload className="h-5 w-5 text-muted" />
          <span className="text-sm font-medium text-foreground">Drop files here or click to upload</span>
          <span className="text-xs text-muted">PDF, Word (.doc, .docx) or ZIP · up to 25 MB each</span>
          <input
            ref={uploadInput}
            type="file"
            multiple
            accept={DEFAULT_DOCUMENT_ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addFiles(files);
            }}
          />
        </label>

        <input
          ref={replaceInput}
          type="file"
          accept={DEFAULT_DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            const target = replaceTarget.current;
            replaceTarget.current = null;
            if (file && target) void replaceFile(target, file);
          }}
        />

        {loading ? (
          <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : documents.length === 0 && uploading.length === 0 ? (
          <p className="px-1 text-sm text-muted">No default documents yet.</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
                  <p className="text-xs text-muted">
                    {doc.file_size ? formatFileSize(doc.file_size) : "—"} · Updated{" "}
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {busyId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                ) : (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label={`View ${doc.file_name}`} onClick={() => void openDocument(doc, false)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Download ${doc.file_name}`} onClick={() => void openDocument(doc, true)}>
                      <Download className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={`Replace ${doc.file_name}`}
                      onClick={() => {
                        replaceTarget.current = doc;
                        replaceInput.current?.click();
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Remove ${doc.file_name}`} destructive onClick={() => setConfirmRemove(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            ))}
            {uploading.map((name, i) => (
              <div key={`uploading-${i}-${name}`} className="flex items-center gap-3 px-4 py-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted" />
                <p className="min-w-0 flex-1 truncate text-sm text-muted">Uploading {name}…</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && void removeDocument(confirmRemove)}
        title="Remove default document?"
        confirmLabel="Remove"
        destructive
        busy={busyId !== null}
      >
        <p className="text-sm text-muted">
          {confirmRemove?.file_name} won&apos;t be added to new projects. Projects that already have a copy keep it.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
