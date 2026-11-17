"use client";

import { useState, useSyncExternalStore } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { NativeSelect } from "@/components/admin/booking/booking-ui";
import { COMMON_TIME_ZONES, timeZoneName } from "@/lib/us-time-zones";

const noopSubscribe = () => () => {};

export function ContactTab() {
  const { settings, setSettings, patchBusiness, website } = useSettingsTab();
  const [zoneNote, setZoneNote] = useState<string | null>(null);
  const timeZone = settings.workflow.businessDefaults.timezone || "America/New_York";
  const setTimeZone = (zone: string) =>
    setSettings((prev) => ({
      ...prev,
      workflow: { ...prev.workflow, businessDefaults: { ...prev.workflow.businessDefaults, timezone: zone } },
    }));
  // Device zone, read after hydration (null on the server render).
  const browserZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null
  );
  return (
    <>
          <SectionHeading id="contact">Contact Information</SectionHeading>
          <p className="mt-1 mb-4 text-sm text-muted">Email, phone, website, business address and time zone.</p>
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
                <AddressAutocomplete
                  id="addressLine1"
                  value={settings.business.addressLine1 ?? ""}
                  placeholder="Start typing your business address"
                  onChange={(v) => patchBusiness({ addressLine1: v })}
                  onPick={(a) => {
                    patchBusiness({
                      addressLine1: a.street || a.formatted,
                      city: a.city,
                      state: a.state,
                      postalCode: a.zip,
                      country: a.country || settings.business.country,
                    });
                    if (a.timeZone && a.timeZone !== timeZone) {
                      setTimeZone(a.timeZone);
                      setZoneNote(`Time zone set to ${timeZoneName(a.timeZone)} from this address. Save to apply.`);
                    }
                  }}
                />
                <p className="text-xs text-muted">Used for travel fees, drive times and your time zone. Pick it from the suggestions.</p>
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
              <div id="settings-timezone" className="space-y-2 sm:col-span-2 scroll-mt-24">
                <Label htmlFor="businessTimeZone">Time zone</Label>
                <NativeSelect
                  id="businessTimeZone"
                  ariaLabel="Business time zone"
                  value={timeZone}
                  onChange={(v) => {
                    setTimeZone(v);
                    setZoneNote(null);
                  }}
                  options={(COMMON_TIME_ZONES.some((z) => z.id === timeZone)
                    ? COMMON_TIME_ZONES
                    : [{ id: timeZone, label: timeZoneName(timeZone) }, ...COMMON_TIME_ZONES]
                  ).map((z) => ({ value: z.id, label: `${z.label} (${z.id})` }))}
                />
                <p className="text-xs text-muted">
                  Your calendar, booking times, reminders and Google events use this time zone.
                  {zoneNote ? <span className="ml-1 font-medium text-accent">{zoneNote}</span> : null}
                  {!zoneNote && browserZone && browserZone !== timeZone && COMMON_TIME_ZONES.some((z) => z.id === browserZone) ? (
                    <>
                      {" "}
                      This device is on {timeZoneName(browserZone)}.{" "}
                      <button type="button" className="font-medium text-accent underline" onClick={() => setTimeZone(browserZone)}>
                        Use {timeZoneName(browserZone)}
                      </button>
                    </>
                  ) : null}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
  );
}
