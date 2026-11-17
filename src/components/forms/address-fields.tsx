"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";

/**
 * Property address on the request forms. Street address suggests real addresses from Google as
 * the client types; picking one fills city, state and ZIP. Field names are unchanged
 * (street_address, city, state, zip_code), so the forms submit exactly as before.
 */
export function AddressFields({ idPrefix = "" }: { idPrefix?: string }) {
  const p = idPrefix ? `${idPrefix}_` : "";
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${p}street_address`}>Street Address *</Label>
        <AddressAutocomplete
          id={`${p}street_address`}
          name="street_address"
          required
          requirePick
          placeholder="Start typing the property address"
          value={street}
          onChange={setStreet}
          onPick={(a) => {
            setStreet(a.street || a.formatted);
            setCity(a.city);
            setState(a.state);
            setZip(a.zip);
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={`${p}city`}>City *</Label>
          <Input
            id={`${p}city`}
            name="city"
            required
            placeholder="Gulf Shores"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}state`}>State *</Label>
          <Input
            id={`${p}state`}
            name="state"
            required
            placeholder="AL"
            maxLength={2}
            autoComplete="address-level1"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}zip_code`}>ZIP Code *</Label>
          <Input
            id={`${p}zip_code`}
            name="zip_code"
            required
            placeholder="36542"
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
