"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, EyeOff, ImageIcon, Loader2, Plus, RotateCcw, Star, Trash2, Video, View } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { WEBSITE_LIMITS, type PortfolioEntry } from "@/lib/website/settings";
import type { PortfolioCandidate, PortfolioMediaChoice } from "@/lib/website/portfolio-server";
import type { SitePortfolioProject, SiteTour } from "@/lib/website/view";

export type PortfolioState = { candidates: PortfolioCandidate[]; projects: SitePortfolioProject[] };

const ADDRESS_RE = /\b\d{1,6}\s+[a-z0-9.'-]+(\s+[a-z0-9.'-]+){0,3}\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle|hwy|pkwy|ter|trail|trl)\b/i;

async function api(body: Record<string, unknown>): Promise<PortfolioState> {
  const res = await fetch("/api/admin/website/portfolio", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as PortfolioState & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
  return data;
}

function Thumb({ url, className }: { url: string | null; className?: string }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md bg-slate-100 surface-dark:bg-subtle", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-muted" />
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

export function PortfolioManager({
  state,
  loading,
  onState,
}: {
  state: PortfolioState | null;
  loading: boolean;
  onState: (s: PortfolioState) => void;
}) {
  const [tab, setTab] = useState<"published" | "suggested" | "dismissed">("published");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortfolioCandidate | null>(null);

  const groups = useMemo(() => {
    const c = state?.candidates ?? [];
    return {
      published: c.filter((x) => x.status === "published"),
      suggested: c.filter((x) => x.status === "suggested"),
      dismissed: c.filter((x) => x.status === "dismissed"),
    };
  }, [state]);

  useEffect(() => {
    if (state && !groups.published.length && groups.suggested.length) setTab("suggested");
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(state)]);

  async function act(action: string, projectId: string, success: string) {
    setBusyId(projectId);
    try {
      onState(await api({ action, projectId }));
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !state) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your delivered projects…
      </p>
    );
  }

  const list = groups[tab];
  const live = new Set(state?.projects.map((p) => p.projectId) ?? []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Delivered projects appear here as suggestions. Nothing is public until you choose <strong className="font-medium text-heading">Add to Portfolio</strong> and pick
        the photos to show. Addresses, client details, invoices and notes are never shown. Portfolio changes go live right away.
      </p>

      <div className="flex gap-1 rounded-lg border border-border p-1" role="tablist">
        {(
          [
            ["published", `On your website (${groups.published.length})`],
            ["suggested", `Suggested (${groups.suggested.length})`],
            ["dismissed", `Hidden (${groups.dismissed.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium", tab === k ? "bg-accent/10 text-heading" : "text-muted hover:text-heading")}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted">
          {tab === "published"
            ? groups.suggested.length
              ? "No projects on your website yet. Open Suggested to add your best delivered work."
              : "When projects reach the Delivered stage they’ll be suggested here."
            : tab === "suggested"
              ? "No new suggestions. Projects show up here once they’re Delivered."
              : "Nothing hidden."}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => {
            const busy = busyId === c.projectId;
            const e = c.entry;
            return (
              <li key={c.projectId} className="flex items-center gap-3 rounded-lg border border-border bg-white p-2.5 surface-dark:bg-card">
                <Thumb url={c.coverThumbUrl} className="h-14 w-20" />
                <div className="min-w-0 flex-1">
                  {e ? (
                    <>
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-heading">
                        {e.featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
                        <span className="truncate">{e.title}</span>
                      </p>
                      <p className="truncate text-xs text-muted">Internal: {c.internalName}</p>
                      {c.offline || !live.has(c.projectId) ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> Hidden from the public site — the project is no longer Delivered or its photos aren’t visible to clients.
                        </p>
                      ) : (
                        <p className="text-xs text-muted">
                          {e.mediaIds.length} item{e.mediaIds.length === 1 ? "" : "s"} shown{e.category ? ` · ${e.category}` : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium text-heading">{c.internalName}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>Delivered {formatDate(c.deliveredAt)}</span>
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" /> {c.photoCount}
                        </span>
                        {c.videoCount ? (
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3 w-3" /> {c.videoCount}
                          </span>
                        ) : null}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null}
                  {tab === "published" && e ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={busy}
                        aria-label={e.featured ? "Remove from featured" : "Feature on homepage"}
                        title={e.featured ? "Featured on your homepage" : "Feature on your homepage"}
                        onClick={() => void act(e.featured ? "unfeature" : "feature", c.projectId, e.featured ? "Removed from featured work" : "Featured on your homepage")}
                      >
                        <Star className={cn("h-4 w-4", e.featured ? "fill-amber-400 text-amber-400" : "text-muted")} />
                      </Button>
                      {!c.offline ? (
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={busy}
                        aria-label="Remove from portfolio"
                        title="Remove from portfolio (the project and its media are not deleted)"
                        onClick={() => {
                          if (window.confirm(`Remove “${e.title}” from your public portfolio? The project and its media stay in ShootPortal.`)) {
                            void act("remove", c.projectId, "Removed from your portfolio");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted" />
                      </Button>
                    </>
                  ) : null}
                  {tab === "suggested" ? (
                    <>
                      <Button type="button" size="sm" variant="accent" disabled={busy} onClick={() => setEditing(c)}>
                        <Plus className="h-3.5 w-3.5" /> Add to Portfolio
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={busy}
                        aria-label="Don’t suggest this project"
                        title="Don’t suggest this project"
                        onClick={() => void act("dismiss", c.projectId, "Hidden from suggestions")}
                      >
                        <EyeOff className="h-4 w-4 text-muted" />
                      </Button>
                    </>
                  ) : null}
                  {tab === "dismissed" ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void act("restore", c.projectId, "Back in suggestions")}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <PublishDialog
          candidate={editing}
          onClose={() => setEditing(null)}
          onPublished={(s, wasNew) => {
            onState(s);
            setEditing(null);
            setTab("published");
            toast.success(wasNew ? "Published to your portfolio" : "Portfolio project updated");
          }}
        />
      ) : null}
    </div>
  );
}

type Choices = {
  project: { id: string; internalName: string; serviceType: string; coverImageId: string | null };
  media: PortfolioMediaChoice[];
  tours: SiteTour[];
  entry: PortfolioEntry | null;
};

function PublishDialog({
  candidate,
  onClose,
  onPublished,
}: {
  candidate: PortfolioCandidate;
  onClose: () => void;
  onPublished: (s: PortfolioState, wasNew: boolean) => void;
}) {
  const [choices, setChoices] = useState<Choices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [tourIds, setTourIds] = useState<string[]>([]);
  const [featured, setFeatured] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/website/portfolio/${candidate.projectId}`, { credentials: "include" });
        const data = (await res.json()) as Choices & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not load this project.");
        if (cancelled) return;
        setChoices(data);
        const e = data.entry;
        if (e) {
          setTitle(e.title);
          setCategory(e.category);
          setDescription(e.description);
          setSelected(e.mediaIds.filter((id) => data.media.some((m) => m.id === id)));
          setCoverId(e.coverId);
          setTourIds(e.tourIds);
          setFeatured(e.featured);
        } else {
          // Suggested defaults — the business reviews every item before anything is public.
          setTitle(data.project.serviceType ? `${data.project.serviceType} Project` : "Featured Project");
          setCategory(data.project.serviceType);
          const photos = data.media.filter((m) => m.type === "photo").slice(0, 24).map((m) => m.id);
          const videos = data.media.filter((m) => m.type === "video").slice(0, 3).map((m) => m.id);
          setSelected([...photos, ...videos]);
          const cover = data.project.coverImageId && photos.includes(data.project.coverImageId) ? data.project.coverImageId : photos[0] ?? null;
          setCoverId(cover);
          setTourIds([]);
          setFeatured(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this project.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidate.projectId]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const photos = choices?.media.filter((m) => m.type === "photo") ?? [];
  const videos = choices?.media.filter((m) => m.type === "video") ?? [];
  const looksLikeAddress = ADDRESS_RE.test(title) || (choices ? title.trim().toLowerCase() === choices.project.internalName.toLowerCase() : false);
  const isNew = !choices?.entry;

  async function save() {
    setSaving(true);
    try {
      const s = await api({
        action: "publish",
        projectId: candidate.projectId,
        title,
        category,
        description,
        mediaIds: choices ? choices.media.map((m) => m.id).filter((id) => selected.includes(id)) : selected,
        coverId,
        tourIds,
        featured,
      });
      onPublished(s, isNew);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add to Portfolio" : "Edit portfolio project"}
      className="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{selected.length + tourIds.length} item{selected.length + tourIds.length === 1 ? "" : "s"} will be public.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="accent" onClick={() => void save()} disabled={saving || !choices || !title.trim() || selected.length + tourIds.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isNew ? "Publish to Portfolio" : "Save changes"}
            </Button>
          </div>
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !choices ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading project media…
        </p>
      ) : (
        <div className="space-y-6 pb-2">
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
            Internal project: <span className="font-medium text-heading">{choices.project.internalName}</span> — visitors never see this name, the address or the
            client.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pf-title">Public title</Label>
              <Input id="pf-title" value={title} maxLength={WEBSITE_LIMITS.portfolioTitle} onChange={(e) => setTitle(e.target.value)} placeholder="Modern Coastal Residence" />
              {looksLikeAddress ? (
                <p className="flex items-center gap-1.5 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> This looks like an address or client name. Consider a descriptive title like “Modern Coastal Residence”.
                </p>
              ) : (
                <p className="text-xs text-muted">Describe the work, not the client — avoid street addresses and names.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-category">Category (optional)</Label>
              <Input id="pf-category" value={category} maxLength={WEBSITE_LIMITS.portfolioCategory} onChange={(e) => setCategory(e.target.value)} placeholder="Real Estate" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Feature on my homepage
            </label>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pf-desc">Short description (optional)</Label>
              <Textarea id="pf-desc" rows={2} value={description} maxLength={WEBSITE_LIMITS.portfolioDescription} onChange={(e) => setDescription(e.target.value)} placeholder="Twilight exteriors and interiors for a waterfront listing." />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-heading">
                Photos <span className="font-normal text-muted">({photos.filter((p) => selected.includes(p.id)).length} of {photos.length} selected)</span>
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-accent hover:underline" onClick={() => setSelected((s) => Array.from(new Set([...s, ...photos.map((p) => p.id)])))}>
                  Select all
                </button>
                <button type="button" className="text-accent hover:underline" onClick={() => setSelected((s) => s.filter((id) => !photos.some((p) => p.id === id)))}>
                  Clear
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">Click to include or exclude. ★ marks the cover image. Only photos your client can see are offered.</p>
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <div key={m.id} className={cn("group relative aspect-[4/3] overflow-hidden rounded-md ring-2", on ? "ring-accent" : "ring-transparent opacity-50")}>
                      <button type="button" onClick={() => toggle(m.id)} className="absolute inset-0" aria-pressed={on} aria-label={`${on ? "Exclude" : "Include"} ${m.label}`}>
                        {m.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </button>
                      {on ? (
                        <span className="pointer-events-none absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                      {on ? (
                        <button
                          type="button"
                          onClick={() => setCoverId(m.id)}
                          className={cn("absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full", coverId === m.id ? "bg-amber-400 text-white" : "bg-black/45 text-white opacity-0 group-hover:opacity-100")}
                          aria-label="Use as cover image"
                          title="Use as cover image"
                        >
                          <Star className={cn("h-3.5 w-3.5", coverId === m.id && "fill-current")} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">No client-visible photos in this project.</p>
            )}
          </div>

          {videos.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-heading">Videos</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {videos.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={on} className={cn("relative aspect-video overflow-hidden rounded-md bg-slate-800 ring-2", on ? "ring-accent" : "ring-transparent opacity-50")}>
                      {m.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                      <Video className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {choices.tours.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-heading">Virtual tours</p>
              {choices.tours.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={tourIds.includes(t.id)} onChange={() => setTourIds((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))} />
                  <View className="h-4 w-4 text-muted" /> {t.title}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
