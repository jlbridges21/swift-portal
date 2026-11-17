"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickedAddress = {
  placeId: string;
  formatted: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number | null;
  lng: number | null;
  timeZone: string | null;
};

type Suggestion = { placeId: string; main: string; secondary: string };

function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function placesPost(payload: Record<string, unknown>) {
  const res = await fetch("/api/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Address input with Google suggestions. Typing shows up to five matching addresses; picking one
 * returns the parsed address (street, city, state, ZIP). When suggestions are unavailable (no key,
 * Google down, rate limited) it is a plain text input.
 *
 * `requirePick`: until an address is picked from the list, the input reports a validation error
 * (blocks native form submit) unless the person chooses "Use the address as typed".
 */
export function AddressAutocomplete({
  value,
  onChange,
  onPick,
  requirePick = false,
  inputClassName,
  ...inputProps
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (address: PickedAddress) => void;
  requirePick?: boolean;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useRef(newSessionToken());
  const lastQuery = useRef("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // "picked": chose a suggestion; "typed": chose to keep their own text; "editing": neither yet.
  const [status, setStatus] = useState<"picked" | "typed" | "editing">(value ? "picked" : "editing");

  // Fetch suggestions as they type (debounced).
  useEffect(() => {
    if (unavailable || status !== "editing") return;
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      lastQuery.current = q;
      setLoading(true);
      const res = await placesPost({ action: "autocomplete", input: q, sessionToken: session.current }).catch(() => null);
      if (lastQuery.current !== q) return;
      setLoading(false);
      if (!res || res.body.unavailable) {
        setUnavailable(true);
        setSuggestions([]);
        return;
      }
      if (!res.ok) return; // rate limited: keep what we have
      const list = (res.body.suggestions as Suggestion[]) ?? [];
      setSuggestions(list);
      setActive(list.length ? 0 : -1);
      setOpen(true);
    }, 220);
    return () => clearTimeout(timer);
  }, [value, status, unavailable]);

  // Native validation: block submit until they pick (or explicitly keep what they typed).
  const mustPick = requirePick && !unavailable && status === "editing" && value.trim().length > 0;
  useEffect(() => {
    inputRef.current?.setCustomValidity(mustPick ? "Choose your address from the suggestions, or use it as typed." : "");
  }, [mustPick]);

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setLoading(true);
    const res = await placesPost({ action: "details", placeId: s.placeId, sessionToken: session.current }).catch(() => null);
    setLoading(false);
    session.current = newSessionToken();
    const address = res?.ok ? (res.body.address as PickedAddress | undefined) : undefined;
    if (!address) {
      // Details failed: keep the suggestion text, let them carry on.
      onChange(`${s.main}${s.secondary ? `, ${s.secondary}` : ""}`);
      setStatus("typed");
      return;
    }
    setStatus("picked");
    onPick(address);
  }

  function keepTyped() {
    setStatus("typed");
    setOpen(false);
    inputRef.current?.focus();
  }

  const showList = open && !unavailable && status === "editing" && value.trim().length >= 3;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          {...inputProps}
          ref={inputRef}
          value={value}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className={cn("pr-9", inputClassName)}
          onChange={(e) => {
            onChange(e.target.value);
            setStatus("editing");
            setOpen(true);
          }}
          onFocus={() => status === "editing" && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!showList || !suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              void pick(suggestions[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
      </div>

      {showList ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {suggestions.length ? (
            <ul id={listId} role="listbox" className="max-h-72 overflow-auto py-1">
              {suggestions.map((s, i) => (
                <li
                  key={s.placeId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void pick(s)}
                  className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", i === active ? "bg-accent-subtle" : "hover:bg-subtle")}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-heading">{s.main}</span>
                    {s.secondary ? <span className="block truncate text-xs text-muted">{s.secondary}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : !loading ? (
            <p className="px-3 py-2 text-sm text-muted">No matching addresses yet. Keep typing.</p>
          ) : null}
          {requirePick ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={keepTyped}
              className="block w-full border-t border-border px-3 py-2 text-left text-xs font-medium text-accent hover:bg-subtle"
            >
              Can&apos;t find it? Use &ldquo;{value.trim()}&rdquo; as typed
            </button>
          ) : null}
          <p className="border-t border-border px-3 py-1 text-right text-[10px] text-muted">Powered by Google</p>
        </div>
      ) : null}

      {mustPick && !open ? (
        <p className="mt-1 text-xs text-amber-700 surface-dark:text-amber-300">
          Choose your address from the list so we can find the property.{" "}
          <button type="button" className="font-medium underline" onClick={keepTyped}>
            Use it as typed
          </button>
        </p>
      ) : null}
    </div>
  );
}
