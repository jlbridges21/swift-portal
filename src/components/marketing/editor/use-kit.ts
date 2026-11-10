"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mergeContent, type AssetRef, type MarketingContent, type MarketingOverrides } from "@/lib/marketing/model";
import type { KitClientState } from "@/lib/marketing/server";
import type { UrlResolver } from "@/lib/marketing/view-model";

export type SaveState = "saved" | "dirty" | "saving" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

/** Remove keys equal to the project-derived default so drafts keep following the project. */
function prune(overrides: MarketingOverrides, defaults: MarketingContent): MarketingOverrides {
  const out: MarketingOverrides = {};
  for (const group of ["property", "agent", "branding", "media", "website", "social"] as const) {
    const o = overrides[group] as Record<string, unknown> | undefined;
    if (!o) continue;
    const d = defaults[group] as unknown as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (JSON.stringify(v) !== JSON.stringify(d[k])) kept[k] = v;
    }
    if (Object.keys(kept).length) (out as Record<string, unknown>)[group] = kept;
  }
  return out;
}

export function editorUrls(state: KitClientState): UrlResolver {
  const base = `/api/marketing/${state.projectId}`;
  const posters = new Map(state.media.map((m) => [m.id, m]));
  return {
    image: (ref: AssetRef, size) =>
      ref.kind === "media"
        ? `${base}/img/${ref.id}?s=${size}`
        : ref.kind === "upload"
          ? `${base}/img/u?p=${encodeURIComponent(ref.path)}&s=${size}`
          : state.businessLogoUrl,
    video: (id) => `${base}/video/${id}`,
    poster: (id) => {
      const m = posters.get(id);
      if (!m) return null;
      return m.source === "youtube" ? m.posterUrl : `${base}/img/${id}?s=medium`;
    },
  };
}

export function useKit(initial: KitClientState, urlFactory: (state: KitClientState) => UrlResolver = editorUrls) {
  const [state, setState] = useState(initial);
  const [overrides, setOverrides] = useState<MarketingOverrides>(initial.overrides ?? {});
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef<MarketingOverrides | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const canEdit = state.permissions.canEdit;

  const content = useMemo(() => mergeContent(state.defaults, overrides), [state.defaults, overrides]);
  const urls = useMemo(() => urlFactory(state), [state, urlFactory]);

  const failures = useRef(0);
  const flush = useCallback(async () => {
    if (inflight.current || !pending.current) return;
    const body = pending.current;
    pending.current = null;
    inflight.current = true;
    setSaveState("saving");
    let retryIn: number | null = null;
    try {
      const data = await api<{ state: KitClientState }>(`/api/marketing/${initial.projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ overrides: body }),
      });
      failures.current = 0;
      // Keep local edits made while saving; take everything else from the server.
      setState((prev) => ({ ...data.state, defaults: data.state.defaults ?? prev.defaults }));
      setSaveState(pending.current ? "dirty" : "saved");
      if (pending.current) retryIn = 300;
    } catch (e) {
      pending.current = pending.current ?? body;
      setSaveState("error");
      const status = (e as { status?: number }).status ?? 0;
      failures.current += 1;
      // Only the first failure in a row toasts. Permanent errors (4xx) wait for the next edit;
      // network/server errors retry with backoff (2s, 4s, 8s … up to 30s).
      if (failures.current === 1) toast.error(e instanceof Error ? e.message : "Couldn't save your changes");
      if (status === 0 || status >= 500) retryIn = Math.min(30_000, 1000 * 2 ** failures.current);
    } finally {
      inflight.current = false;
      if (retryIn != null && pending.current) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), retryIn);
      }
    }
  }, [initial.projectId]);

  const update = useCallback(
    (fn: (o: MarketingOverrides) => MarketingOverrides) => {
      if (!canEdit) return;
      setOverrides((prev) => {
        const next = prune(fn(structuredClone(prev)), state.defaults);
        pending.current = next;
        return next;
      });
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [canEdit, flush, state.defaults]
  );

  // Warn before leaving with unsaved edits; flush on hide.
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (pending.current || inflight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHide = () => {
      if (pending.current) {
        void fetch(`/api/marketing/${initial.projectId}`, {
          method: "PATCH",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: pending.current }),
        });
        pending.current = null;
      }
    };
    window.addEventListener("beforeunload", onBefore);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      window.removeEventListener("pagehide", onHide);
    };
  }, [initial.projectId]);

  const action = useCallback(
    async (name: string, body: Record<string, unknown> = {}, okMessage?: string) => {
      setBusy(name);
      try {
        if (pending.current) {
          if (timer.current) clearTimeout(timer.current);
          await flush();
        }
        const data = await api<{ state: KitClientState }>(`/api/marketing/${initial.projectId}`, {
          method: "POST",
          body: JSON.stringify({ action: name, ...body }),
        });
        setState(data.state);
        setOverrides(data.state.overrides ?? {});
        if (okMessage) toast.success(okMessage);
        return data.state;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [flush, initial.projectId]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ state: KitClientState }>(`/api/marketing/${initial.projectId}`);
      setState(data.state);
      return data.state;
    } catch {
      return null;
    }
  }, [initial.projectId]);

  const upload = useCallback(
    async (file: File, kind: "logo" | "headshot"): Promise<AssetRef | null> => {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      setBusy(`upload-${kind}`);
      try {
        const res = await fetch(`/api/marketing/${initial.projectId}/upload`, { method: "POST", body: form, credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as { ref?: AssetRef; error?: string };
        if (!res.ok || !data.ref) throw new Error(data.error || "Upload failed");
        return data.ref;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [initial.projectId]
  );

  return { state, setState, overrides, content, urls, update, saveState, busy, action, refresh, upload, api };
}

export type KitApi = ReturnType<typeof useKit>;
export { api as kitFetch };
