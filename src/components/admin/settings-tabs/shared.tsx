"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { settingsSectionIcon } from "@/components/admin/settings-section-icons";
import type { SiteServiceInput } from "@/lib/website/view";
import type { CustomDomainPublicState } from "@/lib/custom-domain";
import { deriveBrandTheme, type SurfaceMode } from "@/lib/brand-color";
import { type SettingsSectionId } from "@/lib/settings-nav";
import { type W9ClientOption } from "@/components/admin/tax-information-settings";
import type { AppSettings, NotificationChannelSettings, NotificationEventKey } from "@/lib/app-settings";
import type { LandingSettings } from "@/lib/landing-content";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { useRouter } from "next/navigation";
import type { BrandContrastWarning } from "@/lib/brand-color";
import type { PortalBrand } from "@/lib/portal-brand";

export interface NotificationEventDef {
  key: NotificationEventKey;
  label: string;
  description: string;
  audience: "admin" | "client" | "both";
}

export interface AdminSettingsClientProps {
  initialSettings: AppSettings;
  notificationEvents: NotificationEventDef[];
  payments: ReactNode;
  services: ReactNode;
  staff: ReactNode;
  canCustomizeLanding: boolean;
  canUseCustomDomain: boolean;
  customDomainState: CustomDomainPublicState;
  listingDomain: {
    state: CustomDomainPublicState;
    setupRequired: boolean;
    suggestedRootDomain: string | null;
    returnTo: string | null;
  };
  portalPreviewUrl: string;
  serviceNames: string[];
  /** Business Website: active services, live URL and the Business Website Address. */
  website: {
    services: SiteServiceInput[];
    siteUrl: string;
    domain: { domain: string | null; connected: boolean; setupRequired: boolean };
    domainState: CustomDomainPublicState;
  };
  showTax: boolean;
  w9Clients: W9ClientOption[];
  /** Sections with an essential setup step still open (accent dot in the menu). */
  attention?: SettingsSectionId[];
}


/** Everything a Settings tab needs from the page: current values, saved values and updaters. */
export type SettingsTabCtx = Required<Omit<AdminSettingsClientProps, "initialSettings">> & {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  savedSettings: AppSettings;
  initialSettings: AppSettings;
  saving: boolean;
  dirty: boolean;
  brandUnsaved: boolean;
  requestFormDirty: boolean;
  travelDirty: boolean;
  colorWarnings: BrandContrastWarning[];
  liveBrand: PortalBrand;
  tabAccent: string;
  inAppShell: boolean;
  setRestoreOpen: (open: boolean) => void;
  saveSettings: (next?: AppSettings) => Promise<void>;
  updateNotification: (key: NotificationEventKey, channel: keyof NotificationChannelSettings, value: boolean) => void;
  patchEmail: (patch: Partial<AppSettings["email"]>) => void;
  patchBusiness: (patch: Partial<AppSettings["business"]>) => void;
  dismissLogoSuggestion: () => Promise<void>;
  patchIntegrations: (patch: Partial<AppSettings["integrations"]>) => void;
  patchTravel: (travel: AppSettings["travel"]) => void;
  patchProposals: (patch: Partial<AppSettings["proposals"]>) => void;
  patchPayments: (patch: Partial<AppSettings["payments"]>) => void;
  patchVideoSharing: (patch: Partial<AppSettings["videoSharing"]>) => void;
  patchMediaSectionDefaults: (patch: Partial<AppSettings["mediaSectionDefaults"]>) => void;
  patchWorkflow: (workflow: AppSettings["workflow"]) => void;
  patchLanding: (landing: LandingSettings) => void;
  patchWebsite: (next: AppSettings["website"]) => void;
  patchTax: (patch: Partial<AppSettings["tax"]>) => void;
  selectSection: (id: SettingsSectionId) => void;
  router: ReturnType<typeof useRouter>;
};

/** Parses an API response, throwing its error message when the request failed. */
export async function parseApiResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new Error(`Request failed with HTTP ${res.status}`);
    }
    if (!res.ok) {
      const message = typeof data.error === "string" && data.error.trim() ? data.error : null;
      throw new Error(message || `Request failed with HTTP ${res.status}`);
    }
    return data;
  }

  const text = (await res.text()).trim().replace(/\s+/g, " ").slice(0, 180);
  throw new Error(
    text
      ? `Request failed with HTTP ${res.status}: ${text}`
      : `Request failed with HTTP ${res.status}`
  );
}

const SettingsTabContext = createContext<SettingsTabCtx | null>(null);
export const SettingsTabProvider = SettingsTabContext.Provider;

export function useSettingsTab(): SettingsTabCtx {
  const ctx = useContext(SettingsTabContext);
  if (!ctx) throw new Error("useSettingsTab must be used inside the Settings page");
  return ctx;
}

export function DomainRecordsList({ refreshKey }: { refreshKey: string }) {
  const [records, setRecords] = useState<{ name: string; type: string; value: string; record: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/email/domain", { credentials: "include" })
      .then((r) => parseApiResponse(r))
      .then((data) => {
        if (Array.isArray(data.records)) {
          setRecords(data.records as { name: string; type: string; value: string; record: string }[]);
        }
      })
      .catch(() => undefined);
  }, [refreshKey]);

  if (records.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 surface-dark:bg-subtle text-left text-muted">
            <th className="px-2 py-1.5">Type</th>
            <th className="px-2 py-1.5">Name</th>
            <th className="px-2 py-1.5">Value</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row, i) => (
            <tr key={`${row.name}-${i}`} className="border-t border-border">
              <td className="px-2 py-1.5 font-mono">{row.type}</td>
              <td className="px-2 py-1.5 font-mono">{row.name}</td>
              <td className="px-2 py-1.5 font-mono break-all">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompactToggle({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative flex h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-slate-200 surface-dark:bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white surface-dark:bg-card shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

export function RowToggle({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 hover:bg-slate-50 surface-dark:hover:bg-subtle">
      <span className="text-sm text-foreground">{label}</span>
      <CompactToggle id={id} checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

export function BrandSurfacePreview({
  primary,
  accent,
  portalName,
  businessName,
  logoUrl,
  surfaceMode = "light",
}: {
  primary: string;
  accent: string;
  portalName: string;
  businessName: string;
  logoUrl: string;
  surfaceMode?: SurfaceMode;
}) {
  const theme = deriveBrandTheme(primary, accent, surfaceMode);
  return (
    <div
      id="settings-colors"
      tabIndex={-1}
      className="overflow-hidden rounded-xl border scroll-mt-24"
      style={{ background: theme.background, borderColor: theme.border, color: theme.foreground }}
    >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ background: theme.card, borderColor: theme.border }}
        >
          <div className="flex h-10 max-w-[120px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="max-h-10 w-auto max-w-full object-contain object-left" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold" style={{ color: theme.heading }}>
              {portalName}
            </p>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: theme.muted }}>
              {businessName}
            </p>
          </div>
        <span
          className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: theme.accent, color: theme.accentForeground }}
        >
          Save
        </span>
      </div>
      <div className="p-4">
        <div className="rounded-xl border p-4" style={{ background: theme.card, borderColor: theme.border }}>
          <p className="font-semibold" style={{ color: theme.heading }}>
            Project name
          </p>
          <p className="mt-1 text-sm" style={{ color: theme.foreground }}>
            Body text stays easy to read on every background.
          </p>
          <p className="mt-1 text-sm" style={{ color: theme.muted }}>
            Muted metadata stays readable.
          </p>
          <p className="mt-2 text-sm font-medium" style={{ color: theme.accent }}>
            View details
          </p>
        </div>
      </div>
    </div>
  );
}

/** Section title with its menu icon in a tile; a description <p> right after it is indented to match. */
export function SectionHeading({ id, children }: { id: SettingsSectionId; children: ReactNode }) {
  const Icon = settingsSectionIcon(id);
  return (
    <h2 data-settings-heading="" className="relative flex min-h-9 items-center pl-[52px] text-lg font-semibold text-heading">
      {Icon ? (
        <span className="absolute left-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      {children}
    </h2>
  );
}

/** Label with a small info icon and a plain-language hint under the field. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}

