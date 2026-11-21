/** Browser-side calls for Media Library folders (all authorization is server-side). */
import { toast } from "sonner";
import type { LibraryFolderSummary } from "@/lib/library-folder-types";

const CHUNK = 500;

export type FolderPermissions = {
  /** Create / rename / delete folders, add / remove items (media.organize). */
  organize: boolean;
  upload: boolean;
  deleteMedia: boolean;
  /** Share individual assets (sharing.email / sharing.anyone_with_link). */
  shareItems: { email: boolean; link: boolean };
  /** Share whole folders: a sharing permission AND visibility of every project. */
  shareFolders: boolean;
  /** Delete folders: media.organize AND visibility of every project. */
  deleteFolders: boolean;
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error || fallback;
}

export async function fetchLibraryFolders(): Promise<{ setupRequired: boolean; folders: LibraryFolderSummary[]; subfoldersSupported?: boolean }> {
  const res = await fetch("/api/library-folders", { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't load folders."));
  return res.json();
}

/** Returns the new folder, or an error message (duplicate names, setup required, …). `parentId` makes a subfolder. */
export async function createLibraryFolderRequest(name: string, parentId: string | null = null): Promise<{ id: string; name: string } | string> {
  const res = await fetch("/api/library-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(parentId ? { name, parentId } : { name }),
  });
  if (!res.ok) return errorMessage(res, "Couldn't create the folder.");
  const json = (await res.json()) as { folder: { id: string; name: string } };
  return json.folder;
}

export async function updateLibraryFolderRequest(
  id: string,
  patch: { name?: string; coverAssetId?: string | null; parentId?: string | null }
): Promise<string | null> {
  const res = await fetch(`/api/library-folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  return res.ok ? null : errorMessage(res, "Couldn't update the folder.");
}

export async function deleteLibraryFolderRequest(id: string): Promise<string | null> {
  const res = await fetch(`/api/library-folders/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok ? null : errorMessage(res, "Couldn't delete the folder.");
}

/** What a move changed (from the server), so it can be undone. */
export type FolderMoveUndo = {
  added: string[];
  restore: { folderId: string; key: string; addedAt: string | null }[];
};

export type FolderItemsResult = { changed: number; unchanged: number; skipped: number; undo?: FolderMoveUndo };

/**
 * Add, move or remove "kind:id" keys in chunks. Throws with a readable message on failure.
 * "move" puts each item in this folder and takes it out of every other folder.
 */
export async function changeFolderItems(folderId: string, keys: string[], mode: "add" | "move" | "remove"): Promise<FolderItemsResult> {
  const out: FolderItemsResult = { changed: 0, unchanged: 0, skipped: 0 };
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = keys.slice(i, i + CHUNK);
    const res = await fetch(`/api/library-folders/${folderId}/items`, {
      method: mode === "remove" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(mode === "move" ? { items: part, move: true } : { items: part }),
    });
    if (!res.ok) {
      throw new Error(
        await errorMessage(res, mode === "remove" ? "Couldn't remove from the folder." : mode === "move" ? "Couldn't move to the folder." : "Couldn't add to the folder.")
      );
    }
    const json = (await res.json()) as { added?: number; alreadyInFolder?: number; removed?: number; skipped?: number; undo?: FolderMoveUndo };
    if (mode === "move" && json.undo) {
      out.undo ??= { added: [], restore: [] };
      out.undo.added.push(...json.undo.added);
      out.undo.restore.push(...json.undo.restore);
    }
    if (mode !== "remove") {
      out.changed += json.added ?? 0;
      out.unchanged += json.alreadyInFolder ?? 0;
    } else {
      out.changed += json.removed ?? 0;
    }
    out.skipped += json.skipped ?? 0;
  }
  return out;
}

/** "Moved 12 to “Raw”" (items already there count as moved too — they now live only there). */
export function movedToFolderMessage(folderName: string, r: FolderItemsResult): string {
  const moved = r.changed + r.unchanged;
  const parts = [moved ? `Moved ${moved.toLocaleString()} to “${folderName}”` : `Nothing moved to “${folderName}”`];
  if (r.skipped) parts.push(`${r.skipped.toLocaleString()} skipped`);
  return parts.join(" · ");
}

export function addedToFolderMessage(folderName: string, r: FolderItemsResult): string {
  const parts: string[] = [];
  parts.push(r.changed ? `Added ${r.changed.toLocaleString()} to “${folderName}”` : `Nothing new added to “${folderName}”`);
  if (r.unchanged) parts.push(`${r.unchanged.toLocaleString()} already there`);
  if (r.skipped) parts.push(`${r.skipped.toLocaleString()} skipped`);
  return parts.join(" · ");
}

/** A move that changed nothing (everything was already only there) has nothing to undo. */
export function canUndoMove(undo: FolderMoveUndo | undefined): undo is FolderMoveUndo {
  return Boolean(undo && (undo.added.length || undo.restore.length));
}

/**
 * Undo a move into `folderId`: newly added items leave it, and every item goes back into the
 * folders it was taken out of. Sent in chunks of up to 500 items. Throws on failure.
 */
export async function undoFolderMove(folderId: string, undo: FolderMoveUndo): Promise<{ removed: number; restored: number; skipped: number }> {
  const out = { removed: 0, restored: 0, skipped: 0 };
  const keys = [...new Set([...undo.added, ...undo.restore.map((r) => r.key)])];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = new Set(keys.slice(i, i + CHUNK));
    const res = await fetch(`/api/library-folders/${folderId}/items/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        added: undo.added.filter((k) => part.has(k)),
        restore: undo.restore.filter((r) => part.has(r.key)),
      }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Couldn't undo the move."));
    const json = (await res.json()) as { removed?: number; restored?: number; skipped?: number };
    out.removed += json.removed ?? 0;
    out.restored += json.restored ?? 0;
    out.skipped += json.skipped ?? 0;
  }
  return out;
}

/**
 * "Moved 12 to “Raw”" with Undo (and Open, when given). Undo puts every item back where it was;
 * `onUndone` refreshes whatever the caller shows.
 */
export function showMoveToast(
  folder: { id: string; name: string },
  r: FolderItemsResult,
  opts: { onOpen?: () => void; onUndone: () => void }
) {
  const undo = r.undo;
  toast.success(movedToFolderMessage(folder.name, r), {
    duration: canUndoMove(undo) ? 10_000 : undefined,
    action: canUndoMove(undo)
      ? {
          label: "Undo",
          onClick: () => {
            const id = toast.loading("Undoing the move…");
            void undoFolderMove(folder.id, undo)
              .then((u) => {
                toast.success(`Moved back out of “${folder.name}”`, {
                  id,
                  description: u.skipped ? `${u.skipped.toLocaleString()} couldn't go back (folder deleted or no access).` : undefined,
                });
                opts.onUndone();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't undo the move.", { id }));
          },
        }
      : undefined,
    cancel: opts.onOpen ? { label: "Open", onClick: opts.onOpen } : undefined,
  });
}
