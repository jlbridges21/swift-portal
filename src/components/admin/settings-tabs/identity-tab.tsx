"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Info, Link2, RotateCcw } from "lucide-react";
import { SectionHeading, FieldHint, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function IdentityTab() {
  const { settings, setRestoreOpen, patchBusiness } = useSettingsTab();
  return (
    <>
          <div id="settings-business" tabIndex={-1} className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionHeading id="identity">Business Identity</SectionHeading>
                <p className="mt-1 text-sm text-muted">Name, portal title, legal copy, and public links.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 text-muted hover:text-heading"
                onClick={() => setRestoreOpen(true)}
              >
                <RotateCcw className="h-4 w-4" /> Restore platform defaults
              </Button>
            </div>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Building2 className="h-4 w-4" aria-hidden /> Names
                </p>
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <div id="settings-business-name" tabIndex={-1} className="space-y-2 scroll-mt-24">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input id="businessName" value={settings.business.businessName} onChange={(e) => patchBusiness({ businessName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portalName" className="inline-flex items-center gap-1.5">
                      Portal name <Info className="h-3.5 w-3.5 text-muted" aria-hidden />
                    </Label>
                    <Input id="portalName" value={settings.business.portalName} onChange={(e) => patchBusiness({ portalName: e.target.value })} aria-describedby="portalName-hint" />
                    <div id="portalName-hint">
                      <FieldHint>The name of your client portal, used when clients sign in and get welcome messages.</FieldHint>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminDisplayName" className="inline-flex items-center gap-1.5">
                      Admin display name <Info className="h-3.5 w-3.5 text-muted" aria-hidden />
                    </Label>
                    <Input id="adminDisplayName" value={settings.business.adminDisplayName} onChange={(e) => patchBusiness({ adminDisplayName: e.target.value })} aria-describedby="adminDisplayName-hint" />
                    <div id="adminDisplayName-hint">
                      <FieldHint>Shown to clients as the sender when you message them.</FieldHint>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalName" className="inline-flex items-center gap-1.5">
                      Legal name (copyright) <Info className="h-3.5 w-3.5 text-muted" aria-hidden />
                    </Label>
                    <Input id="legalName" value={settings.business.legalName ?? ""} onChange={(e) => patchBusiness({ legalName: e.target.value })} aria-describedby="legalName-hint" />
                    <div id="legalName-hint">
                      <FieldHint>Used in the © copyright line at the bottom of your pages.</FieldHint>
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" value={settings.business.tagline ?? ""} onChange={(e) => patchBusiness({ tagline: e.target.value })} />
                  </div>
                </div>
                <p className="mb-4 mt-7 flex items-center gap-2 border-t border-border pt-6 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Link2 className="h-4 w-4" aria-hidden /> Public links
                  <span className="font-normal normal-case tracking-normal">· optional</span>
                </p>
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="termsUrl">Terms URL</Label>
                    <Input id="termsUrl" value={settings.business.termsUrl ?? ""} placeholder="https://yourbusiness.com/terms" onChange={(e) => patchBusiness({ termsUrl: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="privacyUrl">Privacy URL</Label>
                    <Input id="privacyUrl" value={settings.business.privacyUrl ?? ""} placeholder="https://yourbusiness.com/privacy" onChange={(e) => patchBusiness({ privacyUrl: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
  );
}
