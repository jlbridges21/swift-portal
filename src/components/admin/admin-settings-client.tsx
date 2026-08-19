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
import { WorkflowSettingsCard } from "@/components/admin/workflow-settings-card";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { PLATFORM_EMAIL_SENDER_DEFAULTS } from "@/lib/email-sender-policy";
import { brandContrastWarnings, deriveBrandTheme, sanitizeCssColor } from "@/lib/brand-color";
import { SETTINGS_SECTIONS, sectionForHash, type SettingsSectionId } from "@/lib/settings-nav";
import { usePortalBrand } from "@/components/brand/brand-provider";
import type {
  AppSettings,
  NotificationChannelSettings,
  NotificationEventKey,
} from "@/lib/app-settings";
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

export function AdminSettingsClient({ initialSettings, notificationEvents }: AdminSettingsClientProps) {
  const router = useRouter();
  const liveBrand = usePortalBrand();
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

  useEffect(() => {
    setSettings(initialSettings);
    setBaseline(JSON.stringify(initialSettings));
  }, [initialSettings]);

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

  return (
    <div className="space-y-4">
      <SettingsCollapsible
        title="Workflow Automation"
        description="Configure business actions — payments, proposals, scheduling, deliverables, and reminders."
        defaultOpen
      >
        <WorkflowSettingsCard workflow={settings.workflow} onChange={patchWorkflow} />
      </SettingsCollapsible>

      <SettingsCollapsible
        title="Notification Settings"
        description="Toggle delivery channels per event. Activity still logs when notifications are off."
      >
      <Card className="shadow-sm border-0">
        <CardContent className="p-0 sm:px-0 sm:pb-0">
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
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
                      index % 2 === 1 && "bg-slate-50/40"
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
                      <span className="text-xs text-muted">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </SettingsCollapsible>

      <SettingsCollapsible
        id="settings-email"
        title="Email Settings"
        description="Branding and sender details for client notification emails."
      >
      <Card className="shadow-sm border-0">
        <CardContent className="grid gap-4 sm:grid-cols-2 pt-0">
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
          <div className="space-y-2">
            <Label htmlFor="fromName">Default from name</Label>
            <Input id="fromName" value={settings.email.fromName} onChange={(e) => patchEmail({ fromName: e.target.value })} />
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
          <div className="space-y-2 sm:col-span-2">
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
      <EmailDiagnosticsCard />
      </SettingsCollapsible>

      <SettingsCollapsible
        id="settings-business"
        title="Business Settings"
        description="Portal branding used in the header, emails, and customer-facing copy."
        defaultOpen
      >
      <Card className="shadow-sm border-0">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-3 pt-0 px-0">
          <div />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setRestoreOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Restore platform defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-0 px-0">
          <div className="rounded-xl border border-border bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Live preview</p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shadow-sm"
                style={{ backgroundColor: settings.business.brandPrimaryColor }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.business.logoUrl} alt="" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="font-semibold text-primary">{settings.business.portalName}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{settings.business.businessName}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <span className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: settings.business.brandPrimaryColor }} title="Primary" />
                <span className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: settings.business.brandAccentColor }} title="Accent" />
              </div>
            </div>
            <p className="text-xs text-muted mt-3">
              Header currently shows: {liveBrand.portalName} · {liveBrand.name}
              {dirty ? " (save to apply changes)" : ""}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          <div id="settings-logo" tabIndex={-1} className="sm:col-span-2 scroll-mt-24">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" value={settings.business.supportEmail ?? ""} onChange={(e) => patchBusiness({ supportEmail: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name (copyright)</Label>
            <Input id="legalName" value={settings.business.legalName ?? ""} onChange={(e) => patchBusiness({ legalName: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={settings.business.tagline ?? ""} onChange={(e) => patchBusiness({ tagline: e.target.value })} />
          </div>
          <div id="settings-email-logo" tabIndex={-1} className="sm:col-span-2 scroll-mt-24">
            <BrandAssetField
              kind="emailLogo"
              inputId="emailLogoUrl"
              value={settings.business.emailLogoUrl ?? ""}
              onUrlChange={(emailLogoUrl) => patchBusiness({ emailLogoUrl })}
            />
          </div>
          <div id="settings-favicon" tabIndex={-1} className="sm:col-span-2 scroll-mt-24">
            <BrandAssetField
              kind="favicon"
              inputId="faviconUrl"
              value={settings.business.faviconUrl ?? ""}
              onUrlChange={(faviconUrl) => patchBusiness({ faviconUrl })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termsUrl">Terms URL</Label>
            <Input id="termsUrl" value={settings.business.termsUrl ?? ""} onChange={(e) => patchBusiness({ termsUrl: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacyUrl">Privacy URL</Label>
            <Input id="privacyUrl" value={settings.business.privacyUrl ?? ""} onChange={(e) => patchBusiness({ privacyUrl: e.target.value })} />
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
          <div id="settings-colors" tabIndex={-1} className="sm:col-span-2 grid gap-4 sm:grid-cols-2 scroll-mt-24">
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ghlWebhookUrl">GoHighLevel webhook URL</Label>
            <Input
              id="ghlWebhookUrl"
              value={settings.integrations?.ghlWebhookUrl ?? ""}
              onChange={(e) => patchIntegrations({ ghlWebhookUrl: e.target.value })}
              placeholder="https://…"
            />
            <p className="text-xs text-muted">
              Leave blank to skip GHL sync for this business. Swift uses the platform env var until a URL is saved.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ghlLeadSource">GHL lead source</Label>
            <Input
              id="ghlLeadSource"
              value={settings.integrations?.ghlLeadSource ?? ""}
              onChange={(e) => patchIntegrations({ ghlLeadSource: e.target.value })}
              placeholder="ShootPortal"
            />
          </div>
          </div>
        </CardContent>
      </Card>
      </SettingsCollapsible>

      <SettingsCollapsible
        title="Proposal Settings"
        description="Affects new projects and proposals going forward."
      >
      <Card className="shadow-sm border-0">
        <CardContent className="overflow-hidden rounded-xl border border-border p-0 pt-0 px-0">
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
      </SettingsCollapsible>

      {restoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-white/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 md:static md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
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
  );
}
