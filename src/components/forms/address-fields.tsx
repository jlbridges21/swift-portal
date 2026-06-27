"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddressFields({ idPrefix = "" }: { idPrefix?: string }) {
  const p = idPrefix ? `${idPrefix}_` : "";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${p}street_address`}>Street Address *</Label>
        <Input
          id={`${p}street_address`}
          name="street_address"
          required
          placeholder="123 Main Street"
          autoComplete="street-address"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={`${p}city`}>City *</Label>
          <Input id={`${p}city`} name="city" required placeholder="Gulf Shores" autoComplete="address-level2" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}state`}>State *</Label>
          <Input id={`${p}state`} name="state" required placeholder="AL" maxLength={2} autoComplete="address-level1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}zip_code`}>ZIP Code *</Label>
          <Input id={`${p}zip_code`} name="zip_code" required placeholder="36542" autoComplete="postal-code" />
        </div>
      </div>
    </div>
  );
}
