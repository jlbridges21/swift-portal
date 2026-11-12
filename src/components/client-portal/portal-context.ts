import type { ReactNode } from "react";
import type { ProjectPageClientProps } from "@/components/projects/project-page-client";
import type { ClientFavoritesController } from "@/components/projects/use-client-favorites";
import type { VideoGridEntry } from "@/components/projects/video-grid";
import type { MediaAsset, Revision } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import type { PortalFinancialState } from "@/components/client-portal/portal-financial-state";

export type PortalTab = "gallery" | "videos" | "tours" | "models" | "marketing" | "files" | "pay";

export const PORTAL_TABS: PortalTab[] = ["gallery", "videos", "tours", "models", "marketing", "files", "pay"];

export function parsePortalTab(raw: string | null | undefined): PortalTab {
  return PORTAL_TABS.includes(raw as PortalTab) ? (raw as PortalTab) : "gallery";
}

/** A ZIP download started from a custom button; `panel` renders the quality picker + progress. */
export type ZipController = { start: () => void; active: boolean; ready: boolean; panel: ReactNode };

/**
 * Everything the new client portal tabs share. Built once in ClientPortalProject from the same
 * server-scoped props the classic page receives, so both interfaces show the same data.
 */
export type PortalCtx = Required<
  Pick<
    ProjectPageClientProps,
    | "project"
    | "hero"
    | "photos"
    | "videos"
    | "documents"
    | "tours"
    | "models"
    | "payments"
    | "shootProposals"
    | "activities"
    | "quotes"
    | "assetReviews"
    | "mediaFolders"
    | "depositMode"
    | "depositPercent"
    | "depositAmountCents"
    | "allowClientPayInFull"
    | "allowClientProposalChanges"
  >
> & {
  marketingKit: ProjectPageClientProps["marketingKit"];
  revisions: Revision[];
  setRevisions: (updater: (prev: Revision[]) => Revision[]) => void;
  isPreview: boolean;
  isSharedViewer: boolean;
  canViewFinancials: boolean;
  canViewProjectProgress: boolean;
  canAccessVideoReviews: boolean;
  videoSharing?: { canShare: boolean; publicVideoIds: string[] };
  show: { photos: boolean; videos: boolean; tours: boolean; models: boolean; documents: boolean; estimates: boolean; payments: boolean };
  /** What the client gets under the current download rules (status + business setting + project override). */
  clientDownloadsUnlocked: boolean;
  /** Effective for this viewer (business previews may always download). */
  downloadsUnlocked: boolean;
  downloadLockMessage: string | null;
  hasAnyMedia: boolean;
  downloadableFileCount: number;
  favorites?: ClientFavoritesController;
  financial: PortalFinancialState;
  videoEntries: VideoGridEntry[];
  reviewByAssetId: Map<string, VideoReviewListItem>;
  getDownloadUrl: (asset: MediaAsset, thumb?: boolean) => Promise<string | null>;
  handleDownload: (asset: MediaAsset) => Promise<void>;
  handleView: (asset: MediaAsset) => Promise<void>;
  /** Switch tab (pushes history). `params` sets/clears extra query params (e.g. album). */
  goTo: (tab: PortalTab, params?: Record<string, string | null>, hash?: string) => void;
  openMessages: (() => void) | null;
  zipAll: ZipController;
  zipFavorites: ZipController;
  favoriteDownloadCount: number;
  availableTabs: Set<PortalTab>;
  /** Marketing add-ons the client can see on this project. */
  marketingProducts: ("website" | "social")[];
};
