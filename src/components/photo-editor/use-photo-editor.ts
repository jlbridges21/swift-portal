"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export interface OpenPhotoEditorOptions {
  projectId?: string | null;
  /** Single photo or a selection — order is preserved in the editor's filmstrip. */
  mediaIds?: string[];
  /** Folder id, or "unfiled" (General Photos): every photo in it. */
  folderId?: string | null;
  activeMediaId?: string | null;
}

/**
 * Opens photos in the full-screen Photo Editor. Creates a server-side editing session (so a
 * batch can be reopened later, from any device) and navigates to it. Returns the user to the
 * page they came from when they're done.
 */
export function usePhotoEditor() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [opening, setOpening] = useState(false);

  const open = useCallback(
    async (opts: OpenPhotoEditorOptions) => {
      if (opening) return;
      setOpening(true);
      const query = searchParams?.toString();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const returnTo = `${pathname}${query ? `?${query}` : ""}${hash || ""}`;
      try {
        const res = await fetch("/api/media/editor/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...opts, returnTo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "The Photo Editor couldn't be opened.");
        if (data.skipped > 0) {
          toast.message(
            `${data.skipped} file${data.skipped === 1 ? "" : "s"} skipped`,
            { description: "Only JPEG, PNG and WebP photos can be edited. Videos and other files are left as they are." }
          );
        }
        if (data.trimmed > 0) {
          toast.message(`Opening the first ${data.count} photos`, {
            description: `Edit the remaining ${data.trimmed} in another session.`,
          });
        }
        router.push(`/admin/photo-editor/${data.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "The Photo Editor couldn't be opened.");
        setOpening(false);
      }
    },
    [opening, pathname, router, searchParams]
  );

  return { open, opening };
}
