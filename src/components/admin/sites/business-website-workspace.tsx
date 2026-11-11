"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusinessWebsiteEditor } from "@/components/admin/business-website/business-website-editor";
import { LandingPageSettingsCard } from "@/components/admin/landing-page-settings-card";
import { LandingEditorShellPlacementContext } from "@/components/landing/landing-editor-shell";
import { usePortalBrand } from "@/components/brand/brand-provider";
import type { AppSettings, BusinessSettings } from "@/lib/app-settings";
import type { LandingSettings } from "@/lib/landing-content";
import type { SiteServiceInput } from "@/lib/website/view";

/** On desktop the editor fills the viewport below the Sites header (set by SitesHeader). */
const PLACEMENT = { className: "lg:top-[var(--sites-header-bottom,calc(4rem+var(--sat)))]" };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const message = typeof data.error === "string" && data.error.trim() ? data.error : null;
    throw new Error(message || `Request failed with HTTP ${res.status}`);
  }
  return data;
}

/**
 * Sites → Business Website: the existing Business Website builder (the same component
 * Settings → Business Website used), with its own save bar. Saves go through the same
 * settings API, sending only what this editor changes (website, business identity used by
 * the site, and the classic landing page) so nothing else in Settings is overwritten.
 */
export function BusinessWebsiteWorkspace({
  initialSettings,
  services,
  siteUrl,
  websiteDomain,
  canCustomizeLanding,
  serviceNames,
  portalPreviewUrl,
}: {
  initialSettings: AppSettings;
  services: SiteServiceInput[];
  siteUrl: string;
  websiteDomain: { domain: string | null; connected: boolean; setupRequired: boolean };
  canCustomizeLanding: boolean;
  serviceNames: string[];
  portalPreviewUrl: string;
}) {
  const router = useRouter();
  const liveBrand = usePortalBrand();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialSettings));
  const [saving, setSaving] = useState(false);
  const [classicEditor, setClassicEditor] = useState(false);
  const savedSettings = useMemo(() => JSON.parse(baseline) as AppSettings, [baseline]);
  const dirty = useMemo(() => JSON.stringify(settings) !== baseline, [settings, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useCallback(
    async (next?: AppSettings) => {
      const payload = next ?? settings;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ settings: { website: payload.website, business: payload.business, landing: payload.landing } }),
        });
        const data = await readJson(res);
        const saved = data.settings as AppSettings;
        setSettings(saved);
        setBaseline(JSON.stringify(saved));
        toast.success("Website saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save website");
      } finally {
        setSaving(false);
      }
    },
    [settings, router]
  );

  const patchWebsite = useCallback((website: AppSettings["website"]) => setSettings((prev) => ({ ...prev, website })), []);
  const patchBusiness = useCallback(
    (patch: Partial<BusinessSettings>) => setSettings((prev) => ({ ...prev, business: { ...prev.business, ...patch } })),
    []
  );
  const patchLanding = useCallback((landing: LandingSettings) => setSettings((prev) => ({ ...prev, landing })), []);

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
      <Button variant="accent" onClick={() => void save()} disabled={saving || !dirty} className="min-h-11 min-w-[140px]">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Save Website
          </>
        )}
      </Button>
    </div>
  );

  return (
    <LandingEditorShellPlacementContext.Provider value={PLACEMENT}>
      {classicEditor && !savedSettings.website.launched ? (
        <LandingPageSettingsCard
          landing={settings.landing}
          baselineLanding={savedSettings.landing ?? settings.landing}
          businessName={settings.business.businessName}
          serviceNames={serviceNames}
          portalPreviewUrl={portalPreviewUrl}
          canEdit={canCustomizeLanding}
          brand={liveBrand}
          onChange={patchLanding}
          shellNav={
            <div className="rounded-lg border border-border bg-subtle px-3 py-2 text-xs">
              <p className="text-muted">Editing the classic landing page (currently live).</p>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 font-medium text-accent hover:underline"
                onClick={() => setClassicEditor(false)}
              >
                <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Business Website
              </button>
            </div>
          }
          shellFooter={footer}
        />
      ) : (
        <BusinessWebsiteEditor
          settings={settings}
          savedSettings={savedSettings}
          services={services}
          siteUrl={siteUrl}
          websiteDomain={websiteDomain}
          onWebsiteChange={patchWebsite}
          onBusinessChange={patchBusiness}
          onPublishNow={() => {
            const next = { ...settings, website: { ...settings.website, launched: true } };
            setSettings(next);
            void save(next);
          }}
          onOpenClassicEditor={savedSettings.website.launched ? undefined : () => setClassicEditor(true)}
          saving={saving}
          shellNav={null}
          shellFooter={footer}
        />
      )}
    </LandingEditorShellPlacementContext.Provider>
  );
}
