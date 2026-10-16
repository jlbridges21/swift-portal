"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Folder, Images, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MediaFolder } from "@/lib/types";
import { UNFILED_FOLDER_LABEL } from "@/lib/project-zip-assets";

interface NameDialogProps {
  open: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel: string;
  busy?: boolean;
  maxLength?: number;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function NameDialog({
  open,
  title,
  initialValue,
  placeholder,
  confirmLabel,
  busy = false,
  maxLength = 120,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const submit = () => {
    if (trimmed && !busy) onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-10">
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!trimmed || busy} className="min-h-11 sm:min-h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="min-h-11"
        onKeyDown={(e: ReactKeyboardEvent) => {
          if (e.key === "Enter") submit();
        }}
      />
    </Modal>
  );
}

interface MoveToFolderDialogProps {
  open: boolean;
  count: number;
  folders: MediaFolder[];
  /** Folder every selected photo is already in (`null` = General Photos), if uniform. */
  currentFolderId: string | null | undefined;
  sharedCount: number;
  busy?: boolean;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
  onCreateAndMove: (name: string) => void;
}

export function MoveToFolderDialog({
  open,
  count,
  folders,
  currentFolderId,
  sharedCount,
  busy = false,
  onClose,
  onMove,
  onCreateAndMove,
}: MoveToFolderDialogProps) {
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) {
      setTarget(undefined);
      setCreating(false);
      setNewName("");
    }
  }, [open]);

  const destinations: { id: string | null; name: string }[] = [
    { id: null, name: UNFILED_FOLDER_LABEL },
    ...folders.map((f) => ({ id: f.id, name: f.name })),
  ];

  const canSubmit = creating ? newName.trim().length > 0 : target !== undefined;
  const label = `${count} photo${count === 1 ? "" : "s"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move ${label}`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-10">
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!canSubmit || busy}
            className="min-h-11 sm:min-h-10"
            onClick={() => {
              if (creating) onCreateAndMove(newName.trim());
              else if (target !== undefined) onMove(target);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {creating ? "Create folder and move" : "Move"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Destination folder" className="space-y-1">
          {destinations.map((d) => {
            const isCurrent = currentFolderId !== undefined && d.id === currentFolderId;
            const selected = !creating && target === d.id;
            const Icon = d.id === null ? Images : Folder;
            return (
              <button
                key={d.id ?? "general"}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isCurrent}
                onClick={() => {
                  setCreating(false);
                  setTarget(d.id);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition",
                  selected ? "border-accent bg-accent-subtle text-heading" : "border-border text-foreground hover:bg-accent-subtle",
                  isCurrent && "cursor-default opacity-50 hover:bg-transparent"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {isCurrent ? <span className="text-xs text-muted">Current</span> : null}
                {selected ? <Check className="h-4 w-4 text-accent" /> : null}
              </button>
            );
          })}
        </div>
        {creating ? (
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New folder name"
            maxLength={120}
            className="min-h-11"
          />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            + New folder
          </Button>
        )}
        {sharedCount > 0 ? (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 surface-dark:border-amber-500/40 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
            {sharedCount === 1 ? "1 of these photos is" : `${sharedCount} of these photos are`} shared. Moving
            ends {sharedCount === 1 ? "its" : "their"} share links and invites.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
