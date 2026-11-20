/** Browser-side calls for Media Library folders (all authorization is server-side). */
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

export type FolderItemsResult = { changed: number; unchanged: number; skipped: number };

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
    const json = (await res.json()) as { added?: number; alreadyInFolder?: number; removed?: number; skipped?: number };
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
