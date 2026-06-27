"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { UploadProgressList } from "@/components/admin/upload-progress-list";
import { useMediaUploadQueue } from "@/hooks/use-media-upload-queue";
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
}

export function MediaUploadModal({
  open,
  onClose,
  projects,
  defaultProjectId,
  onUploaded,
}: MediaUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { uploadItems, processFiles, handleRetrySave, isUploading } = useMediaUploadQueue({
    onUploaded: () => {
      onUploaded?.();
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setTags("");
    setPendingFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    if (isUploading) {
      toast.error("Wait for uploads to finish.");
      return;
    }
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

  async function startUpload() {
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

    const { uploaded, errors } = await processFiles(pendingFiles, selectedProject, meta);

    if (uploaded.length) {
      toast.success(`${uploaded.length} file(s) uploaded`);
      resetForm();
    }
    if (errors.length && !uploaded.length) toast.error(errors[0]);
    else if (errors.length) toast.warning(errors.join("; "));
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Media" className="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Unassigned — add to library only"
            options={[
              { value: "", label: "Unassigned" },
              ...projects.map((p) => ({
                value: p.id,
                label: p.property_address
                  ? `${p.project_name} — ${p.property_address}`
                  : p.project_name,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label>Photos &amp; videos</Label>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-slate-50 px-4 py-6 text-sm text-muted hover:bg-slate-100">
            <Upload className="h-4 w-4" />
            Choose files
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v,video/m4v,.mp4,.MP4,.mov,.MOV,.m4v"
              className="hidden"
              onChange={onFileChange}
              disabled={isUploading}
            />
          </label>
          {pendingFiles.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-slate-50 p-2 text-xs">
              {pendingFiles.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex justify-between gap-2">
                  <span className="truncate font-medium text-primary">{f.name}</span>
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

        {uploadItems.length > 0 && (
          <UploadProgressList items={uploadItems} onRetrySave={handleRetrySave} />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading} className="min-h-11">
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={startUpload}
            disabled={isUploading || pendingFiles.length === 0}
            className="min-h-11"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
