"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, FileArchive, FileText, FileType, Loader2, RefreshCw, Trash2, Upload, type LucideIcon } from "lucide-react";
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

/** "PDF", "Word" or "ZIP" from the stored MIME type (falls back to the file extension). */
function docTypeLabel(doc: DefaultProjectDocument): string {
  const mime = doc.mime_type.toLowerCase();
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("zip")) return "ZIP";
  if (mime.includes("word") || mime === "application/msword") return "Word";
  return doc.file_name.split(".").pop()?.toUpperCase() || "File";
}

function docIcon(doc: DefaultProjectDocument): LucideIcon {
  const label = docTypeLabel(doc);
  if (label === "ZIP") return FileArchive;
  if (label === "Word") return FileType;
  return FileText;
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
        "inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-foreground disabled:opacity-50 sm:h-8 sm:w-8",
        destructive && "hover:bg-red-50 hover:text-red-600 surface-dark:hover:bg-red-500/15 surface-dark:hover:text-red-300"
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
    <section
      id="settings-default-documents"
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="settings-default-documents-title"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h3 id="settings-default-documents-title" className="text-base font-semibold text-heading">
          Default documents
        </h3>
        <p className="text-[13px] text-muted">Every new project gets its own copy</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {migrationRequired && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 surface-dark:border-amber-500/30 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
            Default documents need database migration v114 before they can be uploaded.
          </p>
        )}

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
          <p className="px-1 py-1 text-sm text-muted">
            No default documents yet. Add a contract or guide and it&apos;s copied into the Documents section of each new project.
          </p>
        ) : (
          <>
            {documents.map((doc) => {
              const Icon = docIcon(doc);
              return (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-muted">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-heading">{doc.file_name}</p>
                    <p className="truncate text-xs text-muted" title={`Updated ${new Date(doc.updated_at).toLocaleDateString()}`}>
                      {docTypeLabel(doc)}
                      {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                    </p>
                  </div>
                  {busyId === doc.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted" />
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
              );
            })}
            {uploading.map((name, i) => (
              <div key={`uploading-${i}-${name}`} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-muted">
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-muted">Uploading {name}…</p>
              </div>
            ))}
          </>
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
            "flex cursor-pointer items-center gap-3.5 rounded-xl border-[1.5px] border-dashed border-border px-4 py-4 transition-colors hover:bg-subtle",
            dragOver && "border-accent bg-accent-subtle",
            disabled && "pointer-events-none opacity-60"
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Upload className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-heading">Drop files or click to upload</span>
            <span className="block text-xs text-muted">PDF, Word or ZIP · up to 25 MB each</span>
          </span>
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
      </div>

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
    </section>
  );
}
