"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Calculator state that survives reloads and can be shared:
 * - URL (?s=…) wins when present, so a shared link opens the same scenario.
 * - Otherwise the last state from localStorage (versioned key), else defaults.
 * State is only stored in this browser and the URL; nothing is sent to a server.
 * Not for personal data: the quote builder uses localStorage only (never the URL).
 */

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode<T>(s: string): T | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64)))) as T;
  } catch {
    return null;
  }
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: state still works for this visit */
  }
}

export function useToolState<T extends object>(opts: {
  storageKey: string;
  defaults: T;
  sanitize: (v: T) => T;
  /** Mirror state in the URL for sharing. Off for anything that could hold personal data. */
  urlState?: boolean;
}) {
  const { storageKey, defaults, sanitize, urlState = true } = opts;
  // Server render and first client render use defaults (no hydration mismatch); saved or
  // shared state is applied right after mount.
  const [state, setRawState] = useState<T>(defaults);
  const [restored, setRestored] = useState(false);
  const timer = useRef<number | null>(null);
  // Only persist after the visitor changes something, so a first visit keeps a clean URL.
  const dirty = useRef(false);
  const setState: typeof setRawState = useCallback((v) => {
    dirty.current = true;
    setRawState(v);
  }, []);

  useEffect(() => {
    const fromUrl = urlState ? new URLSearchParams(window.location.search).get("s") : null;
    const candidate = (fromUrl ? decode<T>(fromUrl) : null) ?? readStorage<T>(storageKey);
    if (candidate && typeof candidate === "object") {
      try {
        setRawState(sanitize({ ...defaults, ...candidate }));
      } catch {
        /* ignore malformed saved state */
      }
    }
    setRestored(true);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored || !dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      writeStorage(storageKey, state);
      if (urlState) {
        const url = new URL(window.location.href);
        url.searchParams.set("s", encode(state));
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, restored, storageKey, urlState]);

  const reset = useCallback(() => {
    dirty.current = false;
    setRawState(defaults);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    if (urlState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [defaults, storageKey, urlState]);

  const shareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", encode(state));
    return url.toString();
  }, [state]);

  return { state, setState, reset, shareUrl, restored };
}
