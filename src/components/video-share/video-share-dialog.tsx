"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Link2,
  Loader2,
  Lock,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  BACKGROUND_EMBED_OPTIONS,
  DEFAULT_EMBED_OPTIONS,
  aspectPaddingPercent,
  buildEmbedCode,
  buildEmbedSrc,
  embedPresetFor,
  type VideoEmbedOptions,
  type VideoShareStateResponse,
} from "@/lib/video-embed-options";

export type VideoShareTarget = {
  id: string;
  title: string;
  thumbUrl?: string | null;
};

type Tab = "link" | "embed";
type Confirming = "disable" | "reset" | null;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older Safari / insecure contexts: fall back to a hidden textarea.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const mark = useCallback((key: string) => {
    setCopied(key);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  }, []);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return { copied, mark };
}

const OPTION_ROWS: { key: keyof Omit<VideoEmbedOptions, "fit">; label: string; hint: string }[] = [
  { key: "autoplay", label: "Autoplay", hint: "Starts playing when the page loads" },
  { key: "muted", label: "Start muted", hint: "Needed for autoplay on most browsers" },
  { key: "loop", label: "Loop", hint: "Plays again from the start when it ends" },
  { key: "controls", label: "Player controls", hint: "Play, pause, volume, full screen" },
  { key: "title", label: "Video title", hint: "Shown at the top of the player" },
  { key: "branding", label: "Branding", hint: "Your photographer's logo in the corner" },
];

export function VideoShareDialog({
  open,
  onClose,
  target,
  onPublicChange,
}: {
  open: boolean;
  onClose: () => void;
  target: VideoShareTarget | null;
  /** Called after sharing is turned on or off (badges, grid state). */
  onPublicChange?: (mediaId: string, isPublic: boolean) => void;
}) {
  const [state, setState] = useState<VideoShareStateResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("link");
  const [options, setOptions] = useState<VideoEmbedOptions>(DEFAULT_EMBED_OPTIONS);
  const [fill, setFill] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const { copied, mark } = useCopied();
  const saveTimer = useRef<number | null>(null);
  const mediaId = target?.id ?? null;
  const endpoint = mediaId ? `/api/media/${encodeURIComponent(mediaId)}/public-share` : null;

  const apply = useCallback((next: VideoShareStateResponse) => {
    setState(next);
    if (next.share) setOptions(next.share.embedSettings);
  }, []);

  const load = useCallback(async () => {
    if (!endpoint) return;
    setLoadError(null);
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError((data as { error?: string }).error || "Couldn't load sharing.");
        return;
      }
      apply(data as VideoShareStateResponse);
    } catch {
      setLoadError("Couldn't load sharing. Check your connection and try again.");
    }
  }, [apply, endpoint]);

  useEffect(() => {
    if (!open) return;
    setState(null);
    setTab("link");
    setConfirming(null);
    setFill(false);
    void load();
  }, [open, load]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  async function act(action: "enable" | "disable" | "reset_link", label: string) {
    if (!endpoint) return;
    setBusy(action);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, embedSettings: action === "enable" ? options : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Something went wrong. Please try again.");
        return;
      }
      const next = data as VideoShareStateResponse;
      apply(next);
      setConfirming(null);
      if (mediaId) onPublicChange?.(mediaId, Boolean(next.share?.enabled));
      toast.success(label);
    } finally {
      setBusy(null);
    }
  }

  function updateOptions(patch: Partial<VideoEmbedOptions>) {
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      // Autoplay with sound is blocked by browsers; default to muted when turning it on.
      if (patch.autoplay === true && prev.autoplay === false && patch.muted === undefined) next.muted = true;
      scheduleSave(next);
      return next;
    });
  }

  function scheduleSave(next: VideoEmbedOptions) {
    if (!endpoint || !state?.permissions.canManage) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_embed", embedSettings: next }),
      }).catch(() => undefined);
    }, 800);
  }

  async function copy(key: "link" | "embed", text: string) {
    if (await copyText(text)) {
      mark(key);
      toast.success(key === "link" ? "Link copied" : "Embed code copied");
    } else {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  const share = state?.share ?? null;
  const isPublic = Boolean(share?.enabled);
  const canManage = Boolean(state?.permissions.canManage);
  const isBusiness = state?.permissions.role === "business";
  const preset = embedPresetFor(options);

  const embedCode = useMemo(() => {
    if (!share || !state) return "";
    return buildEmbedCode({
      embedBaseUrl: share.embedBaseUrl,
      options,
      title: state.video.title,
      width: state.video.width,
      height: state.video.height,
      fill,
    });
  }, [fill, options, share, state]);

  const previewSrc = useMemo(() => {
    if (!share) return "";
    const src = buildEmbedSrc(share.embedBaseUrl, options);
    return `${src}${src.includes("?") ? "&" : "?"}preview=1`;
  }, [options, share]);

  const blockedMessage =
    state?.permissions.blockedReason === "client_sharing_disabled"
      ? `${state.businessName} manages public sharing for this video.`
      : state?.permissions.blockedReason === "not_delivered"
        ? "Public sharing unlocks once this project is delivered."
        : state?.permissions.blockedReason === "no_permission"
          ? "You don't have permission to change public sharing for this video."
          : null;

  const title = target?.title ?? state?.video.title ?? "Video";

  return (
    <Modal open={open} onClose={onClose} title="Share video" className="sm:max-w-2xl" overlayClassName="z-[260]">
      <div className="space-y-5 pb-1">
        {/* Video + status */}
        <div className="flex items-center gap-3">
          <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-900">
            {target?.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={target.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-heading">{title}</p>
            {state ? (
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                  isPublic
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300 surface-dark:ring-emerald-500/30"
                    : "bg-subtle text-muted ring-1 ring-border"
                )}
                aria-live="polite"
              >
                {isPublic ? <Globe className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
                {isPublic ? "Public" : "Private"}
              </span>
            ) : null}
          </div>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-border bg-subtle p-4 text-sm">
            <p className="font-medium text-heading">Couldn&apos;t load sharing</p>
            <p className="mt-1 text-muted">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              <RotateCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        ) : !state ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !state.available ? (
          <div className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 surface-dark:border-amber-500/40 surface-dark:bg-amber-500/10 surface-dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>Public video sharing is being set up for this portal and will be available soon.</p>
          </div>
        ) : (
          <>
            {/* Public access toggle */}
            <section
              className={cn(
                "rounded-xl border p-4 transition-colors",
                isPublic ? "border-accent/40 bg-accent-subtle/40" : "border-border"
              )}
              aria-labelledby="video-public-heading"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isPublic ? "bg-accent text-accent-foreground" : "bg-subtle text-muted"
                  )}
                >
                  {isPublic ? <Globe className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="video-public-heading" className="text-sm font-semibold text-heading">
                    Public sharing
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {isPublic
                      ? "Anyone with the link can watch this video, and it can be embedded on websites. No sign-in needed."
                      : "Turn on to get a link anyone can watch and an embed code for your website."}
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    Only this video is shared — the rest of the project stays private.
                  </p>
                </div>
                {canManage ? (
                  busy === "enable" || busy === "disable" ? (
                    <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-muted" aria-label="Saving" />
                  ) : (
                    <Switch
                      checked={isPublic}
                      aria-labelledby="video-public-heading"
                      className="mt-1"
                      onCheckedChange={(next) => {
                        if (next) void act("enable", "Video is now public");
                        else setConfirming("disable");
                      }}
                    />
                  )
                ) : null}
              </div>

              {blockedMessage && !canManage ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {blockedMessage}
                </p>
              ) : null}

              {confirming === "disable" ? (
                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                  <p className="text-sm font-medium text-heading">Turn off public sharing?</p>
                  <p className="mt-1 text-sm text-muted">
                    The link and any website embeds will stop playing. People with project access can still watch it in
                    the portal. You can turn it back on later with the same link.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="min-h-10"
                      disabled={busy !== null}
                      onClick={() => void act("disable", "Public sharing turned off")}
                    >
                      Turn off
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-10" onClick={() => setConfirming(null)}>
                      Keep public
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            {isPublic && share ? (
              <>
                {/* Link / Embed */}
                <div role="tablist" aria-label="Share as" className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1">
                  {(
                    [
                      { key: "link", label: "Copy link", icon: Link2 },
                      { key: "embed", label: "Embed on website", icon: Code2 },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={cn(
                        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition",
                        tab === key ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "link" ? (
                  <section className="space-y-3" role="tabpanel" aria-label="Video link">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        readOnly
                        value={share.watchUrl}
                        aria-label="Public video link"
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                      />
                      <Button variant="accent" className="min-h-11 shrink-0" onClick={() => void copy("link", share.watchUrl)}>
                        {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === "link" ? "Copied" : "Copy link"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <a
                        href={share.watchUrl}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open watch page
                      </a>
                      {isBusiness ? (
                        <span>
                          {share.viewCount === 1 ? "1 view" : `${share.viewCount.toLocaleString()} views`}
                          {share.estBytes > 0 ? ` · ~${formatBytes(share.estBytes)} streamed` : ""}
                        </span>
                      ) : null}
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4" role="tabpanel" aria-label="Embed code">
                    {/* Preview */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
                      <div
                        className="relative w-full overflow-hidden rounded-lg border border-border bg-black"
                        style={{ paddingTop: `${Math.min(aspectPaddingPercent(state.video.width, state.video.height), 75)}%` }}
                      >
                        <iframe
                          key={previewSrc}
                          src={previewSrc}
                          title={`Preview of ${state.video.title}`}
                          className="absolute inset-0 h-full w-full border-0"
                          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                          allowFullScreen
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Style</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(
                          [
                            {
                              key: "standard",
                              label: "Standard player",
                              hint: "Viewers press play. Listings & portfolios.",
                              value: DEFAULT_EMBED_OPTIONS,
                              fill: false,
                            },
                            {
                              key: "background",
                              label: "Background video",
                              hint: "Silent, looping, no controls. Website headers.",
                              value: BACKGROUND_EMBED_OPTIONS,
                              fill: true,
                            },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            aria-pressed={preset === p.key}
                            onClick={() => {
                              setOptions(p.value);
                              setFill(p.fill);
                              scheduleSave(p.value);
                            }}
                            className={cn(
                              "rounded-lg border p-3 text-left transition",
                              preset === p.key
                                ? "border-accent bg-accent-subtle/50 ring-1 ring-accent"
                                : "border-border hover:border-accent/50"
                            )}
                          >
                            <span className="block text-sm font-semibold text-heading">{p.label}</span>
                            <span className="mt-0.5 block text-xs text-muted">{p.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="rounded-lg border border-border">
                      <ul className="divide-y divide-border">
                        {OPTION_ROWS.map((row) => (
                          <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p id={`embed-opt-${row.key}`} className="text-sm font-medium text-heading">
                                {row.label}
                              </p>
                              <p className="text-xs text-muted">{row.hint}</p>
                            </div>
                            <Switch
                              checked={options[row.key]}
                              aria-labelledby={`embed-opt-${row.key}`}
                              onCheckedChange={(v) => updateOptions({ [row.key]: v })}
                            />
                          </li>
                        ))}
                        <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p id="embed-opt-fit" className="text-sm font-medium text-heading">
                              Fill the frame
                            </p>
                            <p className="text-xs text-muted">Crops edges instead of showing black bars</p>
                          </div>
                          <Switch
                            checked={options.fit === "cover"}
                            aria-labelledby="embed-opt-fit"
                            onCheckedChange={(v) => updateOptions({ fit: v ? "cover" : "contain" })}
                          />
                        </li>
                        <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p id="embed-opt-size" className="text-sm font-medium text-heading">
                              Stretch to fill its section
                            </p>
                            <p className="text-xs text-muted">
                              For full-width backgrounds. Off keeps the video&apos;s shape at any width.
                            </p>
                          </div>
                          <Switch checked={fill} aria-labelledby="embed-opt-size" onCheckedChange={setFill} />
                        </li>
                      </ul>
                    </div>
                    {options.autoplay && !options.muted ? (
                      <p className="flex items-start gap-2 text-xs text-muted">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Browsers block autoplay with sound, so visitors may see it start muted with a “Tap to unmute”
                        button.
                      </p>
                    ) : null}
                    {!options.controls && !options.autoplay ? (
                      <p className="flex items-start gap-2 text-xs text-muted">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Without controls, visitors tap the video to play or pause it.
                      </p>
                    ) : null}

                    {/* Code */}
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={embedCode}
                        aria-label="Embed code"
                        rows={4}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full resize-none rounded-md border border-border bg-subtle p-3 font-mono text-xs leading-relaxed text-foreground"
                      />
                      <Button variant="accent" className="min-h-11 w-full" onClick={() => void copy("embed", embedCode)}>
                        {copied === "embed" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === "embed" ? "Copied" : "Copy embed code"}
                      </Button>
                      <p className="text-xs text-muted">
                        Paste it into an “Embed”, “Custom HTML” or “Code” block — works with WordPress, Squarespace, Wix,
                        Webflow, Showit and most real estate website builders.
                        {fill ? " The section it goes in needs a height, like any background." : ""}
                      </p>
                    </div>
                  </section>
                )}

                {canManage ? (
                  <div className="border-t border-border pt-4">
                    {confirming === "reset" ? (
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium text-heading">Reset the link?</p>
                        <p className="mt-1 text-sm text-muted">
                          You&apos;ll get a new link and embed code. The current link and every website embed using it
                          will stop working.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="min-h-10"
                            disabled={busy !== null}
                            onClick={() => void act("reset_link", "New link created")}
                          >
                            {busy === "reset_link" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Reset link
                          </Button>
                          <Button size="sm" variant="outline" className="min-h-10" onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming("reset")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-heading"
                      >
                        <RotateCw className="h-3.5 w-3.5" aria-hidden /> Reset link…
                      </button>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
