"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { Loader2, Save, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { SettingsTabNav } from "@/components/admin/settings-tab-nav";

import { publishSettingsNav } from "@/components/admin/settings-nav-store";

import { LandingPageSettingsCard } from "@/components/admin/landing-page-settings-card";

import { BusinessWebsiteEditor } from "@/components/admin/business-website/business-website-editor";

import { getPortalBrandFromSettings, PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { PLATFORM_EMAIL_SENDER_DEFAULTS } from "@/lib/email-sender-policy";

import { brandContrastWarnings, parseSurfaceMode, sanitizeCssColor, type SurfaceMode } from "@/lib/brand-color";

import { sectionForHash, visibleSettingsSections, type SettingsSectionId } from "@/lib/settings-nav";
import { readCleanHash } from "@/lib/url-hash";
import { TaxInformationSettings } from "@/components/admin/tax-information-settings";

import { usePortalBrand, useSetBrandPreview, type BrandPreview } from "@/components/brand/brand-provider";
import { useInAdminAppShell } from "@/components/admin/app-shell/admin-app-shell-context";
import type { AppSettings, NotificationChannelSettings, NotificationEventKey } from "@/lib/app-settings";
import type { LandingSettings } from "@/lib/landing-content";
import type { ReactNode } from "react";
import { IdentityTab } from "@/components/admin/settings-tabs/identity-tab";
import { BrandingTab } from "@/components/admin/settings-tabs/branding-tab";
import { ContactTab } from "@/components/admin/settings-tabs/contact-tab";
import { EmailSenderTab } from "@/components/admin/settings-tabs/email-sender-tab";
import { WebAddressTab } from "@/components/admin/settings-tabs/web-address-tab";
import { MarketingKitTab } from "@/components/admin/settings-tabs/marketing-kit-tab";
import { AutomatedEmailsTab } from "@/components/admin/settings-tabs/automated-emails-tab";
import { PaymentsTab } from "@/components/admin/settings-tabs/payments-tab";
import { NewProjectSetupTab } from "@/components/admin/settings-tabs/new-project-setup-tab";
import { ServicesTab } from "@/components/admin/settings-tabs/services-tab";
import { BookingTab } from "@/components/admin/settings-tabs/booking-tab";
import { TeamAvailabilityTab } from "@/components/admin/booking/team-availability";
import { TeamPaySettings } from "@/components/admin/team-pay/team-pay-settings";
import { WorkflowTab } from "@/components/admin/settings-tabs/workflow-tab";
import { NotificationsTab } from "@/components/admin/settings-tabs/notifications-tab";
import { IntegrationsTab } from "@/components/admin/settings-tabs/integrations-tab";
import { parseApiResponse, SettingsTabProvider, type AdminSettingsClientProps, type SettingsTabCtx } from "@/components/admin/settings-tabs/shared";

function SettingsPanel({
  id,
  active,
  children,
}: {
  id: SettingsSectionId;
  active: SettingsSectionId;
  children: ReactNode;
}) {
  const selected = id === active;
  return (
    <div
      role="tabpanel"
      id={`settings-panel-${id}`}
      aria-labelledby={`settings-tab-${id}`}
      hidden={!selected}
      tabIndex={selected ? 0 : -1}
      className={selected ? "outline-none [&_h2[data-settings-heading]+p]:pl-[52px]" : "hidden"}
    >
      {children}
    </div>
  );
}

export function AdminSettingsClient({
  initialSettings,
  notificationEvents,
  payments,
  services,
  staff,
  canCustomizeLanding,
  canUseCustomDomain,
  customDomainState,
  listingDomain,
  portalPreviewUrl,
  serviceNames,
  website,
  showTax,
  w9Clients,
  attention = [],
}: AdminSettingsClientProps) {
  const [classicLandingEditor, setClassicLandingEditor] = useState(false);
  const router = useRouter();
  const liveBrand = usePortalBrand();
  const skipNextPropSync = useRef(false);
  const [section, setSection] = useState<SettingsSectionId>("identity");
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialSettings));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const colorWarnings = brandContrastWarnings(
    settings.business.brandPrimaryColor,
    settings.business.brandAccentColor
  );
  const savedSettings = JSON.parse(baseline) as AppSettings;
  const requestFormDirty =
    settings.proposals.autoPreliminaryEstimate !== savedSettings.proposals.autoPreliminaryEstimate;
  const travelDirty = JSON.stringify(settings.travel) !== JSON.stringify(savedSettings.travel);
  const tabAccent = sanitizeCssColor(settings.business.brandAccentColor, "#4F46E5");
  // New interface: Business Website is managed only under Sites → Business Website, so it is
  // left out of the Settings nav. Old links/hashes to it still hand off there (below).
  const inAppShell = useInAdminAppShell();
  const sections = visibleSettingsSections(showTax).filter(
    (s) => !inAppShell || s.id !== "landing"
  );

  useEffect(() => {
    if (skipNextPropSync.current) {
      skipNextPropSync.current = false;
      return;
    }
    setSettings(initialSettings);
    setBaseline(JSON.stringify(initialSettings));
  }, [initialSettings]);

  useEffect(() => {
    const applyHash = () => {
      const id = sectionForHash(readCleanHash());
      if (id && (id !== "tax" || showTax)) setSection(id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("portal:hash-target", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("portal:hash-target", applyHash);
    };
  }, [showTax]);

  useEffect(() => {
    setDirty(JSON.stringify(settings) !== baseline);
  }, [settings, baseline]);

  // Live preview: unsaved name, logo, colors and portal background show across the app as they
  // are edited. Compared with what the server last sent (not the save baseline), so right after
  // a save the preview holds until the refreshed page catches up, with no flash of the old look.
  const setBrandPreview = useSetBrandPreview();
  const shownSurface = parseSurfaceMode(settings.business.surfaceMode);
  const brandNow = JSON.stringify([getPortalBrandFromSettings(settings), shownSurface]);
  const brandFromServer = JSON.stringify([
    getPortalBrandFromSettings(initialSettings),
    parseSurfaceMode(initialSettings.business.surfaceMode),
  ]);
  const previewKey = brandNow === brandFromServer ? "" : brandNow;
  useEffect(() => {
    if (!previewKey) {
      setBrandPreview(null);
      return;
    }
    const [brand, surfaceMode] = JSON.parse(previewKey) as [
      NonNullable<BrandPreview>["brand"],
      SurfaceMode,
    ];
    setBrandPreview({ brand, surfaceMode });
  }, [previewKey, setBrandPreview]);
  useEffect(() => () => setBrandPreview(null), [setBrandPreview]);
  // Unsaved branding (vs. the save baseline) → the save bar says it's a preview.
  const brandUnsaved =
    JSON.stringify([getPortalBrandFromSettings(settings), shownSurface]) !==
    JSON.stringify([getPortalBrandFromSettings(savedSettings), parseSurfaceMode(savedSettings.business.surfaceMode)]);

  // New interface: the shell's sidebar is the Settings menu; tell it what to show.
  const selectRef = useRef<(id: SettingsSectionId) => void>(() => {});
  const navSections = sections.map((s) => `${s.id}:${s.label}`).join("|");
  const attentionKey = attention.join("|");
  useEffect(() => {
    if (!inAppShell) return;
    publishSettingsNav({
      sections: sections.map((s) => ({ id: s.id, label: s.label })),
      active: section,
      attention: attentionKey ? (attentionKey.split("|") as SettingsSectionId[]) : [],
      select: (id) => selectRef.current(id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inAppShell, navSections, section, attentionKey]);
  useEffect(() => (inAppShell ? () => publishSettingsNav(null) : undefined), [inAppShell]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function updateNotification(
    key: NotificationEventKey,
    channel: keyof NotificationChannelSettings,
    value: boolean
  ) {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: { ...prev.notifications[key], [channel]: value },
      },
    }));
  }

  async function saveSettings(nextSettings?: AppSettings) {
    const payload = nextSettings ?? settings;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings: payload }),
      });
      const data = await parseApiResponse(res);
      skipNextPropSync.current = true;
      setSettings(data.settings as AppSettings);
      setBaseline(JSON.stringify(data.settings));
      setDirty(false);
      toast.success("Settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function restorePlatformDefaults() {
    setRestoring(true);
    const restored = {
      ...settings,
      business: { ...PLATFORM_BUSINESS_DEFAULTS },
      email: { ...settings.email, ...PLATFORM_EMAIL_SENDER_DEFAULTS },
    };
    setSettings(restored);
    setRestoreOpen(false);
    await saveSettings(restored);
    setRestoring(false);
  }

  const patchEmail = useCallback((patch: Partial<AppSettings["email"]>) => {
    setSettings((prev) => ({ ...prev, email: { ...prev.email, ...patch } }));
  }, []);

  const patchBusiness = useCallback((patch: Partial<AppSettings["business"]>) => {
    setSettings((prev) => ({ ...prev, business: { ...prev.business, ...patch } }));
  }, []);

  const dismissLogoSuggestion = useCallback(async () => {
    const logoUrl = settings.business.logoUrl;
    patchBusiness({ logoSuggestionDismissedFor: logoUrl });
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { business: { logoSuggestionDismissedFor: logoUrl } },
        }),
      });
      if (!res.ok) throw new Error("Could not save");
    } catch {
      toast.error("Could not dismiss the suggestion. Try again.");
    }
  }, [patchBusiness, settings.business.logoUrl]);

  const patchIntegrations = useCallback((patch: Partial<AppSettings["integrations"]>) => {
    setSettings((prev) => ({
      ...prev,
      integrations: { ...prev.integrations, ...patch },
    }));
  }, []);

  const patchTravel = useCallback((travel: AppSettings["travel"]) => {
    setSettings((prev) => ({ ...prev, travel }));
  }, []);

  const patchProposals = useCallback((patch: Partial<AppSettings["proposals"]>) => {
    setSettings((prev) => ({ ...prev, proposals: { ...prev.proposals, ...patch } }));
  }, []);

  const patchPayments = useCallback((patch: Partial<AppSettings["payments"]>) => {
    setSettings((prev) => ({ ...prev, payments: { ...prev.payments, ...patch } }));
  }, []);

  const patchVideoSharing = useCallback((patch: Partial<AppSettings["videoSharing"]>) => {
    setSettings((prev) => ({ ...prev, videoSharing: { ...prev.videoSharing, ...patch } }));
  }, []);

  const patchMediaSectionDefaults = useCallback(
    (patch: Partial<AppSettings["mediaSectionDefaults"]>) => {
      setSettings((prev) => ({
        ...prev,
        mediaSectionDefaults: { ...prev.mediaSectionDefaults, ...patch },
      }));
    },
    []
  );

  const patchWorkflow = useCallback((workflow: AppSettings["workflow"]) => {
    setSettings((prev) => ({ ...prev, workflow }));
  }, []);

  const patchLanding = useCallback((landing: LandingSettings) => {
    setSettings((prev) => ({ ...prev, landing }));
  }, []);

  const patchWebsite = useCallback((next: AppSettings["website"]) => {
    setSettings((prev) => ({ ...prev, website: next }));
  }, []);

  const patchTax = useCallback((patch: Partial<AppSettings["tax"]>) => {
    setSettings((prev) => ({ ...prev, tax: { ...prev.tax, ...patch } }));
  }, []);

  function selectSection(id: SettingsSectionId) {
    if (id === "tax" && !showTax) return;
    setSection(id);
    const hash = sections.find((s) => s.id === id)?.hashes[0];
    if (hash) window.history.replaceState(null, "", `#${hash}`);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    selectRef.current = selectSection;
  });
  // Keep #settings-<section> in the URL for whichever section is showing (including one restored
  // on load), so the help menu's "Watch how" lesson matches the section on screen.
  useEffect(() => {
    const hash = sections.find((s) => s.id === section)?.hashes[0];
    if (!hash) return;
    const current = window.location.hash.replace(/^#/, "");
    const owned = sections.find((s) => s.id === section)?.hashes.some((h) => current === h || current.startsWith(`${h}-`));
    if (owned) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
    window.dispatchEvent(new Event("sp:location"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // New interface: the Business Website editor lives at Sites → Business Website. Settings
  // links/hashes to it hand off there so there is only ever one place it is edited.
  const redirectToSites = inAppShell && section === "landing";
  useEffect(() => {
    if (!redirectToSites) return;
    // Keep deep links into the editor (e.g. #settings-website-portfolio from settings search).
    const current = readCleanHash();
    const hash = /^settings-website-[a-z-]+$/.test(current) ? `#${current}` : "";
    router.replace(`/admin/sites/business${hash}`);
  }, [redirectToSites, router]);

  const isLandingEditor = section === "landing";
  const isTaxEditor = section === "tax" && showTax;

  const saveFooter = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm text-muted">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")}
          aria-hidden
        />
        {dirty ? (
          <span>
            <span className="font-semibold text-heading">You have unsaved changes.</span>
            {brandUnsaved ? (
              <span className="hidden sm:inline"> You&apos;re seeing a preview. Save to apply it for you and your clients.</span>
            ) : null}
          </span>
        ) : (
          "All changes saved."
        )}
      </p>
      <div className="flex items-center gap-2">
      {dirty && !saving ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setSettings(JSON.parse(baseline) as AppSettings)}
          className="min-h-11"
        >
          <Undo2 className="h-4 w-4" /> Discard
        </Button>
      ) : null}
      <Button
        variant="accent"
        onClick={() => saveSettings()}
        disabled={saving || !dirty}
        className="min-h-11 min-w-[140px]"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Save Settings
          </>
        )}
      </Button>
      </div>
    </div>
  );

  const tabCtx: SettingsTabCtx = {
    settings, setSettings, savedSettings, initialSettings, saving, dirty, brandUnsaved, requestFormDirty, travelDirty,
    colorWarnings, liveBrand, tabAccent, inAppShell, setRestoreOpen, saveSettings, updateNotification,
    patchEmail, patchBusiness, dismissLogoSuggestion, patchIntegrations, patchTravel, patchProposals, patchPayments,
    patchVideoSharing, patchMediaSectionDefaults, patchWorkflow, patchLanding, patchWebsite, patchTax, selectSection,
    notificationEvents, payments, services, staff, canCustomizeLanding, canUseCustomDomain, customDomainState,
    listingDomain, portalPreviewUrl, serviceNames, website, showTax, w9Clients, router, attention,
  };

  if (redirectToSites) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening Sites → Business Website…
      </div>
    );
  }

  if (isLandingEditor && !classicLandingEditor) {
    return (
      <BusinessWebsiteEditor
        settings={settings}
        savedSettings={savedSettings}
        services={website.services}
        siteUrl={website.siteUrl}
        websiteDomain={website.domain}
        onWebsiteChange={patchWebsite}
        onBusinessChange={patchBusiness}
        onPublishNow={() => {
          const next = { ...settings, website: { ...settings.website, launched: true } };
          setSettings(next);
          void saveSettings(next);
        }}
        onOpenClassicEditor={savedSettings.website.launched ? undefined : () => setClassicLandingEditor(true)}
        saving={saving}
        shellNav={
          <SettingsTabNav
            active={section}
            onChange={selectSection}
            accentColor={tabAccent}
            sections={sections}
            attention={attention}
          />
        }
        shellFooter={saveFooter}
      />
    );
  }

  if (isLandingEditor) {
    return (
      <>
        <LandingPageSettingsCard
          landing={settings.landing}
          baselineLanding={(JSON.parse(baseline) as AppSettings).landing ?? settings.landing}
          businessName={settings.business.businessName}
          serviceNames={serviceNames}
          portalPreviewUrl={portalPreviewUrl}
          canEdit={canCustomizeLanding}
          brand={liveBrand}
          onChange={patchLanding}
          shellNav={
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-subtle px-3 py-2 text-xs">
                <p className="text-muted">Editing the classic landing page (currently live).</p>
                <button type="button" className="mt-1 font-medium text-accent hover:underline" onClick={() => setClassicLandingEditor(false)}>
                  ← Back to Business Website
                </button>
              </div>
              <SettingsTabNav
                active={section}
                onChange={selectSection}
                accentColor={tabAccent}
                sections={sections}
                attention={attention}
              />
            </div>
          }
          shellFooter={saveFooter}
        />
        {restoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-heading">Restore platform defaults?</h3>
              <p className="mt-2 text-sm text-muted">
                This resets business name, portal name, contact info, logo URL, and brand colors to generic
                platform defaults and saves immediately.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" onClick={restorePlatformDefaults} disabled={restoring}>
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore & Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isTaxEditor) {
    return (
      <>
        <TaxInformationSettings
          tax={settings.tax}
          onChange={patchTax}
          clients={w9Clients}
          hideNavOnDesktop={inAppShell}
          nav={
            <SettingsTabNav
              active={section}
              onChange={selectSection}
              accentColor={tabAccent}
              sections={sections}
              attention={attention}
              mobileOnly={inAppShell}
            />
          }
          footer={saveFooter}
        />
        {restoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-heading">Restore platform defaults?</h3>
              <p className="mt-2 text-sm text-muted">
                This resets business name, portal name, contact info, logo URL, and brand colors to generic
                platform defaults and saves immediately.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" onClick={restorePlatformDefaults} disabled={restoring}>
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore & Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <SettingsTabProvider value={tabCtx}>
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className={cn("w-full shrink-0 md:sticky md:top-20 md:w-56", inAppShell && "md:hidden")}>
        <SettingsTabNav
          active={section}
          onChange={selectSection}
          accentColor={tabAccent}
          sections={sections}
          attention={attention}
        />
      </aside>

      <div className={cn("min-w-0 flex-1 space-y-4", inAppShell && "mx-auto w-full max-w-5xl")}>
        <SettingsPanel id="identity" active={section}>
          <IdentityTab />
        </SettingsPanel>

        <SettingsPanel id="branding" active={section}>
          <BrandingTab />
        </SettingsPanel>

        <SettingsPanel id="contact" active={section}>
          <ContactTab />
        </SettingsPanel>

        <SettingsPanel id="email" active={section}>
          <EmailSenderTab />
        </SettingsPanel>

        <SettingsPanel id="custom_domain" active={section}>
          <WebAddressTab />
        </SettingsPanel>

        <SettingsPanel id="marketing_kit" active={section}>
          <MarketingKitTab />
        </SettingsPanel>

        <SettingsPanel id="automated_emails" active={section}>
          <AutomatedEmailsTab />
        </SettingsPanel>

        <SettingsPanel id="payments" active={section}>
          <PaymentsTab />
        </SettingsPanel>

        <SettingsPanel id="new_project_setup" active={section}>
          <NewProjectSetupTab />
        </SettingsPanel>

        <SettingsPanel id="services" active={section}>
          <ServicesTab />
        </SettingsPanel>

        <SettingsPanel id="booking" active={section}>
          <BookingTab />
        </SettingsPanel>

        <SettingsPanel id="team" active={section}>
          <TeamAvailabilityTab />
        </SettingsPanel>

        <SettingsPanel id="team_pay" active={section}>
          <TeamPaySettings active={section === "team_pay"} />
        </SettingsPanel>

        <SettingsPanel id="workflow" active={section}>
          <WorkflowTab />
        </SettingsPanel>

        <SettingsPanel id="notifications" active={section}>
          <NotificationsTab />
        </SettingsPanel>

        <SettingsPanel id="integrations" active={section}>
          <IntegrationsTab />
        </SettingsPanel>

        <SettingsPanel id="staff" active={section}>
          {staff}
        </SettingsPanel>

        {restoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-heading">Restore platform defaults?</h3>
              <p className="mt-2 text-sm text-muted">
                This resets business name, portal name, contact info, logo URL, and brand colors to generic
                platform defaults and saves immediately.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" onClick={restorePlatformDefaults} disabled={restoring}>
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore & Save"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {section !== "staff" && section !== "team" && section !== "team_pay" ? (
          <div
            className={cn(
              "sticky bottom-0 z-30 -mx-4 border-t border-border bg-card/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 md:mx-0 md:rounded-2xl md:border md:px-5 md:py-3 max-md:[body[data-admin-pwa-nav]:not([data-admin-pwa-nav-off])_&]:bottom-[calc(var(--admin-pwa-nav-height)+env(safe-area-inset-bottom,0px))]",
              dirty ? "md:bottom-4 md:shadow-lg" : "md:static md:shadow-sm"
            )}
          >
            {saveFooter}
          </div>
        ) : null}
      </div>
    </div>
    </SettingsTabProvider>
  );
}
