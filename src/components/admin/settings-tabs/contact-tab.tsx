"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function ContactTab() {
  const { settings, patchBusiness, website } = useSettingsTab();
  return (
    <>
          <SectionHeading id="contact">Contact Information</SectionHeading>
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
        </>
  );
}
