"use client";

/**
 * Thin, typed bridge to the LightCraft engine running in a same-origin iframe
 * (public/lightcraft/index.html?host=parent&store=memory).
 *
 * Integration surface (LightCraft v0.20 docs/web.md + apps/lightcraft-web/src/host.rs):
 *   iframe → parent  lightcraft:ready | lightcraft:failed | lightcraft:save {name, bytes} | lightcraft:dirty
 *   parent → iframe  lightcraft:open {name, bytes}
 *   commands         frame.contentWindow.lightcraft.command(id, paramsJsonText) → Promise<JSON text>
 *                    (same-origin direct call: each call gets its own promise, unlike the
 *                    postMessage `lightcraft:cmd`, whose responses carry no request id)
 *
 * Everything ShootPortal-specific (sessions, drafts, saving) lives outside this file, so a
 * LightCraft upgrade only needs this bridge re-tested.
 */

export type LightCraftSettings = Record<string, unknown>;

type LightCraftWindow = Window & {
  lightcraft?: { command: (id: string, params: string) => Promise<string> };
};

type PhotoSummary = { id: number; fileName: string; width?: number; height?: number };

export class LightCraftError extends Error {
  constructor(message: string, readonly code: "failed" | "timeout" | "already_open" | "unsupported" | "command") {
    super(message);
  }
}

/** Groups that are specific to one frame and never copied between photos. */
export const PER_PHOTO_SETTING_KEYS = ["crop", "geometry", "orientation", "spots", "red_eye", "masks", "lens_blur"] as const;

/** File-name token used to find an imported photo again (no dashes: the catalog tokenizes on them). */
export function engineFileName(mediaId: string, mimeType: string): string {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `sp${mediaId.replace(/-/g, "")}.${ext}`;
}

function engineToken(mediaId: string): string {
  return `sp${mediaId.replace(/-/g, "")}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class LightCraftEngine {
  private readonly frame: HTMLIFrameElement;
  private readonly origin = window.location.origin;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;
  private saveWaiters: ((m: { name: string; bytes: ArrayBuffer }) => void)[] = [];
  private failureListeners = new Set<(message: string) => void>();
  private readonly onMessage = (event: MessageEvent) => this.handleMessage(event);
  private chain: Promise<unknown> = Promise.resolve();
  version: string | null = null;

  constructor(frame: HTMLIFrameElement) {
    this.frame = frame;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    window.addEventListener("message", this.onMessage);
  }

  dispose() {
    window.removeEventListener("message", this.onMessage);
    this.saveWaiters = [];
    this.failureListeners.clear();
  }

  onFailure(listener: (message: string) => void) {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  ready(timeoutMs = 90_000): Promise<void> {
    return Promise.race([
      this.readyPromise,
      sleep(timeoutMs).then(() => {
        throw new LightCraftError("The photo editor took too long to start.", "timeout");
      }),
    ]);
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== this.origin || event.source !== this.frame.contentWindow) return;
    const data = event.data as { type?: string; [k: string]: unknown } | null;
    if (!data || typeof data.type !== "string" || !data.type.startsWith("lightcraft:")) return;
    switch (data.type) {
      case "lightcraft:ready":
        this.version = typeof data.version === "string" ? data.version : null;
        this.resolveReady();
        break;
      case "lightcraft:failed": {
        const message = String(data.error ?? "The photo editor stopped unexpectedly.");
        const alreadyOpen = /already open|another tab|lock/i.test(message);
        const err = new LightCraftError(
          alreadyOpen ? "The Photo Editor is already open in another tab. Close it there to edit here." : message,
          alreadyOpen ? "already_open" : "failed"
        );
        this.rejectReady(err);
        for (const l of this.failureListeners) l(err.message);
        break;
      }
      case "lightcraft:save": {
        const bytes = data.bytes;
        if (bytes instanceof ArrayBuffer) {
          const waiter = this.saveWaiters.shift();
          waiter?.({ name: String(data.name ?? "export"), bytes });
        }
        break;
      }
      default:
        break;
    }
  }

  /** Run one engine/UI command. Calls are serialized so state changes apply in order. */
  command<T = unknown>(id: string, params: Record<string, unknown> = {}): Promise<T> {
    const run = async () => {
      const win = this.frame.contentWindow as LightCraftWindow | null;
      const api = win?.lightcraft;
      if (!api) throw new LightCraftError("The photo editor isn't ready yet.", "command");
      try {
        const text = await api.command(id, JSON.stringify(params));
        return (text ? JSON.parse(text) : null) as T;
      } catch (err) {
        throw new LightCraftError(err instanceof Error ? err.message : String(err), "command");
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** Best-effort command (UI tweaks that may not exist in every LightCraft version). */
  async tryCommand(id: string, params: Record<string, unknown> = {}) {
    try {
      return await this.command(id, params);
    } catch {
      return null;
    }
  }

  /** Remove the demo photos a fresh in-memory library starts with. */
  async clearLibrary() {
    const res = await this.command<{ photos: PhotoSummary[] }>("catalog.query", { filter: {}, limit: 10_000 });
    const ids = (res?.photos ?? []).map((p) => p.id);
    if (ids.length) await this.tryCommand("photo.deletePermanently", { ids });
  }

  /** Import one photo and return its engine id (finds an already-imported copy first). */
  async importPhoto(mediaId: string, mimeType: string, bytes: ArrayBuffer, timeoutMs = 30_000): Promise<number> {
    const existing = await this.findPhoto(mediaId);
    if (existing != null) return existing;
    this.frame.contentWindow?.postMessage(
      { type: "lightcraft:open", name: engineFileName(mediaId, mimeType), bytes },
      this.origin,
      [bytes]
    );
    const started = Date.now();
    let delay = 120;
    while (Date.now() - started < timeoutMs) {
      await sleep(delay);
      delay = Math.min(delay * 1.4, 800);
      const id = await this.findPhoto(mediaId);
      if (id != null) return id;
    }
    throw new LightCraftError("This photo couldn't be opened. It may be damaged or in an unsupported format.", "unsupported");
  }

  async findPhoto(mediaId: string): Promise<number | null> {
    const token = engineToken(mediaId);
    const res = await this.command<{ photos: PhotoSummary[] }>("catalog.query", { filter: { text: token }, limit: 5 });
    const hit = (res?.photos ?? []).find((p) => p.fileName?.toLowerCase().startsWith(token));
    return hit ? hit.id : null;
  }

  async show(engineId: number) {
    await this.command("library.select", { ids: [engineId], active: engineId });
    await this.tryCommand("view.detail");
  }

  async getSettings(engineId: number): Promise<LightCraftSettings | null> {
    const v = await this.command<LightCraftSettings | null>("develop.get", { id: engineId });
    return v && typeof v === "object" ? v : null;
  }

  /** Replace the photo's adjustments with `settings` (null = back to defaults). */
  async applySettings(engineId: number, settings: LightCraftSettings | null) {
    await this.command("library.select", { ids: [engineId], active: engineId });
    await this.command("develop.reset", { ids: [engineId] });
    if (settings && Object.keys(settings).length) {
      await this.command("develop.merge", { settings, label: "Saved adjustments" });
    }
  }

  /** Start the photo's undo history fresh (after ShootPortal restores saved adjustments). */
  async clearHistory(engineId: number) {
    await this.command("library.select", { ids: [engineId], active: engineId });
    await this.tryCommand("history.clear");
  }

  async undo() {
    await this.tryCommand("edit.undo");
  }

  async redo() {
    await this.tryCommand("edit.redo");
  }

  /** Toggle the "show original" (before) view. */
  async toggleOriginal() {
    await this.tryCommand("view.showOriginal");
  }

  /** Close any dialog/tour LightCraft opens on a fresh start (each start is fresh: memory store). */
  async dismissDialogs() {
    for (let i = 0; i < 3; i++) await this.tryCommand("view.back");
  }

  /**
   * Fresh-start setup: close the welcome tour, use the dark theme that matches the editor chrome,
   * and hide LightCraft's own filmstrip (ShootPortal shows its own, with edit status).
   * Each start is a fresh in-memory session, so the UI always begins in its default layout.
   */
  async configureWorkspace() {
    await this.dismissDialogs();
    await this.setTheme(true);
    await this.tryCommand("view.filmstrip");
  }

  /** Match the surrounding ShootPortal surface. */
  async setTheme(dark: boolean) {
    await this.tryCommand("view.theme", { theme: dark ? "charcoal" : "silver" });
  }

  /**
   * Render a finished file at full resolution. LightCraft delivers it as `lightcraft:save`
   * instead of a download because the page is framed with ?host=parent.
   */
  async exportPhoto(
    engineId: number,
    format: "jpeg" | "png",
    timeoutMs = 180_000
  ): Promise<{ bytes: ArrayBuffer; width: number | null; height: number | null }> {
    const delivered = new Promise<{ name: string; bytes: ArrayBuffer }>((resolve) => this.saveWaiters.push(resolve));
    let attempt = 0;
    let result: { files?: { width?: number; height?: number }[] } | null = null;
    // The first export right after start-up can report "still loading".
    for (;;) {
      try {
        result = await this.command("app.export", {
          ids: [engineId],
          dir: "ShootPortal",
          format,
          ...(format === "jpeg" ? { quality: 92 } : {}),
          longEdge: 0,
          dontEnlarge: true,
          colorSpace: "srgb",
        });
        break;
      } catch (err) {
        attempt += 1;
        if (attempt >= 4 || !/loading|not ready|busy/i.test(err instanceof Error ? err.message : "")) {
          this.saveWaiters = this.saveWaiters.filter(() => false);
          throw err;
        }
        await sleep(1200 * attempt);
      }
    }
    const file = await Promise.race([
      delivered,
      sleep(timeoutMs).then(() => {
        throw new LightCraftError("Rendering the photo took too long.", "timeout");
      }),
    ]);
    const meta = result?.files?.[0];
    return { bytes: file.bytes, width: meta?.width ?? null, height: meta?.height ?? null };
  }
}
