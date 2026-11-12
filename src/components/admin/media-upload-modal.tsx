"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useUploadManager } from "@/components/admin/upload-manager";
import { formatFileSize } from "@/lib/upload/validation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export interface ProjectOption {
  id: string;
  project_name: string;
  property_address: string;
}

interface MediaUploadModalProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  defaultProjectId?: string | null;
  onUploaded?: () => void;
  /**
   * New interface Media Library: also add the uploads to a library folder (by reference).
   * Omitted in Classic, where the modal is unchanged.
   */
  libraryFolders?: { id: string; name: string }[];
  defaultLibraryFolderId?: string | null;
  /** Called after uploads were added to a library folder. */
  onAddedToFolder?: (folderId: string, count: number) => void;
}

/** Add freshly uploaded assets to a Media Library folder (chunks of 500, best effort). */
async function addUploadsToLibraryFolder(folderId: string, ids: string[]): Promise<number> {
  let added = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const res = await fetch(`/api/library-folders/${folderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items: ids.slice(i, i + 500) }),
    });
    if (!res.ok) throw new Error();
    const json = (await res.json().catch(() => ({}))) as { added?: number };
    added += json.added ?? 0;
  }
  return added;
}

export function MediaUploadModal({
  open,
  onClose,
  projects,
  defaultProjectId,
  onUploaded,
  libraryFolders,
  defaultLibraryFolderId,
  onAddedToFolder,
}: MediaUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [libraryFolderId, setLibraryFolderId] = useState(defaultLibraryFolderId ?? "");
  useEffect(() => {
    if (open) setLibraryFolderId(defaultLibraryFolderId ?? "");
  }, [open, defaultLibraryFolderId]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { enqueueUploads, isUploading } = useUploadManager();

  function resetForm() {
    setTitle("");
    setDescription("");
    setTags("");
    setPendingFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setPendingFiles(files);
    if (files.length === 1 && !title) {
      setTitle(files[0].name.replace(/\.[^.]+$/, ""));
    }
  }

  function startUpload() {
    if (!pendingFiles.length) {
      toast.error("Choose at least one photo or video.");
      return;
    }

    const selectedProject = projectId || null;
    const meta = {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    const files = [...pendingFiles];
    const targetFolder = libraryFolders && libraryFolderId ? libraryFolders.find((f) => f.id === libraryFolderId) ?? null : null;
    resetForm();
    onClose();

    enqueueUploads({
      files,
      projectId: selectedProject,
      metadata: meta,
      onBatchComplete: ({ uploaded, errors }) => {
        if (uploaded.length && targetFolder) {
          // Reference only — the files stay where they were uploaded (project or Unassigned).
          void addUploadsToLibraryFolder(
            targetFolder.id,
            uploaded.map((a) => `${a.media_type === "video" ? "video" : a.media_type === "document" ? "document" : "photo"}:${a.id}`)
          )
            .then((added) => {
              toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded to “${targetFolder.name}”`);
              onAddedToFolder?.(targetFolder.id, added);
              onUploaded?.();
            })
            .catch(() => {
              toast.error(`Uploaded, but couldn't add to “${targetFolder.name}”. Add them from All Media.`);
              onUploaded?.();
            });
        } else if (uploaded.length) {
          toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
          onUploaded?.();
        }
        if (errors.length && !uploaded.length) toast.error(errors[0]);
        else if (errors.length) toast.warning(`${errors.length} file${errors.length === 1 ? "" : "s"} failed`);
      },
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Media" className="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Unassigned - add to library only"
            options={[
              { value: "", label: "Unassigned" },
              ...projects.map((p) => ({
                value: p.id,
                label: p.property_address
                  ? `${p.project_name} - ${p.property_address}`
                  : p.project_name,
              })),
            ]}
          />
        </div>

        {libraryFolders ? (
          <div className="space-y-2">
            <Label>Add to folder (optional)</Label>
            <Select
              value={libraryFolderId}
              onChange={(e) => setLibraryFolderId(e.target.value)}
              options={[
                { value: "", label: "No folder" },
                ...libraryFolders.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
            <p className="text-xs text-muted">Folders organize media — files aren&apos;t copied or moved.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Photos &amp; videos</Label>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-slate-50 surface-dark:bg-subtle px-4 py-6 text-sm text-muted hover:bg-slate-100 surface-dark:hover:bg-subtle">
            <Upload className="h-4 w-4" />
            Choose files
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v,video/m4v,.mp4,.MP4,.mov,.MOV,.m4v"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
          {pendingFiles.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-slate-50 surface-dark:bg-subtle p-2 text-xs">
              {pendingFiles.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex justify-between gap-2">
                  <span className="truncate font-medium text-heading">{f.name}</span>
                  <span className="shrink-0 text-muted">
                    {formatFileSize(f.size)} · {f.type || "unknown"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-title">Title</Label>
          <Input
            id="media-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to filename"
            className="min-h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-desc">Description</Label>
          <Textarea
            id="media-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-tags">Tags</Label>
          <Input
            id="media-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="aerial, sunset, exterior (comma separated)"
            className="min-h-11"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} className="min-h-11">
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={startUpload}
            disabled={pendingFiles.length === 0}
            className="min-h-11"
          >
            {isUploading ? "Add to queue" : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
