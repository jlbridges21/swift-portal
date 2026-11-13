"use client";

import { useEffect, useState } from "react";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import type { MediaAsset, MediaFolder } from "@/lib/types";

function mockPhotos(): MediaAsset[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: `harness-photo-${i + 1}`,
    project_id: "harness-project",
    folder_id: null,
    file_name: `Photo ${i + 1}.jpg`,
    file_path: `harness/photo-${i + 1}.jpg`,
    file_size: 1_000_000,
    mime_type: "image/jpeg",
    media_type: "photo",
    display_order: i,
    media_source: "upload",
    visibility: "both",
    youtube_url: null,
    embed_url: null,
    created_at: "2026-11-01T00:00:00.000Z",
  }));
}

export function PhotoGridHarness({ shell, bottomNav }: { shell: "classic" | "new"; bottomNav: boolean }) {
  const [photos, setPhotos] = useState<MediaAsset[]>(mockPhotos);
  const [folders, setFolders] = useState<MediaFolder[]>([]);

  useEffect(() => {
    if (!bottomNav) return;
    document.body.setAttribute("data-admin-pwa-nav", "");
    return () => document.body.removeAttribute("data-admin-pwa-nav");
  }, [bottomNav]);

  const grid = (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-heading">Photo grid harness</h1>
      {/* Content above the grid, like the project page's folder row. */}
      <div className="h-40 rounded-xl border border-dashed border-border bg-card" />
      <AdminPhotoGrid
        projectId="harness-project"
        photos={photos}
        folders={folders}
        isHero={(id) => id === "harness-photo-5"}
        onSetHero={() => {}}
        onDelete={() => {}}
        onPhotosChange={setPhotos}
        onFoldersChange={setFolders}
        onToggleVisibility={() => {}}
        onUploadFiles={() => {}}
      />
      <div className="h-96" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {shell === "new" ? (
        <div data-admin-app-shell="" className="flex min-h-screen w-full">
          <aside className="admin-app-sidebar sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card md:block" />
          <div className="min-w-0 flex-1">{grid}</div>
        </div>
      ) : (
        grid
      )}
      {bottomNav ? (
        <nav className="admin-mobile-pwa-nav" aria-label="Harness tab bar">
          <div className="h-[72px]" />
        </nav>
      ) : null}
    </div>
  );
}
