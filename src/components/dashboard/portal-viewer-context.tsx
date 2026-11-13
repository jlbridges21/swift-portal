"use client";

import { createContext, useContext } from "react";

export type PortalViewer = { name: string | null; avatarUrl: string | null };

const PortalViewerContext = createContext<PortalViewer | null>(null);

/** Signed-in client's name/avatar, so the portal's loading state renders the same Header. */
export function PortalViewerProvider({ viewer, children }: { viewer: PortalViewer; children: React.ReactNode }) {
  return <PortalViewerContext.Provider value={viewer}>{children}</PortalViewerContext.Provider>;
}

export function usePortalViewer(): PortalViewer | null {
  return useContext(PortalViewerContext);
}
