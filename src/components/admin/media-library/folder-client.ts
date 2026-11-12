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

export async function fetchLibraryFolders(): Promise<{ setupRequired: boolean; folders: LibraryFolderSummary[] }> {
  const res = await fetch("/api/library-folders", { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't load folders."));
  return res.json();
}

/** Returns the new folder, or an error message (duplicate names, setup required, …). */
export async function createLibraryFolderRequest(name: string): Promise<{ id: string; name: string } | string> {
  const res = await fetch("/api/library-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return errorMessage(res, "Couldn't create the folder.");
  const json = (await res.json()) as { folder: { id: string; name: string } };
  return json.folder;
}

export async function updateLibraryFolderRequest(id: string, patch: { name?: string; coverAssetId?: string | null }): Promise<string | null> {
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

/** Add or remove "kind:id" keys in chunks. Throws with a readable message on failure. */
export async function changeFolderItems(folderId: string, keys: string[], mode: "add" | "remove"): Promise<FolderItemsResult> {
  const out: FolderItemsResult = { changed: 0, unchanged: 0, skipped: 0 };
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = keys.slice(i, i + CHUNK);
    const res = await fetch(`/api/library-folders/${folderId}/items`, {
      method: mode === "add" ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items: part }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, mode === "add" ? "Couldn't add to the folder." : "Couldn't remove from the folder."));
    const json = (await res.json()) as { added?: number; alreadyInFolder?: number; removed?: number; skipped?: number };
    if (mode === "add") {
      out.changed += json.added ?? 0;
      out.unchanged += json.alreadyInFolder ?? 0;
    } else {
      out.changed += json.removed ?? 0;
    }
    out.skipped += json.skipped ?? 0;
  }
  return out;
}

export function addedToFolderMessage(folderName: string, r: FolderItemsResult): string {
  const parts: string[] = [];
  parts.push(r.changed ? `Added ${r.changed.toLocaleString()} to “${folderName}”` : `Nothing new added to “${folderName}”`);
  if (r.unchanged) parts.push(`${r.unchanged.toLocaleString()} already there`);
  if (r.skipped) parts.push(`${r.skipped.toLocaleString()} skipped`);
  return parts.join(" · ");
}
