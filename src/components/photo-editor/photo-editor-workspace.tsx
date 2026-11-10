"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  CloudCheck,
  Copy,
  Eye,
  History,
  Info,
  Loader2,
  Monitor,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { cn } from "@/lib/utils";
import {
  settingsEqual,
  stableStringify,
  type PhotoEditorPhoto,
  type PhotoEditorSessionPayload,
} from "@/lib/photo-editor/shared";
import {
  LightCraftEngine,
  LightCraftError,
  PER_PHOTO_SETTING_KEYS,
  type LightCraftSettings,
} from "./lightcraft-bridge";
import { restorePhotoVersion, saveEditedPhoto } from "./save-to-project";
import { PhotoVersionHistory } from "./photo-version-history";

/**
 * store=memory: nothing (photos, thumbnails, library) is ever written to this browser's storage,
 * so a shared computer can't expose one business's photos to the next user.
 * workers=0: LightCraft's render workers read originals from browser storage, which memory mode
 * doesn't have — rendering inline is the supported fallback and keeps the preview correct.
 * (Previews are capped at 2560 px, so inline renders stay bounded.)
 */
const ENGINE_URL = "/lightcraft/index.html?host=parent&store=memory&workers=0";
const POLL_MS = 700;
const AUTOSAVE_DEBOUNCE_MS = 900;

type EngineState = "starting" | "ready" | "failed";
type DraftSync = "idle" | "pending" | "saving" | "error";

/** Live per-photo editor state (kept in a ref; a version counter re-renders the UI). */
interface PhotoRuntime {
  engineId: number | null;
  loading: Promise<number> | null;
  error: string | null;
  /** Engine-normalized settings of a photo with no adjustments. */
  pristine: LightCraftSettings | null;
  /** Engine-normalized settings currently delivered to the project. */
  baseline: LightCraftSettings | null;
  /** Latest settings read from the engine. */
  current: LightCraftSettings | null;
  /** Server draft as last persisted (null = no unsaved progress on the server). */
  draft: LightCraftSettings | null;
  sync: DraftSync;
  lastPolled: string | null;
  previewUrl: string | null;
}

/** What the UI renders for a photo — a snapshot of its runtime, refreshed by syncView(). */
interface PhotoView {
  loaded: boolean;
  error: string | null;
  unpublished: boolean;
  sync: DraftSync;
  previewUrl: string | null;
  hasCurrent: boolean;
  pristine: boolean;
}

function viewOf(r: PhotoRuntime): PhotoView {
  const loaded = r.engineId != null;
  return {
    loaded,
    error: r.error,
    unpublished: loaded ? Boolean(r.baseline && r.current && !settingsEqual(r.current, r.baseline)) : Boolean(r.draft),
    sync: r.sync,
    previewUrl: r.previewUrl,
    hasCurrent: Boolean(r.current),
    pristine: Boolean(r.current && r.pristine && settingsEqual(r.current, r.pristine)),
  };
}

type SaveItem = { id: string; name: string; status: "queued" | "saving" | "saved" | "failed"; error?: string; step?: string };

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function stripPerPhoto(settings: LightCraftSettings): LightCraftSettings {
  const copy: LightCraftSettings = { ...settings };
  for (const key of PER_PHOTO_SETTING_KEYS) delete copy[key];
  return copy;
}

export function PhotoEditorWorkspace({ sessionId, canEdit }: { sessionId: string; canEdit: boolean }) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const engineRef = useRef<LightCraftEngine | null>(null);
  const runtimeRef = useRef(new Map<string, PhotoRuntime>());
  const prefetchRef = useRef(new Map<string, Promise<ArrayBuffer>>());
  const autosaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [views, setViews] = useState<Record<string, PhotoView>>({});

  const [session, setSession] = useState<PhotoEditorSessionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [engineState, setEngineState] = useState<EngineState>("starting");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [device, setDevice] = useState<"ok" | "small" | "unsupported" | null>(null);
  const [proceedOnSmall, setProceedOnSmall] = useState(false);
  const [clipboard, setClipboard] = useState<LightCraftSettings | null>(null);
  const [menu, setMenu] = useState<{ anchor: ActionMenuAnchor; items: ActionMenuItem[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saveItems, setSaveItems] = useState<SaveItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const leavingRef = useRef(false);

  const photos = useMemo(() => session?.photos ?? [], [session]);
  const activeIndex = photos.findIndex((p) => p.id === activeId);
  const activePhoto = activeIndex >= 0 ? photos[activeIndex] : null;

  const rt = useCallback((id: string): PhotoRuntime => {
    let r = runtimeRef.current.get(id);
    if (!r) {
      r = {
        engineId: null,
        loading: null,
        error: null,
        pristine: null,
        baseline: null,
        current: null,
        draft: null,
        sync: "idle",
        lastPolled: null,
        previewUrl: null,
      };
      runtimeRef.current.set(id, r);
    }
    return r;
  }, []);

  const syncView = useCallback((id: string) => {
    const r = runtimeRef.current.get(id);
    if (!r) return;
    const view = viewOf(r);
    setViews((prev) => ({ ...prev, [id]: view }));
  }, []);

  // ---------------------------------------------------------------- device + session
  useEffect(() => {
    const small = window.innerWidth < 900 || window.matchMedia("(pointer: coarse)").matches;
    setDevice(!supportsWebGL2() ? "unsupported" : small ? "small" : "ok");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media/editor/sessions/${sessionId}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503 && data.setupRequired) {
          setSetupRequired(true);
          return;
        }
        if (!res.ok) throw new Error(data.error || "This editing session couldn't be opened.");
        const payload = data as PhotoEditorSessionPayload;
        if (!payload.photos.length) throw new Error("These photos are no longer available.");
        const initial: Record<string, PhotoView> = {};
        for (const p of payload.photos) {
          const r = rt(p.id);
          r.draft = p.draft?.settings ?? null;
          initial[p.id] = viewOf(r);
        }
        setViews(initial);
        setSession(payload);
        const start = payload.photos.some((p) => p.id === payload.activeMediaId) ? payload.activeMediaId : payload.photos[0].id;
        setActiveId(start);
        if (payload.missingCount > 0) {
          toast.message(
            `${payload.missingCount} photo${payload.missingCount === 1 ? " is" : "s are"} no longer available and ${
              payload.missingCount === 1 ? "was" : "were"
            } left out.`
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "This editing session couldn't be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, rt]);

  // ---------------------------------------------------------------- engine lifecycle
  const engineWanted = Boolean(session) && (device === "ok" || (device === "small" && proceedOnSmall));

  useEffect(() => {
    if (!engineWanted) return;
    const frame = frameRef.current;
    if (!frame) return;
    const engine = new LightCraftEngine(frame);
    engineRef.current = engine;
    const offFail = engine.onFailure((message) => {
      setEngineState("failed");
      setEngineError(message);
    });
    let cancelled = false;
    (async () => {
      try {
        await engine.ready();
        if (cancelled) return;
        await engine.configureWorkspace();
        await engine.clearLibrary();
        setEngineState("ready");
      } catch (err) {
        if (cancelled) return;
        setEngineState("failed");
        setEngineError(err instanceof Error ? err.message : "The photo editor couldn't start.");
      }
    })();
    return () => {
      cancelled = true;
      offFail();
      engine.dispose();
      engineRef.current = null;
    };
  }, [engineWanted]);

  // ---------------------------------------------------------------- photo loading
  const fetchSourceBytes = useCallback(async (photo: PhotoEditorPhoto): Promise<ArrayBuffer> => {
    const cached = prefetchRef.current.get(photo.id);
    if (cached) {
      prefetchRef.current.delete(photo.id);
      try {
        return await cached;
      } catch {
        /* fall through and retry */
      }
    }
    const res = await fetch(`/api/media/editor/photos/${photo.id}/source`, { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "This photo couldn't be loaded.");
    const file = await fetch(data.url as string);
    if (!file.ok) throw new Error("This photo couldn't be downloaded. Please try again.");
    return file.arrayBuffer();
  }, []);

  /** Import the photo into the engine once, and establish its pristine/baseline/current settings. */
  const ensureLoaded = useCallback(
    (photo: PhotoEditorPhoto): Promise<number> => {
      const r = rt(photo.id);
      if (r.engineId != null) return Promise.resolve(r.engineId);
      if (r.loading) return r.loading;
      const engine = engineRef.current;
      if (!engine) return Promise.reject(new Error("The photo editor isn't ready yet."));
      r.error = null;
      r.loading = (async () => {
        const bytes = await fetchSourceBytes(photo);
        const engineId = await engine.importPhoto(photo.id, photo.mimeType, bytes);
        await engine.applySettings(engineId, null);
        r.pristine = await engine.getSettings(engineId);
        if (photo.publishedSettings) {
          await engine.applySettings(engineId, photo.publishedSettings);
          r.baseline = await engine.getSettings(engineId);
        } else {
          r.baseline = r.pristine;
        }
        if (r.draft) {
          await engine.applySettings(engineId, r.draft);
          r.current = await engine.getSettings(engineId);
        } else {
          r.current = r.baseline;
        }
        await engine.clearHistory(engineId);
        r.lastPolled = stableStringify(r.current);
        r.engineId = engineId;
        return engineId;
      })();
      r.loading
        .catch((err) => {
          r.error = err instanceof Error ? err.message : "This photo couldn't be opened.";
        })
        .finally(() => {
          r.loading = null;
          syncView(photo.id);
        });
      return r.loading;
    },
    [fetchSourceBytes, rt, syncView]
  );

  // Show the active photo whenever it (or the engine) changes.
  useEffect(() => {
    if (engineState !== "ready" || !activePhoto) return;
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    setPhotoBusy(true);
    setShowingOriginal(false);
    (async () => {
      try {
        const engineId = await ensureLoaded(activePhoto);
        if (cancelled) return;
        await engine.show(engineId);
      } catch {
        /* error is on the runtime; rendered below */
      } finally {
        if (!cancelled) setPhotoBusy(false);
      }
      // Warm the next photo's bytes so moving forward feels instant.
      const next = photos[photos.findIndex((p) => p.id === activePhoto.id) + 1];
      if (next && rt(next.id).engineId == null && !prefetchRef.current.has(next.id)) {
        const p = (async () => {
          const res = await fetch(`/api/media/editor/photos/${next.id}/source`, { credentials: "include", cache: "no-store" });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error("prefetch failed");
          return (await fetch(data.url)).arrayBuffer();
        })();
        p.catch(() => prefetchRef.current.delete(next.id));
        prefetchRef.current.set(next.id, p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePhoto, engineState, ensureLoaded, photos, rt]);

  // ---------------------------------------------------------------- auto-save drafts
  const persistDraft = useCallback(
    async (mediaId: string) => {
      const r = rt(mediaId);
      if (!canEdit || !r.current) return;
      const unchanged = r.baseline && settingsEqual(r.current, r.baseline);
      r.sync = "saving";
      syncView(mediaId);
      try {
        if (unchanged) {
          if (r.draft) {
            const res = await fetch(`/api/media/editor/photos/${mediaId}/draft`, { method: "DELETE", credentials: "include" });
            if (!res.ok) throw new Error();
          }
          r.draft = null;
        } else {
          const snapshot = r.current;
          const res = await fetch(`/api/media/editor/photos/${mediaId}/draft`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: snapshot }),
          });
          if (!res.ok) throw new Error();
          r.draft = snapshot;
        }
        r.sync = settingsEqual(r.current, r.draft ?? r.baseline) ? "idle" : "pending";
      } catch {
        r.sync = "error";
      }
      syncView(mediaId);
    },
    [canEdit, rt, syncView]
  );

  const scheduleAutosave = useCallback(
    (mediaId: string, delay = AUTOSAVE_DEBOUNCE_MS) => {
      const timers = autosaveTimers.current;
      const existing = timers.get(mediaId);
      if (existing) clearTimeout(existing);
      timers.set(
        mediaId,
        setTimeout(() => {
          timers.delete(mediaId);
          void persistDraft(mediaId);
        }, delay)
      );
    },
    [persistDraft]
  );

  // Leaving through the browser's back button (no beforeunload): send pending progress anyway.
  const persistDraftRef = useRef(persistDraft);
  useEffect(() => {
    persistDraftRef.current = persistDraft;
  }, [persistDraft]);
  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      for (const [id, t] of timers) {
        clearTimeout(t);
        void persistDraftRef.current(id);
      }
      timers.clear();
    };
  }, []);

  const flushAutosaves = useCallback(async () => {
    const pending = Array.from(autosaveTimers.current.keys());
    for (const id of pending) {
      clearTimeout(autosaveTimers.current.get(id));
      autosaveTimers.current.delete(id);
    }
    const dirty = new Set(pending);
    for (const [id, r] of runtimeRef.current) if (r.sync === "error" || r.sync === "pending") dirty.add(id);
    await Promise.all(Array.from(dirty).map((id) => persistDraft(id)));
  }, [persistDraft]);

  // Poll the engine for adjustment changes on the active photo.
  useEffect(() => {
    if (engineState !== "ready" || !activeId) return;
    const id = activeId;
    const timer = setInterval(async () => {
      const engine = engineRef.current;
      const r = rt(id);
      if (!engine || r.engineId == null || saving) return;
      try {
        const settings = await engine.getSettings(r.engineId);
        if (!settings) return;
        const key = stableStringify(settings);
        if (key === r.lastPolled) return;
        r.lastPolled = key;
        r.current = settings;
        const target = r.draft ?? r.baseline;
        r.sync = target && settingsEqual(settings, target) ? "idle" : "pending";
        syncView(id);
        if (r.sync === "pending") scheduleAutosave(id);
      } catch {
        /* engine busy (e.g. rendering) — try next tick */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, engineState, rt, saving, scheduleAutosave, syncView]);

  // Remember which photo is open so the session resumes there.
  useEffect(() => {
    if (!activeId || !session) return;
    void fetch(`/api/media/editor/sessions/${session.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeMediaId: activeId }),
    }).catch(() => undefined);
  }, [activeId, session]);

  // ---------------------------------------------------------------- derived status
  const statusOf = useCallback(
    (photo: PhotoEditorPhoto) => {
      const v = views[photo.id];
      return {
        unpublished: Boolean(v?.unpublished),
        syncing: v?.sync === "saving" || v?.sync === "pending",
        syncError: v?.sync === "error",
        edited: photo.editStatus === "edited",
      };
    },
    [views]
  );

  const unpublishedPhotos = photos.filter((p) => statusOf(p).unpublished);
  const anySyncing = photos.some((p) => statusOf(p).syncing);
  const anySyncError = photos.some((p) => statusOf(p).syncError);

  // Warn before closing the tab only when progress could actually be lost.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      if (anySyncing || anySyncError || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anySyncError, anySyncing, saving]);

  // ---------------------------------------------------------------- navigation
  const goTo = useCallback(
    async (id: string) => {
      if (id === activeId || saving) return;
      if (activeId) {
        const t = autosaveTimers.current.get(activeId);
        if (t) {
          clearTimeout(t);
          autosaveTimers.current.delete(activeId);
          void persistDraft(activeId);
        }
      }
      setActiveId(id);
    },
    [activeId, persistDraft, saving]
  );

  const step = useCallback(
    (delta: number) => {
      if (activeIndex < 0) return;
      const next = photos[activeIndex + delta];
      if (next) void goTo(next.id);
    },
    [activeIndex, goTo, photos]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const returnTo = session?.returnTo ?? "/admin/media";

  const leave = useCallback(async () => {
    await flushAutosaves();
    leavingRef.current = true;
    router.push(returnTo);
    router.refresh();
  }, [flushAutosaves, returnTo, router]);

  const requestLeave = useCallback(() => {
    if (unpublishedPhotos.length && canEdit) setLeaveOpen(true);
    else void leave();
  }, [canEdit, leave, unpublishedPhotos.length]);

  // ---------------------------------------------------------------- batch adjustments
  const copyAdjustments = useCallback(() => {
    if (!activePhoto) return;
    const r = rt(activePhoto.id);
    if (!r.current) return;
    setClipboard(stripPerPhoto(r.current));
    toast.success("Adjustments copied", { description: "Crop, healing and masks stay with this photo." });
  }, [activePhoto, rt]);

  const applyClipboardTo = useCallback(
    async (targetIds: string[]) => {
      const engine = engineRef.current;
      if (!clipboard || !engine) return;
      let count = 0;
      for (const id of targetIds) {
        const photo = photos.find((p) => p.id === id);
        if (!photo) continue;
        const r = rt(id);
        if (r.engineId != null) {
          const merged = { ...(r.current ?? {}), ...clipboard };
          await engine.applySettings(r.engineId, merged);
          r.current = await engine.getSettings(r.engineId);
          r.lastPolled = stableStringify(r.current);
        } else {
          // Not opened yet: store the adjustments as its progress; pixels are rendered on save.
          r.current = { ...(r.draft ?? photo.publishedSettings ?? {}), ...clipboard };
        }
        r.sync = "pending";
        count += 1;
        await persistDraft(id);
      }
      for (const id of targetIds) syncView(id);
      if (activeId) {
        const a = rt(activeId);
        if (a.engineId != null) await engine.show(a.engineId);
      }
      toast.success(`Adjustments applied to ${count} photo${count === 1 ? "" : "s"}`, {
        description: "Review them, then save to the project when you're happy.",
      });
    },
    [activeId, clipboard, persistDraft, photos, rt, syncView]
  );

  const revertToSaved = useCallback(async () => {
    const engine = engineRef.current;
    if (!activePhoto || !engine) return;
    const r = rt(activePhoto.id);
    if (r.engineId == null) return;
    await engine.applySettings(r.engineId, activePhoto.publishedSettings);
    r.current = await engine.getSettings(r.engineId);
    r.lastPolled = stableStringify(r.current);
    await persistDraft(activePhoto.id);
    toast.success(activePhoto.editStatus === "edited" ? "Back to the version in your project" : "Adjustments cleared");
  }, [activePhoto, persistDraft, rt]);

  const resetAdjustments = useCallback(async () => {
    const engine = engineRef.current;
    if (!activePhoto || !engine) return;
    const r = rt(activePhoto.id);
    if (r.engineId == null) return;
    await engine.applySettings(r.engineId, null);
    r.current = await engine.getSettings(r.engineId);
    r.lastPolled = stableStringify(r.current);
    r.sync = "pending";
    syncView(activePhoto.id);
    scheduleAutosave(activePhoto.id, 0);
  }, [activePhoto, rt, scheduleAutosave, syncView]);

  // ---------------------------------------------------------------- save to project
  const updatePhoto = useCallback((id: string, patch: Partial<PhotoEditorPhoto>) => {
    setSession((s) => (s ? { ...s, photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : s));
  }, []);

  const saveToProject = useCallback(
    async (ids: string[], thenLeave: boolean) => {
      const engine = engineRef.current;
      if (!engine || !ids.length || saving) return;
      await flushAutosaves();
      setSaving(true);
      const items: SaveItem[] = ids.map((id) => ({
        id,
        name: photos.find((p) => p.id === id)?.name ?? "Photo",
        status: "queued",
      }));
      setSaveItems(items);
      const patchItem = (id: string, patch: Partial<SaveItem>) =>
        setSaveItems((prev) => prev?.map((it) => (it.id === id ? { ...it, ...patch } : it)) ?? prev);

      let ok = 0;
      for (const id of ids) {
        const photo = photos.find((p) => p.id === id);
        if (!photo) continue;
        const r = rt(id);
        patchItem(id, { status: "saving", step: "Preparing…" });
        try {
          const engineId = await ensureLoaded(photo);
          await engine.show(engineId);
          setActiveId(id);
          const settings = (await engine.getSettings(engineId)) ?? r.current ?? {};
          const isPristine = r.pristine && settingsEqual(settings, r.pristine);
          if (isPristine) {
            // No adjustments left: deliver the original instead of a re-rendered copy.
            if (photo.editStatus === "edited") await restorePhotoVersion(id, "original");
            await fetch(`/api/media/editor/photos/${id}/draft`, { method: "DELETE", credentials: "include" });
            updatePhoto(id, { editStatus: "unedited", publishedSettings: null });
          } else {
            const result = await saveEditedPhoto({
              engine,
              engineId,
              mediaId: id,
              sourceMime: photo.mimeType,
              settings,
              onStep: (s) =>
                patchItem(id, { step: s === "rendering" ? "Rendering full size…" : s === "uploading" ? "Uploading…" : "Finishing…" }),
            });
            if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
            r.previewUrl = result.previewUrl;
            updatePhoto(id, {
              editStatus: "edited",
              publishedSettings: settings,
              currentVersionNumber: result.versionNumber,
              editedAt: new Date().toISOString(),
            });
          }
          r.baseline = settings;
          r.current = settings;
          r.draft = null;
          r.sync = "idle";
          r.lastPolled = stableStringify(settings);
          ok += 1;
          patchItem(id, { status: "saved", step: undefined });
        } catch (err) {
          const message =
            err instanceof LightCraftError || err instanceof Error ? err.message : "Couldn't save this photo.";
          patchItem(id, { status: "failed", error: message, step: undefined });
        }
        syncView(id);
      }
      setSaving(false);
      const failed = ids.length - ok;
      if (failed === 0) {
        setSaveItems(null);
        toast.success(ok === 1 ? "Saved to project" : `${ok} photos saved to project`, {
          description: "Clients now see the edited version. The original is kept privately.",
        });
        if (thenLeave) {
          leavingRef.current = true;
          router.push(returnTo);
          router.refresh();
        }
      } else if (ok > 0) {
        toast.message(`${ok} of ${ids.length} photos saved`, { description: "Your edits on the others are kept — try again." });
      }
    },
    [ensureLoaded, flushAutosaves, photos, returnTo, router, rt, saving, syncView, updatePhoto]
  );

  // ---------------------------------------------------------------- render helpers
  const activeView = activePhoto ? views[activePhoto.id] ?? null : null;
  const activeStatus = activePhoto ? statusOf(activePhoto) : null;
  const multi = photos.length > 1;
  const backLabel = session?.folderName
    ? `Back to ${session.folderName}`
    : session?.projectName
      ? "Back to project"
      : "Back to media";

  function openMoreMenu(el: HTMLElement) {
    const items: ActionMenuItem[] = [
      { id: "copy", label: "Copy adjustments", icon: ClipboardCopy, disabled: !activeView?.hasCurrent, onSelect: copyAdjustments },
      {
        id: "paste",
        label: "Paste adjustments",
        icon: ClipboardPaste,
        disabled: !clipboard || !activePhoto || !canEdit,
        onSelect: () => activePhoto && void applyClipboardTo([activePhoto.id]),
      },
    ];
    if (multi) {
      items.push({
        id: "paste-all",
        label: `Paste to all ${photos.length} photos`,
        icon: Copy,
        disabled: !clipboard || !canEdit,
        hint: clipboard ? undefined : "Copy adjustments first",
        onSelect: () => void applyClipboardTo(photos.map((p) => p.id)),
      });
    }
    items.push(
      { type: "separator", id: "s1" },
      {
        id: "revert",
        label: activePhoto?.editStatus === "edited" ? "Revert to version in project" : "Discard changes",
        icon: RotateCcw,
        disabled: !activeStatus?.unpublished || !canEdit,
        onSelect: () => void revertToSaved(),
      },
      {
        id: "reset",
        label: "Reset all adjustments",
        icon: RotateCcw,
        disabled: !canEdit || !activeView?.loaded || Boolean(activeView?.pristine),
        onSelect: () => void resetAdjustments(),
      },
      { id: "history", label: "Versions & original…", icon: History, onSelect: () => setHistoryOpen(true) },
      { type: "separator", id: "s2" },
      { id: "about", label: "About the Photo Editor", icon: Info, onSelect: () => setAboutOpen(true) }
    );
    setMenu({ anchor: { kind: "element", element: el }, items });
  }

  // ---------------------------------------------------------------- screens
  if (setupRequired || loadError) {
    return (
      <EditorShell>
        <CenteredNotice
          icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
          title={setupRequired ? "Photo Editor setup isn't finished" : "Couldn't open these photos"}
          body={
            setupRequired
              ? "A database update for the Photo Editor still needs to be applied. Your photos are unaffected."
              : loadError ?? ""
          }
          action={<DarkButton onClick={() => router.back()}>Go back</DarkButton>}
        />
      </EditorShell>
    );
  }

  if (!session || device === null) {
    return (
      <EditorShell>
        <CenteredNotice icon={<Loader2 className="h-6 w-6 animate-spin text-white/70" />} title="Opening your photos…" />
      </EditorShell>
    );
  }

  if (device === "unsupported" || (device === "small" && !proceedOnSmall)) {
    return (
      <EditorShell>
        <CenteredNotice
          icon={<Monitor className="h-6 w-6 text-white/80" />}
          title={device === "unsupported" ? "This browser can't run the Photo Editor" : "Photo editing works best on a computer"}
          body={
            device === "unsupported"
              ? "The Photo Editor needs WebGL 2, which this browser or device doesn't provide. Open this project on a computer with an up-to-date Chrome, Edge, Firefox or Safari."
              : "For precise adjustments, open this project on a laptop or desktop. Any edits you start here are saved and will be waiting for you there."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <DarkButton onClick={() => router.push(returnTo)}>{backLabel}</DarkButton>
              {device === "small" ? (
                <Button variant="accent" onClick={() => setProceedOnSmall(true)}>
                  Continue anyway
                </Button>
              ) : null}
            </div>
          }
        />
      </EditorShell>
    );
  }

  const statusPill = (() => {
    if (!activePhoto || !activeStatus) return null;
    if (photoBusy && !activeView?.loaded) return { tone: "muted", icon: Loader2, spin: true, text: "Opening…" };
    if (!canEdit) return { tone: "muted", icon: Eye, text: "View only" };
    if (activeStatus.syncError) return { tone: "amber", icon: AlertTriangle, text: "Progress not saved — retrying" };
    if (activeStatus.syncing) return { tone: "muted", icon: Loader2, spin: true, text: "Saving progress…" };
    if (activeStatus.unpublished) return { tone: "amber", icon: CloudCheck, text: "Progress saved · not in project yet" };
    if (activeStatus.edited) return { tone: "green", icon: Check, text: "Edited · in project" };
    return { tone: "muted", icon: null, text: "Original" };
  })();

  const saveTargets = unpublishedPhotos.map((p) => p.id);
  const primaryLabel =
    saveTargets.length > 1 ? `Save ${saveTargets.length} to Project` : "Save to Project";

  return (
    <EditorShell>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#16181d] px-2 sm:px-3">
        <button
          type="button"
          onClick={requestLeave}
          className="inline-flex h-9 min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="hidden truncate sm:inline">{backLabel}</span>
        </button>
        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{activePhoto?.name ?? "Photo"}</p>
            <p className="truncate text-[11px] text-white/50">
              {multi ? `Photo ${activeIndex + 1} of ${photos.length}` : "Photo Editor"}
              {session.projectName ? ` · ${session.projectName}` : ""}
            </p>
          </div>
          {statusPill ? (
            <span
              className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:inline-flex",
                statusPill.tone === "amber" && "bg-amber-400/15 text-amber-300",
                statusPill.tone === "green" && "bg-emerald-400/15 text-emerald-300",
                statusPill.tone === "muted" && "bg-white/10 text-white/70"
              )}
              title="Your adjustments save automatically and stay private until you save them to the project."
            >
              {statusPill.icon ? <statusPill.icon className={cn("h-3.5 w-3.5", statusPill.spin && "animate-spin")} /> : null}
              {statusPill.text}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Undo" onClick={() => void engineRef.current?.undo()} disabled={engineState !== "ready" || !canEdit}>
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Redo" onClick={() => void engineRef.current?.redo()} disabled={engineState !== "ready" || !canEdit}>
            <Redo2 className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={showingOriginal ? "Show edited" : "Compare with original"}
            active={showingOriginal}
            onClick={() => {
              void engineRef.current?.toggleOriginal();
              setShowingOriginal((v) => !v);
            }}
            disabled={engineState !== "ready"}
          >
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton label="Versions & original" onClick={() => setHistoryOpen(true)} disabled={!activePhoto}>
            <History className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="More actions"
            onClick={(e) => openMoreMenu(e.currentTarget)}
            disabled={engineState !== "ready"}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
          <div className="mx-1 h-6 w-px bg-white/10" />
          <DarkButton onClick={requestLeave} className="hidden sm:inline-flex">
            Done
          </DarkButton>
          {canEdit ? (
            <Button
              variant="accent"
              size="sm"
              className="h-9 px-3.5"
              disabled={engineState !== "ready" || saving || saveTargets.length === 0}
              onClick={() => void saveToProject(saveTargets, !multi)}
              title={
                saveTargets.length === 0
                  ? "Make an adjustment to save it to the project"
                  : "Deliver the edited version to the project. The original is kept privately."
              }
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {primaryLabel}
            </Button>
          ) : null}
        </div>
      </header>

      {/* Engine */}
      <div className="relative min-h-0 flex-1 bg-[#1c1c1c]">
        {engineWanted ? (
          <iframe
            ref={frameRef}
            src={ENGINE_URL}
            title="Photo editor"
            className={cn("absolute inset-0 h-full w-full border-0", engineState !== "ready" && "invisible")}
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        ) : null}
        {engineState === "starting" ? (
          <Overlay>
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            <p className="text-sm font-medium text-white">Preparing the editor…</p>
            <p className="text-xs text-white/50">The first time can take a few seconds.</p>
          </Overlay>
        ) : engineState === "failed" ? (
          <Overlay>
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <p className="text-sm font-medium text-white">The editor couldn&apos;t start</p>
            <p className="max-w-sm text-center text-xs text-white/60">{engineError}</p>
            <p className="max-w-sm text-center text-xs text-white/50">Your saved progress is safe.</p>
            <div className="mt-2 flex gap-2">
              <DarkButton onClick={() => window.location.reload()}>Try again</DarkButton>
              <DarkButton onClick={() => void leave()}>{backLabel}</DarkButton>
            </div>
          </Overlay>
        ) : activeView?.error ? (
          <Overlay>
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <p className="text-sm font-medium text-white">This photo couldn&apos;t be opened</p>
            <p className="max-w-sm text-center text-xs text-white/60">{activeView.error}</p>
            <div className="mt-2 flex gap-2">
              <DarkButton
                onClick={() => {
                  if (!activePhoto) return;
                  rt(activePhoto.id).error = null;
                  syncView(activePhoto.id);
                  setActiveId(null);
                  setTimeout(() => setActiveId(activePhoto.id), 0);
                }}
              >
                Try again
              </DarkButton>
              {multi ? <DarkButton onClick={() => step(1)}>Next photo</DarkButton> : null}
            </div>
          </Overlay>
        ) : photoBusy && !activeView?.loaded ? (
          <Overlay translucent>
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            <p className="text-sm font-medium text-white">Opening {activePhoto?.name}…</p>
          </Overlay>
        ) : null}
      </div>

      {/* Filmstrip */}
      {multi ? (
        <div className="shrink-0 border-t border-white/10 bg-[#16181d]">
          <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-white/50">
            <span>
              {photos.length} photos
              {session.folderName ? ` in ${session.folderName}` : ""}
              {unpublishedPhotos.length ? ` · ${unpublishedPhotos.length} not in project yet` : ""}
            </span>
            <span className="ml-auto hidden lg:inline">Alt + ← / → to move between photos</span>
            <IconButton label="Previous photo" onClick={() => step(-1)} disabled={activeIndex <= 0} small>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <IconButton label="Next photo" onClick={() => step(1)} disabled={activeIndex >= photos.length - 1} small>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
          <Filmstrip
            photos={photos}
            activeId={activeId}
            statusOf={statusOf}
            previewOf={(id) => views[id]?.previewUrl ?? null}
            onSelect={(id) => void goTo(id)}
          />
        </div>
      ) : null}

      <ActionMenu anchor={menu?.anchor ?? null} items={menu?.items ?? []} title="Photo actions" onClose={() => setMenu(null)} />

      {activePhoto ? (
        <PhotoVersionHistory
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          photo={activePhoto}
          canEdit={canEdit}
          onRestored={(kind, versionNumber, settings) => {
            const photoId = activePhoto.id;
            updatePhoto(photoId, {
              editStatus: kind === "original" ? "unedited" : "edited",
              currentVersionNumber: versionNumber,
              publishedSettings: settings,
            });
            const r = rt(photoId);
            if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
            r.previewUrl = null;
            void (async () => {
              // The delivered version changed: it is the new "saved" state to compare against.
              const engine = engineRef.current;
              if (engine && r.engineId != null) {
                await engine.applySettings(r.engineId, settings);
                r.baseline = await engine.getSettings(r.engineId);
                if (r.draft) await engine.applySettings(r.engineId, r.draft);
                r.current = r.draft ? await engine.getSettings(r.engineId) : r.baseline;
                r.lastPolled = stableStringify(r.current);
              }
              syncView(photoId);
            })();
            toast.success(kind === "original" ? "Clients now see the original" : `Clients now see version ${versionNumber}`, {
              description: "Reopen the photo to keep editing from that version.",
            });
          }}
        />
      ) : null}

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About the Photo Editor" overlayClassName="z-[260]">
        <div className="space-y-3 text-sm text-foreground">
          <p>
            Your adjustments save automatically as private progress. Clients only see a photo&apos;s edited version after you
            choose <strong>Save to Project</strong>, and the original upload is always kept for you.
          </p>
          <p className="text-muted">
            Supported photos: JPEG, PNG and WebP. Edited photos are delivered as full-resolution JPEG (PNG stays PNG).
          </p>
          <p className="text-muted">
            The editing engine is{" "}
            <a className="text-accent underline-offset-2 hover:underline" href="https://github.com/storytold/lightcraft" target="_blank" rel="noreferrer">
              LightCraft
            </a>
            , open-source software licensed under MIT or Apache-2.0.{" "}
            <a className="text-accent underline-offset-2 hover:underline" href="/lightcraft/NOTICE" target="_blank" rel="noreferrer">
              Licenses &amp; notices
            </a>
          </p>
        </div>
      </Modal>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Save your edits to the project?"
        overlayClassName="z-[260]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setLeaveOpen(false)} className="min-h-11 sm:min-h-10">
              Keep editing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLeaveOpen(false);
                void leave();
              }}
              className="min-h-11 sm:min-h-10"
            >
              Leave as progress
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setLeaveOpen(false);
                void saveToProject(saveTargets, true);
              }}
              className="min-h-11 sm:min-h-10"
            >
              {primaryLabel}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          {unpublishedPhotos.length === 1
            ? `“${unpublishedPhotos[0].name}” has edits that aren't in the project yet.`
            : `${unpublishedPhotos.length} photos have edits that aren't in the project yet.`}{" "}
          Your progress is saved either way — clients keep seeing the current versions until you save to the project.
        </p>
      </Modal>

      <Modal
        open={saveItems !== null}
        onClose={() => {
          if (!saving) setSaveItems(null);
        }}
        title={saving ? "Saving to project…" : "Some photos weren't saved"}
        overlayClassName="z-[260]"
        footer={
          saving ? null : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setSaveItems(null)} className="min-h-11 sm:min-h-10">
                Close
              </Button>
              <Button
                variant="accent"
                className="min-h-11 sm:min-h-10"
                onClick={() => {
                  const failed = (saveItems ?? []).filter((i) => i.status === "failed").map((i) => i.id);
                  void saveToProject(failed, !multi);
                }}
              >
                Retry failed
              </Button>
            </div>
          )
        }
      >
        <SaveProgress items={saveItems ?? []} />
      </Modal>
    </EditorShell>
  );
}

// ---------------------------------------------------------------------------- pieces

function EditorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#1c1c1c] text-white" data-photo-editor>
      {children}
    </div>
  );
}

function CenteredNotice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">{icon}</div>
      <h1 className="text-base font-semibold text-white">{title}</h1>
      {body ? <p className="max-w-md text-sm text-white/60">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function Overlay({ children, translucent }: { children: React.ReactNode; translucent?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6",
        translucent ? "bg-[#1c1c1c]/80" : "bg-[#1c1c1c]"
      )}
    >
      {children}
    </div>
  );
}

function DarkButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3.5 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  active,
  small,
}: {
  label: string;
  children: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35",
        small ? "h-7 w-7" : "h-9 w-9",
        active && "bg-white/15 text-white"
      )}
    >
      {children}
    </button>
  );
}

function Filmstrip({
  photos,
  activeId,
  statusOf,
  previewOf,
  onSelect,
}: {
  photos: PhotoEditorPhoto[];
  activeId: string | null;
  statusOf: (p: PhotoEditorPhoto) => { unpublished: boolean; edited: boolean; syncError: boolean };
  previewOf: (id: string) => string | null;
  onSelect: (id: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId]);
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-2" role="listbox" aria-label="Photos being edited">
      {photos.map((p, i) => {
        const s = statusOf(p);
        const active = p.id === activeId;
        const src = previewOf(p.id) ?? p.thumbUrl;
        return (
          <button
            key={p.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(p.id)}
            title={`${i + 1}. ${p.name}${s.unpublished ? " — not in project yet" : s.edited ? " — edited" : ""}`}
            className={cn(
              "relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-white/5 transition",
              active ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : null}
            {s.unpublished || s.edited ? (
              <span
                className={cn(
                  "absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full shadow",
                  s.unpublished ? "bg-amber-400 text-amber-950" : "bg-emerald-500 text-white"
                )}
                aria-hidden
              >
                {s.unpublished ? <span className="h-1.5 w-1.5 rounded-full bg-amber-950" /> : <Check className="h-2.5 w-2.5" />}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SaveProgress({ items }: { items: SaveItem[] }) {
  const done = items.filter((i) => i.status === "saved").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>
            {done} of {items.length} saved
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">
              {it.status === "saved" ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : it.status === "failed" ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : it.status === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <span className="block h-4 w-4 rounded-full border border-border" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-foreground">{it.name}</span>
              {it.step ? <span className="block text-xs text-muted">{it.step}</span> : null}
              {it.error ? <span className="block text-xs text-red-600">{it.error}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
