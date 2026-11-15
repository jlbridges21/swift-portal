"use client";

import { useState } from "react";
import { Box, FileText, Image as ImageIcon, Rotate3d, Upload, Video } from "lucide-react";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";

/** Dev harness: the project page's Upload Media menu (same items) to check its layout. */
export function MenuDemo() {
  const [anchor, setAnchor] = useState<ActionMenuAnchor | null>(null);
  const noop = () => {};
  const items: ActionMenuItem[] = [
    { id: "photos", label: "Photos", icon: ImageIcon, hint: "JPEG, PNG or WebP — into the open folder", onSelect: noop },
    { id: "videos", label: "Video files", icon: Upload, hint: "Up to 2.00 GB", onSelect: noop },
    { id: "youtube", label: "YouTube link", icon: Video, onSelect: noop },
    { id: "tour", label: "360 tour link", icon: Rotate3d, onSelect: noop },
    { id: "model", label: "3D model link", icon: Box, onSelect: noop },
    { id: "files", label: "Documents & files", icon: FileText, hint: "PDF, Word, Excel, CSV or ZIP", onSelect: noop },
  ];
  return (
    <div className="flex justify-end p-10">
      <button
        type="button"
        id="upload-media-demo"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        onClick={(e) => setAnchor({ kind: "element", element: e.currentTarget })}
      >
        Upload Media
      </button>
      <ActionMenu anchor={anchor} onClose={() => setAnchor(null)} items={items} title="Upload media" />
    </div>
  );
}
