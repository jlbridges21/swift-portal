"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorField } from "@/components/ui/color-field";
import { SettingsTabNav } from "@/components/admin/settings-tab-nav";
import { BrandAssetField } from "@/components/admin/brand-asset-field";
import { EmailDiagnosticsCard } from "@/components/admin/email-diagnostics-card";
import { AcceptSetupDefaultButton } from "@/components/admin/accept-setup-default-button";
import { WorkflowSettingsCard } from "@/components/admin/workflow-settings-card";
import { EmailTemplatesSettingsCard } from "@/components/admin/email-templates-settings-card";
import { LandingPageSettingsCard } from "@/components/admin/landing-page-settings-card";
import { CustomDomainSettingsCard } from "@/components/admin/custom-domain-settings-card";
import type { CustomDomainPublicState } from "@/lib/custom-domain";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { PLATFORM_EMAIL_SENDER_DEFAULTS } from "@/lib/email-sender-policy";
import { BRAND } from "@/lib/brand";
import { brandContrastWarnings, deriveBrandTheme, sanitizeCssColor } from "@/lib/brand-color";
import { SETTINGS_SECTIONS, sectionForHash, type SettingsSectionId } from "@/lib/settings-nav";
import { usePortalBrand } from "@/components/brand/brand-provider";
import type {
  AppSettings,
  NotificationChannelSettings,
  NotificationEventKey,
} from "@/lib/app-settings";
import type { LandingSettings } from "@/lib/landing-content";
import type { ReactNode } from "react";

interface NotificationEventDef {
  key: NotificationEventKey;
  label: string;
  description: string;
  audience: "admin" | "client" | "both";
}

interface AdminSettingsClientProps {
  initialSettings: AppSettings;
  notificationEvents: NotificationEventDef[];
  payments: ReactNode;
  services: ReactNode;
  canCustomizeLanding: boolean;
  canUseCustomDomain: boolean;
  customDomainState: CustomDomainPublicState;
  portalPreviewUrl: string;
  serviceNames: string[];
}

async function parseApiResponse(res: Response): Promise<Record<string, unknown>> {
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

function DomainRecordsList({ refreshKey }: { refreshKey: string }) {
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
          <tr className="bg-slate-50 text-left text-muted">
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

function CompactToggle({
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
        "relative mx-auto flex h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

function RowToggle({
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
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 hover:bg-slate-50">
      <span className="text-sm text-foreground">{label}</span>
      <CompactToggle id={id} checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

function BrandSurfacePreview({
  primary,
  accent,
  portalName,
  businessName,
  logoUrl,
}: {
  primary: string;
  accent: string;
  portalName: string;
  businessName: string;
  logoUrl: string;
}) {
  const theme = deriveBrandTheme(primary, accent);
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
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg shadow-sm"
          style={{ backgroundColor: theme.primary }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
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
            Body copy on the tinted page — never the raw brand fill.
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
      className={selected ? "outline-none" : "hidden"}
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
  canCustomizeLanding,
  canUseCustomDomain,
  customDomainState,
  portalPreviewUrl,
  serviceNames,
}: AdminSettingsClientProps) {
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
  const tabAccent = sanitizeCssColor(settings.business.brandAccentColor, "#4F46E5");

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
      const id = sectionForHash(window.location.hash);
      if (id) setSection(id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("portal:hash-target", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("portal:hash-target", applyHash);
    };
  }, []);

  useEffect(() => {
    setDirty(JSON.stringify(settings) !== baseline);
  }, [settings, baseline]);

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

  const patchIntegrations = useCallback((patch: Partial<AppSettings["integrations"]>) => {
    setSettings((prev) => ({
      ...prev,
      integrations: { ...prev.integrations, ...patch },
    }));
  }, []);

  const patchProposals = useCallback((patch: Partial<AppSettings["proposals"]>) => {
    setSettings((prev) => ({ ...prev, proposals: { ...prev.proposals, ...patch } }));
  }, []);

  const patchWorkflow = useCallback((workflow: AppSettings["workflow"]) => {
    setSettings((prev) => ({ ...prev, workflow }));
  }, []);

  const patchLanding = useCallback((landing: LandingSettings) => {
    setSettings((prev) => ({ ...prev, landing }));
  }, []);

  function selectSection(id: SettingsSectionId) {
    setSection(id);
    const hash = SETTINGS_SECTIONS.find((s) => s.id === id)?.hashes[0];
    if (hash) window.history.replaceState(null, "", `#${hash}`);
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="w-full shrink-0 md:sticky md:top-20 md:w-56">
        <SettingsTabNav active={section} onChange={selectSection} accentColor={tabAccent} />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <SettingsPanel id="identity" active={section}>
          <div id="settings-business" tabIndex={-1} className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary">Business Identity</h2>
                <p className="mt-1 text-sm text-muted">Name, portal title, legal copy, and public links.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setRestoreOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Restore platform defaults
              </Button>
            </div>
            <Card className="shadow-sm">
              <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
                <div id="settings-business-name" tabIndex={-1} className="space-y-2 scroll-mt-24">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input id="businessName" value={settings.business.businessName} onChange={(e) => patchBusiness({ businessName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portalName">Portal name</Label>
                  <Input id="portalName" value={settings.business.portalName} onChange={(e) => patchBusiness({ portalName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminDisplayName">Admin display name</Label>
                  <Input id="adminDisplayName" value={settings.business.adminDisplayName} onChange={(e) => patchBusiness({ adminDisplayName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal name (copyright)</Label>
                  <Input id="legalName" value={settings.business.legalName ?? ""} onChange={(e) => patchBusiness({ legalName: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input id="tagline" value={settings.business.tagline ?? ""} onChange={(e) => patchBusiness({ tagline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termsUrl">Terms URL</Label>
                  <Input id="termsUrl" value={settings.business.termsUrl ?? ""} onChange={(e) => patchBusiness({ termsUrl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacyUrl">Privacy URL</Label>
                  <Input id="privacyUrl" value={settings.business.privacyUrl ?? ""} onChange={(e) => patchBusiness({ privacyUrl: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </div>
        </SettingsPanel>

        <SettingsPanel id="branding" active={section}>
          <h2 className="text-lg font-semibold text-primary">Branding &amp; Colors</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Logo, favicon, and brand colors used across the portal.</p>
          <Card className="shadow-sm">
            <CardContent className="space-y-6 pt-6">
              <BrandSurfacePreview
                primary={settings.business.brandPrimaryColor}
                accent={settings.business.brandAccentColor}
                portalName={settings.business.portalName}
                businessName={settings.business.businessName}
                logoUrl={settings.business.logoUrl}
              />
              <p className="text-xs text-muted">
                Header currently shows: {liveBrand.portalName} · {liveBrand.name}
                {dirty ? " (save to apply changes)" : ""}
              </p>
              <div id="settings-logo" tabIndex={-1} className="scroll-mt-24 space-y-2">
                <BrandAssetField
                  kind="logo"
                  inputId="logoUrl"
                  value={settings.business.logoUrl}
                  onUrlChange={(logoUrl) =>
                    patchBusiness({
                      logoUrl,
                      emailLogoUrl: settings.business.emailLogoUrl || logoUrl,
                    })
                  }
                />
                {(() => {
                  const logo = settings.business.logoUrl;
                  const stillDefault =
                    !logo ||
                    logo === PLATFORM_BUSINESS_DEFAULTS.logoUrl ||
                    logo === BRAND.logoUrl;
                  if (settings.setupAcceptedDefaults?.logo) {
                    return (
                      <p className="text-xs text-muted">
                        Using ShootPortal default logo until you upload your own.
                      </p>
                    );
                  }
                  if (!stillDefault) return null;
                  return <AcceptSetupDefaultButton acceptKey="logo" />;
                })()}
              </div>
              <div id="settings-email-logo" tabIndex={-1} className="scroll-mt-24">
                <BrandAssetField
                  kind="emailLogo"
                  inputId="emailLogoUrl"
                  value={settings.business.emailLogoUrl ?? ""}
                  onUrlChange={(emailLogoUrl) => patchBusiness({ emailLogoUrl })}
                />
              </div>
              <div id="settings-favicon" tabIndex={-1} className="scroll-mt-24">
                <BrandAssetField
                  kind="favicon"
                  inputId="faviconUrl"
                  value={settings.business.faviconUrl ?? ""}
                  onUrlChange={(faviconUrl) => patchBusiness({ faviconUrl })}
                />
              </div>
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    id="brandPrimaryColor"
                    label="Brand primary color"
                    value={settings.business.brandPrimaryColor}
                    fallback="#0F172A"
                    onChange={(v) => patchBusiness({ brandPrimaryColor: v })}
                    warning={colorWarnings.find((w) => w.field === "brandPrimaryColor")?.message}
                  />
                  <ColorField
                    id="brandAccentColor"
                    label="Brand accent color"
                    value={settings.business.brandAccentColor}
                    fallback="#3B82F6"
                    onChange={(v) => patchBusiness({ brandAccentColor: v })}
                    warning={colorWarnings.find((w) => w.field === "brandAccentColor")?.message}
                  />
                </div>
                {(() => {
                  const stillDefault =
                    settings.business.brandPrimaryColor ===
                      PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor &&
                    settings.business.brandAccentColor ===
                      PLATFORM_BUSINESS_DEFAULTS.brandAccentColor;
                  if (settings.setupAcceptedDefaults?.colors) {
                    return (
                      <p className="text-xs text-muted">
                        Using ShootPortal default colors until you change them.
                      </p>
                    );
                  }
                  if (!stillDefault) return null;
                  return <AcceptSetupDefaultButton acceptKey="colors" />;
                })()}
              </div>
            </CardContent>
          </Card>
        </SettingsPanel>

        <SettingsPanel id="landing" active={section}>
          <div id="settings-landing" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Client Landing Page</h2>
              <p className="mt-1 text-sm text-muted">
                Customize the public page at your portal URL. Plain text only — layout stays locked.
              </p>
            </div>
            <LandingPageSettingsCard
              landing={settings.landing}
              businessName={settings.business.businessName}
              serviceNames={serviceNames}
              portalPreviewUrl={portalPreviewUrl}
              canEdit={canCustomizeLanding}
              brand={liveBrand}
              onChange={patchLanding}
            />
          </div>
        </SettingsPanel>

        <SettingsPanel id="contact" active={section}>
          <h2 className="text-lg font-semibold text-primary">Contact Information</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Email, phone, website, and mailing address.</p>
          <Card className="shadow-sm">
            <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
              <div id="settings-contact" tabIndex={-1} className="space-y-2 scroll-mt-24">
                <Label htmlFor="primaryContactEmail">Primary contact email</Label>
                <Input id="primaryContactEmail" type="email" value={settings.business.primaryContactEmail} onChange={(e) => patchBusiness({ primaryContactEmail: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone number</Label>
                <Input id="phoneNumber" value={settings.business.phoneNumber} onChange={(e) => patchBusiness({ phoneNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input id="websiteUrl" value={settings.business.websiteUrl} onChange={(e) => patchBusiness({ websiteUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support email</Label>
                <Input id="supportEmail" type="email" value={settings.business.supportEmail ?? ""} onChange={(e) => patchBusiness({ supportEmail: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addressLine1">Address line 1</Label>
                <Input id="addressLine1" value={settings.business.addressLine1 ?? ""} onChange={(e) => patchBusiness({ addressLine1: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addressLine2">Address line 2</Label>
                <Input id="addressLine2" value={settings.business.addressLine2 ?? ""} onChange={(e) => patchBusiness({ addressLine2: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={settings.business.city ?? ""} onChange={(e) => patchBusiness({ city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={settings.business.state ?? ""} onChange={(e) => patchBusiness({ state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" value={settings.business.postalCode ?? ""} onChange={(e) => patchBusiness({ postalCode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={settings.business.country ?? ""} onChange={(e) => patchBusiness({ country: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </SettingsPanel>

        <SettingsPanel id="email" active={section}>
          <div id="settings-email" tabIndex={-1} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-primary">Email</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              How client emails are sent from your portal — sender name, domain, and a quick delivery check.
            </p>
            <Card className="shadow-sm">
              <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-medium text-primary">How mail is sent</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        className="mt-1"
                        checked={settings.email.senderMode !== "custom_domain"}
                        onChange={() =>
                          patchEmail({
                            senderMode: "platform",
                            senderEmail: "",
                          })
                        }
                      />
                      <span>
                        Platform (default) — clients see this business name on the shared sending domain.
                        Replies go to the contact address. No DNS setup.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        className="mt-1"
                        checked={settings.email.senderMode === "custom_domain"}
                        disabled={settings.email.domainVerificationStatus !== "verified"}
                        onChange={() => {
                          if (settings.email.domainVerificationStatus !== "verified") {
                            toast.error("Verify a custom domain before switching sender mode");
                            return;
                          }
                          patchEmail({ senderMode: "custom_domain" });
                        }}
                      />
                      <span>
                        Custom domain — only after DNS verification. Sender address must be on that domain.
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2" id="settings-from-name" tabIndex={-1}>
                  <Label htmlFor="fromName">Default from name</Label>
                  <Input
                    id="fromName"
                    value={settings.email.fromName}
                    onChange={(e) => patchEmail({ fromName: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="senderEmail">Notification sender email</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    value={settings.email.senderEmail}
                    disabled={settings.email.senderMode !== "custom_domain"}
                    onChange={(e) => patchEmail({ senderEmail: e.target.value })}
                  />
                  <p className="text-xs text-muted leading-relaxed">
                    Used only with a verified custom domain, and the address must be on that domain.
                    Platform mode always sends from the shared mailbox.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customDomain">Custom sending domain</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="customDomain"
                      value={settings.email.customDomain}
                      onChange={(e) => patchEmail({ customDomain: e.target.value })}
                      placeholder="mail.yourdomain.com"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/admin/email/domain", {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ domain: settings.email.customDomain }),
                          });
                          const data = await parseApiResponse(res);
                          if (data.settings) setSettings(data.settings as AppSettings);
                          toast.success("Add the DNS records below, then re-check verification");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Domain setup failed");
                        }
                      }}
                    >
                      Start verification
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/admin/email/domain/verify", {
                            method: "POST",
                            credentials: "include",
                          });
                          const data = await parseApiResponse(res);
                          if (data.settings) setSettings(data.settings as AppSettings);
                          toast.success(`Domain status: ${data.domainVerificationStatus}`);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Re-check failed");
                        }
                      }}
                    >
                      Re-check DNS
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    Status: {settings.email.domainVerificationStatus}
                  </p>
                  <DomainRecordsList refreshKey={`${settings.email.resendDomainId}:${settings.email.domainVerificationStatus}`} />
                </div>
                <div className="space-y-2 sm:col-span-2" id="settings-reply-to" tabIndex={-1}>
                  <Label htmlFor="replyTo">Reply-to email</Label>
                  <Input id="replyTo" type="email" value={settings.email.replyTo} onChange={(e) => patchEmail({ replyTo: e.target.value })} />
                  <p className="text-xs text-muted">
                    If empty, replies use the business primary contact email.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="footerText">Email footer text</Label>
                  <Textarea id="footerText" rows={3} value={settings.email.footerText} onChange={(e) => patchEmail({ footerText: e.target.value })} />
                </div>
              </CardContent>
            </Card>
            <div className="mt-4">
              <EmailDiagnosticsCard />
            </div>
          </div>
        </SettingsPanel>

        <SettingsPanel id="custom_domain" active={section}>
          <div id="settings-custom-domain" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Use your own web address</h2>
            <p className="mt-1 text-sm text-muted">
              Give clients a branded link like{" "}
              <span className="font-medium text-heading">portal.yourstudio.com</span> instead of a
              ShootPortal subdomain — so your portal feels like your business.
            </p>
            <CustomDomainSettingsCard entitled={canUseCustomDomain} initialState={customDomainState} />
          </div>
        </SettingsPanel>

        <SettingsPanel id="automated_emails" active={section}>
          <div id="settings-automated-emails" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Automated Emails</h2>
            <p className="mt-1 text-sm text-muted">
              Edit the subject and body for emails your clients receive. Timing and channel toggles stay under
              Workflow Automation and Notifications.
            </p>
            <EmailTemplatesSettingsCard
              workflow={settings.workflow}
              onChange={patchWorkflow}
              portalName={settings.business.portalName}
              businessName={settings.business.businessName}
            />
          </div>
        </SettingsPanel>

        <SettingsPanel id="payments" active={section}>
          <div id="settings-payments" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Payments</h2>
            <p className="mt-1 mb-4 text-sm text-muted">Connect your Stripe account so clients pay you directly.</p>
            {payments}
            {!settings.setupAcceptedDefaults?.stripe ? (
              <AcceptSetupDefaultButton acceptKey="stripe" />
            ) : (
              <p className="text-xs text-muted">
                You chose to connect payments later. Client invoices stay unavailable until Stripe is connected.
              </p>
            )}
          </div>
        </SettingsPanel>

        <SettingsPanel id="services" active={section}>
          <div id="settings-services" tabIndex={-1} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-primary">Services</h2>
            <p className="mt-1 mb-4 text-sm text-muted">Catalog and preliminary estimate prices for this business.</p>
            {services}
          </div>
        </SettingsPanel>

        <SettingsPanel id="workflow" active={section}>
          <div id="settings-workflow" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Workflow Automation</h2>
            <p className="mt-1 text-sm text-muted">Stage actions, reminders, and proposal defaults.</p>
            <WorkflowSettingsCard workflow={settings.workflow} onChange={patchWorkflow} />
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Proposal Settings</CardTitle>
                <p className="text-sm text-muted">Affects new projects and proposals going forward.</p>
              </CardHeader>
              <CardContent className="overflow-hidden rounded-xl border border-border p-0">
                <div className="divide-y divide-border">
                  <RowToggle
                    id="autoPreliminaryEstimate"
                    label="Automatically create preliminary estimate on new request"
                    checked={settings.proposals.autoPreliminaryEstimate}
                    onChange={(v) => patchProposals({ autoPreliminaryEstimate: v })}
                  />
                  <RowToggle
                    id="requireAdminReview"
                    label="Require admin review before official proposal is sent"
                    checked={settings.proposals.requireAdminReviewBeforeOfficial}
                    onChange={(v) => patchProposals({ requireAdminReviewBeforeOfficial: v })}
                  />
                  <RowToggle
                    id="showPreliminary"
                    label="Show preliminary estimate to clients"
                    checked={settings.proposals.showPreliminaryToClients}
                    onChange={(v) => patchProposals({ showPreliminaryToClients: v })}
                  />
                  <RowToggle
                    id="allowChanges"
                    label="Allow clients to request proposal changes"
                    checked={settings.proposals.allowClientProposalChanges}
                    onChange={(v) => patchProposals({ allowClientProposalChanges: v })}
                  />
                </div>
                <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="estimateExpiration">Default estimate expiration (days)</Label>
                    <Input
                      id="estimateExpiration"
                      type="number"
                      min={0}
                      value={settings.proposals.defaultEstimateExpirationDays}
                      onChange={(e) => patchProposals({ defaultEstimateExpirationDays: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposalExpiration">Default proposal expiration (days)</Label>
                    <Input
                      id="proposalExpiration"
                      type="number"
                      min={0}
                      value={settings.proposals.defaultProposalExpirationDays}
                      onChange={(e) => patchProposals({ defaultProposalExpirationDays: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="preliminaryDisclaimer">Preliminary estimate disclaimer</Label>
                    <Textarea
                      id="preliminaryDisclaimer"
                      rows={4}
                      value={settings.proposals.preliminaryDisclaimer}
                      onChange={(e) => patchProposals({ preliminaryDisclaimer: e.target.value })}
                    />
                    <p className="text-xs text-muted">Use {"{{businessName}}"} — it is replaced when the estimate is shown.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SettingsPanel>

        <SettingsPanel id="notifications" active={section}>
          <div id="settings-notifications" tabIndex={-1} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-primary">Notifications</h2>
            <p className="mt-1 mb-4 text-sm text-muted">Toggle delivery channels per event. Activity still logs when notifications are off.</p>
            <Card className="shadow-sm">
              <CardContent className="p-0 sm:p-0">
                <div className="hidden overflow-hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Event</th>
                        <th className="w-20 px-2 py-3 text-center">In-app</th>
                        <th className="w-20 px-2 py-3 text-center">Email</th>
                        <th className="w-20 px-2 py-3 text-center">Push</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationEvents.map((event, index) => (
                        <tr
                          key={event.key}
                          className={cn(
                            "border-b border-border/70 last:border-0",
                            index % 2 === 1 && "bg-subtle/40"
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-primary leading-snug">{event.label}</p>
                            <p className="text-[11px] text-muted leading-snug mt-0.5">{event.description}</p>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <CompactToggle
                              id={`${event.key}-inapp-d`}
                              label={`${event.label} in-app`}
                              checked={settings.notifications[event.key].inApp}
                              onChange={(v) => updateNotification(event.key, "inApp", v)}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <CompactToggle
                              id={`${event.key}-email-d`}
                              label={`${event.label} email`}
                              checked={settings.notifications[event.key].email}
                              onChange={(v) => updateNotification(event.key, "email", v)}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            {event.audience === "admin" || event.audience === "both" ? (
                              <CompactToggle
                                id={`${event.key}-push-d`}
                                label={`${event.label} push`}
                                checked={settings.notifications[event.key].push}
                                onChange={(v) => updateNotification(event.key, "push", v)}
                              />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-border md:hidden">
                  {notificationEvents.map((event) => (
                    <div key={`mobile-${event.key}`} className="px-4 py-3">
                      <p className="text-sm font-medium text-primary">{event.label}</p>
                      <p className="text-xs text-muted mt-0.5 mb-2">{event.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-muted">
                        <div>
                          <p className="mb-1">In-app</p>
                          <CompactToggle
                            id={`${event.key}-inapp-m`}
                            label={`${event.label} in-app`}
                            checked={settings.notifications[event.key].inApp}
                            onChange={(v) => updateNotification(event.key, "inApp", v)}
                          />
                        </div>
                        <div>
                          <p className="mb-1">Email</p>
                          <CompactToggle
                            id={`${event.key}-email-m`}
                            label={`${event.label} email`}
                            checked={settings.notifications[event.key].email}
                            onChange={(v) => updateNotification(event.key, "email", v)}
                          />
                        </div>
                        <div>
                          <p className="mb-1">Push</p>
                          {event.audience === "admin" || event.audience === "both" ? (
                            <CompactToggle
                              id={`${event.key}-push-m`}
                              label={`${event.label} push`}
                              checked={settings.notifications[event.key].push}
                              onChange={(v) => updateNotification(event.key, "push", v)}
                            />
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </SettingsPanel>

        <SettingsPanel id="integrations" active={section}>
          <div id="settings-integrations" tabIndex={-1} className="scroll-mt-24 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Integrations</h2>
            <p className="mt-1 text-sm text-muted">GoHighLevel.</p>
            <Card className="shadow-sm">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="ghlWebhookUrl">GoHighLevel inbound webhook URL</Label>
                  <Input
                    id="ghlWebhookUrl"
                    value={settings.integrations?.ghlWebhookUrl ?? ""}
                    onChange={(e) => patchIntegrations({ ghlWebhookUrl: e.target.value })}
                    placeholder="https://…"
                  />
                  <p className="text-xs text-muted">
                    Paste your GoHighLevel inbound webhook URL to sync new project requests into GHL.
                    Leave blank to skip.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ghlLeadSource">Lead source label in GoHighLevel</Label>
                  <Input
                    id="ghlLeadSource"
                    value={settings.integrations?.ghlLeadSource ?? ""}
                    onChange={(e) => patchIntegrations({ ghlLeadSource: e.target.value })}
                    placeholder="ShootPortal"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </SettingsPanel>

        {restoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-primary">Restore platform defaults?</h3>
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

        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-card/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 md:static md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
            <Button variant="accent" onClick={() => saveSettings()} disabled={saving || !dirty} className="min-h-11 min-w-[140px]">
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
      </div>
    </div>
  );
}
