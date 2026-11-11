"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Globe, Image as ImageIcon, Info, Plus, Rocket, Sparkles, Trash2, Wand2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SettingsCollapsible } from "@/components/admin/settings-collapsible";
import { BrandAssetField } from "@/components/admin/brand-asset-field";
import { PartnerBrandColorField } from "@/components/partner/partner-brand-color-field";
import { LandingEditorShell } from "@/components/landing/landing-editor-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { AppSettings, BusinessSettings } from "@/lib/app-settings";
import {
  WEBSITE_LIMITS,
  WEBSITE_SOCIAL_KEYS,
  WEBSITE_SOCIAL_LABELS,
  WEBSITE_TEMPLATE_INFO,
  WEBSITE_TEMPLATES,
  normalizeRedirectPath,
  sanitizeWebsiteSocial,
  type WebsiteHeroSource,
  type WebsiteSettings,
  type WebsiteTemplateId,
} from "@/lib/website/settings";
import { buildSiteView, defaultCtaHeading, defaultWebsiteHeadline, defaultWebsiteIntro, type SiteServiceInput } from "@/lib/website/view";
import { PortfolioManager, type PortfolioState } from "@/components/admin/business-website/portfolio-manager";
import { WebsitePreview, type PreviewPage } from "@/components/admin/business-website/website-preview";
import { MediaPickerModal } from "@/components/admin/business-website/media-picker";
import { UploadImageButton } from "@/components/admin/business-website/upload-image-button";
import { AboutPanel } from "@/components/admin/business-website/about-panel";
import { TestimonialsPanel } from "@/components/admin/business-website/testimonials-panel";

/** Editor preview serves the chosen (possibly unsaved) hero media through an admin-only route. */
const ADMIN_MEDIA_URLS = {
  image: (id: string) => `/api/admin/website/media/${id}?s=large`,
  play: (id: string) => `/api/admin/website/media/${id}?play=1`,
};

const ALIAS_SUMMARY: [string, string][] = [
  ["/about, /home", "Home"],
  ["/gallery, /work, /projects", "Portfolio"],
  ["/pricing, /packages", "Services"],
  ["/contact-us", "Contact"],
  ["/book, /booking, /schedule, /quote", "Book a shoot"],
];

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Count({ value, max }: { value: string; max: number }) {
  return <span className={cn("text-xs", value.length > max * 0.9 ? "text-amber-700" : "text-muted")}>{value.length}/{max}</span>;
}

/** Tiny drawn thumbnails so the three templates read as different at a glance. */
function TemplateThumb({ id }: { id: WebsiteTemplateId }) {
  if (id === "luxury") {
    return (
      <div className="relative h-full w-full bg-[#0E0D0C]">
        <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_40%,rgba(200,161,90,0.35),transparent_70%)]" />
        <div className="absolute left-1/2 top-[18%] h-[3px] w-6 -translate-x-1/2 bg-white/50" />
        <div className="absolute left-1/2 top-[38%] h-px w-5 -translate-x-1/2 bg-[#C8A15A]" />
        <div className="absolute left-1/2 top-[48%] h-[6px] w-[62%] -translate-x-1/2 rounded-[1px] bg-white/80" />
        <div className="absolute left-1/2 top-[60%] h-[6px] w-[44%] -translate-x-1/2 rounded-[1px] bg-white/80" />
        <div className="absolute left-1/2 top-[76%] h-[7px] w-[26%] -translate-x-1/2 border border-[#C8A15A]" />
      </div>
    );
  }
  if (id === "minimal") {
    return (
      <div className="relative h-full w-full bg-white">
        <div className="absolute left-[8%] top-[10%] h-[3px] w-5 bg-neutral-800" />
        <div className="absolute right-[8%] top-[10%] h-[3px] w-10 bg-neutral-300" />
        <div className="absolute left-[8%] top-[26%] h-[6px] w-[58%] bg-neutral-800" />
        <div className="absolute left-[8%] top-[36%] h-[6px] w-[40%] bg-neutral-800" />
        <div className="absolute left-[8%] right-[8%] top-[52%] bottom-[8%] bg-neutral-200" />
      </div>
    );
  }
  return (
    <div className="relative h-full w-full bg-gradient-to-br from-slate-600 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_85%_10%,rgba(79,70,229,0.55),transparent_60%)]" />
      <div className="absolute left-[8%] top-[10%] h-[3px] w-6 bg-white/80" />
      <div className="absolute right-[8%] top-[8%] h-[6px] w-7 rounded-full bg-indigo-400" />
      <div className="absolute bottom-[34%] left-[8%] h-[8px] w-[60%] rounded-[1px] bg-white" />
      <div className="absolute bottom-[22%] left-[8%] h-[8px] w-[44%] rounded-[1px] bg-white" />
      <div className="absolute bottom-[9%] left-[8%] h-[7px] w-[22%] rounded-full bg-indigo-400" />
    </div>
  );
}

export function BusinessWebsiteEditor({
  settings,
  savedSettings,
  services,
  siteUrl,
  websiteDomain,
  onWebsiteChange,
  onBusinessChange,
  onPublishNow,
  onOpenClassicEditor,
  saving,
  shellNav,
  shellFooter,
}: {
  settings: AppSettings;
  savedSettings: AppSettings;
  services: SiteServiceInput[];
  /** Where the website is live today (Business Website domain when connected, else portal address). */
  siteUrl: string;
  websiteDomain: { domain: string | null; connected: boolean; setupRequired: boolean };
  onWebsiteChange: (next: WebsiteSettings) => void;
  onBusinessChange: (patch: Partial<BusinessSettings>) => void;
  /** Switch the public homepage from the classic landing page to this website and save. */
  onPublishNow: () => void;
  /** Classic landing page still live: allow editing its content. */
  onOpenClassicEditor?: () => void;
  saving: boolean;
  shellNav: React.ReactNode;
  shellFooter: React.ReactNode;
}) {
  const website = settings.website;
  const saved = savedSettings.website;
  const business = settings.business;
  const set = useCallback((patch: Partial<WebsiteSettings>) => onWebsiteChange({ ...website, ...patch }), [onWebsiteChange, website]);

  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [page, setPage] = useState<PreviewPage>({ key: "home" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/website/portfolio", { credentials: "include" });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as PortfolioState;
        if (!cancelled) setPortfolio(data);
      } catch {
        if (!cancelled) setPortfolio({ candidates: [], projects: [] });
      } finally {
        if (!cancelled) setPortfolioLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const serviceNames = services.map((s) => s.name);
  const autoHeadline = defaultWebsiteHeadline(business.businessName, serviceNames, business.tagline);
  const autoIntro = defaultWebsiteIntro(business.businessName, serviceNames);
  const autoCta = defaultCtaHeading(serviceNames, business.tagline);

  const view = useMemo(
    () =>
      buildSiteView({
        website,
        business: {
          name: business.businessName || business.portalName,
          tagline: business.tagline,
          logoUrl: business.logoUrl,
          primaryColor: business.brandPrimaryColor,
          accentColor: business.brandAccentColor,
          email: business.primaryContactEmail || business.supportEmail,
          phone: business.phoneNumber,
          websiteUrl: business.websiteUrl,
          addressLine1: business.addressLine1,
          addressLine2: business.addressLine2,
          city: business.city,
          state: business.state,
          postalCode: business.postalCode,
          legalName: business.legalName,
          termsUrl: business.termsUrl,
          privacyUrl: business.privacyUrl,
        },
        services,
        portfolio: portfolio?.projects ?? [],
        links: { clientLogin: "/login", request: "/request" },
        mediaUrls: ADMIN_MEDIA_URLS,
      }),
    [website, business, services, portfolio]
  );
  const previewView = useDebouncedValue(view, 120);

  const dirtyWebsite = !same(website, saved);
  const contactKeys: (keyof BusinessSettings)[] = ["primaryContactEmail", "phoneNumber", "websiteUrl"];
  const dirtyContact = contactKeys.some((k) => business[k] !== savedSettings.business[k]);
  const dirtyAppearance = !same(
    [website.template, website.accentColor, website.heroSource, website.heroImageUrl, website.heroVideoUrl, website.heroImageMedia, website.heroVideoMedia, website.showPoweredBy, business.logoUrl],
    [saved.template, saved.accentColor, saved.heroSource, saved.heroImageUrl, saved.heroVideoUrl, saved.heroImageMedia, saved.heroVideoMedia, saved.showPoweredBy, savedSettings.business.logoUrl]
  );
  const dirtyHome = !same(
    [website.headline, website.intro, website.featuredServiceIds, website.ctaLabel],
    [saved.headline, saved.intro, saved.featuredServiceIds, saved.ctaLabel]
  );
  const dirtyContactSection =
    dirtyContact ||
    !same(
      [website.contactIntro, website.ctaHeading, website.ctaText, website.social, website.showAddress, website.showClientLogin],
      [saved.contactIntro, saved.ctaHeading, saved.ctaText, saved.social, saved.showAddress, saved.showClientLogin]
    );
  const dirtyAdvanced = !same(
    [website.seoTitle, website.seoDescription, website.redirects, website.showServicePricing, website.launched],
    [saved.seoTitle, saved.seoDescription, saved.redirects, saved.showServicePricing, saved.launched]
  );
  const dirty = dirtyWebsite || dirtyContact || business.logoUrl !== savedSettings.business.logoUrl;

  const statusTone: "live" | "draft" | "classic" = !saved.launched ? "classic" : dirty ? "draft" : "live";
  const statusLabel = !saved.launched ? "Not live yet" : dirty ? "Unsaved — preview only" : "Live";

  const allServiceIds = services.map((s) => s.id);
  const featuredSet = new Set(website.featuredServiceIds ?? allServiceIds);
  const publishedCount = portfolio?.projects.length ?? 0;
  const suggestedCount = portfolio?.candidates.filter((c) => c.status === "suggested").length ?? 0;

  const [newRedirect, setNewRedirect] = useState({ from: "", to: "/" });
  const [picker, setPicker] = useState<"photo" | "video" | "about" | null>(null);
  const redirectFrom = normalizeRedirectPath(newRedirect.from);
  const redirectError =
    newRedirect.from.trim() && (!redirectFrom || redirectFrom === "/") ? "Enter the part after your domain, like /weddings or /about-us." : null;
  const pageLabel = (to: string) =>
    ({ "/": "Home", "/portfolio": "Portfolio", "/services": "Services", "/contact": "Contact", "/request": "Book a shoot" })[to] ??
    portfolio?.projects.find((p) => `/portfolio/${p.slug}` === to)?.title ??
    to;
  const siteHost = (websiteDomain.domain ?? siteUrl.replace(/^https?:\/\//, "")).replace(/\/$/, "");
  const addRedirect = () => {
    if (!redirectFrom || redirectFrom === "/") return;
    set({ redirects: [...website.redirects.filter((x) => x.from !== redirectFrom), { from: redirectFrom, to: newRedirect.to }].slice(0, WEBSITE_LIMITS.redirectsMax) });
    setNewRedirect({ from: "", to: "/" });
  };

  const goToDomain = () => {
    // Settings page: switch section in place. Elsewhere (Sites → Business Website): open the
    // domain section in Settings (the browser's unsaved-changes prompt still applies).
    if (window.location.pathname === "/admin/settings") window.location.hash = "settings-website-domain";
    else window.location.assign("/admin/settings#settings-website-domain");
  };

  const form = (
    <div className="space-y-4">
      {/* Where the website lives + domain shortcut */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm surface-dark:bg-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your website</p>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1.5 break-all text-sm font-semibold text-heading hover:text-accent">
          {siteUrl.replace(/^https?:\/\//, "")} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={goToDomain}>
            <Globe className="h-4 w-4" /> Manage website domain
          </Button>
        </div>
        {!websiteDomain.domain ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2">
            <p className="text-xs text-muted">Want to use your own domain? Connect your existing website address.</p>
            <button type="button" onClick={goToDomain} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Connect domain <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ) : !websiteDomain.connected ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {websiteDomain.domain} is waiting for DNS. Your website stays live at the address above meanwhile.
          </p>
        ) : null}
      </div>

      {!saved.launched ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Sparkles className="h-4 w-4 text-accent" /> Your new Business Website is ready
          </p>
          <p className="mt-1 text-sm text-muted">
            Visitors still see your classic landing page. Preview the new site on the right, then publish it when you’re happy — nothing changes until you do.
          </p>
          <Button type="button" variant="accent" size="sm" className="mt-3" disabled={saving} onClick={onPublishNow}>
            <Rocket className="h-4 w-4" /> Publish new website
          </Button>
        </div>
      ) : null}

      <SettingsCollapsible id="settings-website-appearance" title="Appearance" description="Template, logo, colors and hero image." defaultOpen dirty={dirtyAppearance}>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Template</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Website template">
              {WEBSITE_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={website.template === t}
                  onClick={() => set({ template: t })}
                  className={cn("overflow-hidden rounded-lg border text-left transition", website.template === t ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-heading/30")}
                >
                  <div className="aspect-[4/3]">
                    <TemplateThumb id={t} />
                  </div>
                  <p className="px-2 pt-1.5 text-xs font-semibold text-heading">{WEBSITE_TEMPLATE_INFO[t].name}</p>
                  <p className="px-2 pb-2 text-[11px] leading-snug text-muted">{WEBSITE_TEMPLATE_INFO[t].blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <BrandAssetField kind="logo" value={business.logoUrl} inputId="website-logo" onUrlChange={(logoUrl) => onBusinessChange({ logoUrl })} />
            <p className="text-xs text-muted">The same logo as your client portal (Branding &amp; Colors).</p>
          </div>

          <PartnerBrandColorField
            id="website-accent"
            label="Accent color"
            value={website.accentColor}
            fallback={business.brandAccentColor || "#4F46E5"}
            help="Buttons and highlights. Leave on default to use your brand accent color."
            onChange={(accentColor) => set({ accentColor })}
            onReset={() => set({ accentColor: "" })}
          />

          <div className="space-y-3">
            <Label>Hero</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["auto", "Automatic", Wand2],
                  ["image", "Image", ImageIcon],
                  ["video", "Video", Clapperboard],
                  ["design", "Designed", Sparkles],
                ] as [WebsiteHeroSource, string, typeof Wand2][]
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={website.heroSource === k}
                  onClick={() => set({ heroSource: k })}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium", website.heroSource === k ? "border-accent bg-accent/5 text-heading" : "border-border text-muted hover:text-heading")}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            {website.heroSource === "auto" ? (
              <p className="text-xs text-muted">
                Uses the cover photo of your featured portfolio work. {publishedCount ? "" : "Until you publish a project, a designed background matched to your template is shown."}
              </p>
            ) : null}
            {website.heroSource === "design" ? <p className="text-xs text-muted">A typographic background in your colors — no stock photos.</p> : null}
            {website.heroSource === "image" ? (
              <div className="space-y-3">
                <Label>Hero image</Label>
                {website.heroImageMedia || website.heroImageUrl ? (
                  <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-slate-100 surface-dark:bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={website.heroImageMedia ? `/api/admin/website/media/${website.heroImageMedia.id}?s=medium` : website.heroImageUrl}
                      alt="Selected hero"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicker("photo")}>
                    <ImageIcon className="h-4 w-4" /> Select from your media
                  </Button>
                  <UploadImageButton onUploaded={(heroImageUrl) => set({ heroImageUrl, heroImageMedia: null })} />
                  {website.heroImageMedia || website.heroImageUrl ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => set({ heroImageMedia: null, heroImageUrl: "" })}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {website.heroSource === "video" ? (
              <div className="space-y-3">
                <Label>Hero video</Label>
                {website.heroVideoMedia || website.heroVideoUrl ? (
                  <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        website.heroVideoMedia?.source === "youtube"
                          ? `https://img.youtube.com/vi/${website.heroVideoMedia.youtubeId}/hqdefault.jpg`
                          : website.heroVideoMedia
                            ? `/api/admin/website/media/${website.heroVideoMedia.id}?s=medium`
                            : `https://img.youtube.com/vi/${(website.heroVideoUrl.match(/[A-Za-z0-9_-]{11}(?=[^A-Za-z0-9_-]|$)/) ?? [""])[0]}/hqdefault.jpg`
                      }
                      alt="Selected hero video"
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">Video</span>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setPicker("video")}>
                    <Clapperboard className="h-4 w-4" /> {website.heroVideoMedia || website.heroVideoUrl ? "Change video" : "Select video"}
                  </Button>
                  {website.heroVideoMedia || website.heroVideoUrl ? (
                    <Button type="button" variant="ghost" onClick={() => set({ heroVideoMedia: null, heroVideoUrl: "" })}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted">Choose a video from your ShootPortal media. It plays muted in a loop behind your headline.</p>
              </div>
            ) : null}
          </div>

          <label className="flex items-center justify-between gap-3 border-t border-border pt-5 text-sm">
            <span>
              Show “Powered by ShootPortal” in footer
              <span className="block text-xs text-muted">A small credit at the very bottom of your website.</span>
            </span>
            <Switch checked={website.showPoweredBy} onCheckedChange={(showPoweredBy) => set({ showPoweredBy })} />
          </label>
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible id="settings-website-homepage" title="Homepage" description="Headline, services and featured work." dirty={dirtyHome}>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="website-headline">Headline</Label>
              <Count value={website.headline} max={WEBSITE_LIMITS.headline} />
            </div>
            <Input id="website-headline" value={website.headline} maxLength={WEBSITE_LIMITS.headline} placeholder={autoHeadline} onChange={(e) => set({ headline: e.target.value })} />
            <p className="text-xs text-muted">Leave blank for the automatic headline shown in gray.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="website-intro">Short description (optional)</Label>
              <Count value={website.intro} max={WEBSITE_LIMITS.intro} />
            </div>
            <Textarea id="website-intro" rows={3} value={website.intro} maxLength={WEBSITE_LIMITS.intro} placeholder={autoIntro} onChange={(e) => set({ intro: e.target.value })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Featured services</Label>
              {services.length ? (
                <label className="flex items-center gap-2 text-xs text-muted">
                  Show all
                  <Switch checked={website.featuredServiceIds === null} onCheckedChange={(on) => set({ featuredServiceIds: on ? null : allServiceIds })} />
                </label>
              ) : null}
            </div>
            {services.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      id={`svc-${s.id}`}
                      className="h-4 w-4"
                      checked={featuredSet.has(s.id)}
                      onChange={(e) => {
                        const base = website.featuredServiceIds ?? allServiceIds;
                        set({ featuredServiceIds: e.target.checked ? allServiceIds.filter((id) => base.includes(id) || id === s.id) : base.filter((id) => id !== s.id) });
                      }}
                    />
                    <label htmlFor={`svc-${s.id}`} className="min-w-0 flex-1 truncate text-sm text-heading">
                      {s.name}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                Add services in <a href="#settings-services" className="font-medium text-accent hover:underline">Settings → Services</a> and they appear on your website automatically.
              </p>
            )}
            <p className="text-xs text-muted">Names, descriptions and prices come from your Services settings — no need to type them twice.</p>
          </div>

          <div className="space-y-2">
            <Label>Featured work</Label>
            {portfolio?.candidates.some((c) => c.status === "published") ? (
              <p className="text-xs text-muted">
                Star projects in the Portfolio section below to feature them here. {portfolio.candidates.filter((c) => c.entry?.featured).length} featured.
              </p>
            ) : (
              <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                This section appears once you add delivered projects to your portfolio{suggestedCount ? ` — ${suggestedCount} suggested and ready to review.` : "."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-cta-label">Booking button label</Label>
            <Input id="website-cta-label" value={website.ctaLabel} maxLength={WEBSITE_LIMITS.ctaLabel} placeholder="Book a Shoot" onChange={(e) => set({ ctaLabel: e.target.value })} />
            <p className="text-xs text-muted">Opens your existing project request form.</p>
          </div>
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible
        id="settings-website-testimonials"
        title="Client Testimonials"
        description={
          website.testimonials.items.length
            ? `${website.testimonials.enabled ? "On" : "Off"} · ${website.testimonials.items.length} review${website.testimonials.items.length === 1 ? "" : "s"}`
            : "Showcase what your clients are saying."
        }
        dirty={!same(website.testimonials, saved.testimonials)}
      >
        <TestimonialsPanel value={website.testimonials} onChange={(testimonials) => set({ testimonials })} onPreview={() => setPage({ key: "home" })} />
      </SettingsCollapsible>

      <SettingsCollapsible
        id="settings-website-portfolio"
        title="Portfolio"
        description={portfolioLoading ? "Projects you’ve delivered." : `${publishedCount} on your website${suggestedCount ? ` · ${suggestedCount} suggested` : ""}`}
        defaultOpen={suggestedCount > 0 && publishedCount === 0}
      >
        <PortfolioManager state={portfolio} loading={portfolioLoading} onState={setPortfolio} />
      </SettingsCollapsible>

      <SettingsCollapsible
        id="settings-website-about"
        title="About Us"
        description={website.about.enabled ? "On · your About page is in the website menu." : "Tell visitors a little about your business."}
        dirty={!same(website.about, saved.about)}
      >
        <AboutPanel
          value={website.about}
          onChange={(about) => set({ about })}
          businessName={business.businessName || business.portalName}
          serviceNames={serviceNames}
          tagline={business.tagline}
          onPickPhoto={() => setPicker("about")}
          onPreview={() => setPage({ key: "about" })}
        />
      </SettingsCollapsible>

      <SettingsCollapsible id="settings-website-contact" title="Contact & Booking" description="Contact details, request form and calls to action." dirty={dirtyContactSection}>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website-email">Email</Label>
              <Input id="website-email" type="email" value={business.primaryContactEmail} onChange={(e) => onBusinessChange({ primaryContactEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-phone">Phone</Label>
              <Input id="website-phone" type="tel" value={business.phoneNumber} onChange={(e) => onBusinessChange({ phoneNumber: e.target.value })} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted">Shared with Contact Information. Empty fields are simply hidden on your website.</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Show studio address
              <span className="block text-xs text-muted">From Contact Information. Off by default.</span>
            </span>
            <Switch checked={website.showAddress} onCheckedChange={(showAddress) => set({ showAddress })} />
          </label>
          <div className="space-y-2">
            <Label htmlFor="website-contact-intro">Contact page message (optional)</Label>
            <Textarea
              id="website-contact-intro"
              rows={2}
              value={website.contactIntro}
              maxLength={WEBSITE_LIMITS.contactIntro}
              placeholder={`Have a project in mind? Send us the details below and ${business.businessName || "we"} will get back to you shortly.`}
              onChange={(e) => set({ contactIntro: e.target.value })}
            />
          </div>
          <div className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
            <Info className="mr-1 inline h-3.5 w-3.5" />
            Your Contact page embeds your existing project request form — same fields, estimates, notifications and workflow as <code>/request</code>.
          </div>
          <div className="space-y-2">
            <Label htmlFor="website-cta-heading">Booking headline (optional)</Label>
            <Input id="website-cta-heading" value={website.ctaHeading} maxLength={WEBSITE_LIMITS.ctaHeading} placeholder={autoCta} onChange={(e) => set({ ctaHeading: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website-cta-text">Booking text (optional)</Label>
            <Input
              id="website-cta-text"
              value={website.ctaText}
              maxLength={WEBSITE_LIMITS.ctaText}
              placeholder="Tell us a little about your project. It only takes a minute."
              onChange={(e) => set({ ctaText: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <Label>Social links</Label>
            {WEBSITE_SOCIAL_KEYS.map((k) => {
              const v = website.social[k];
              const invalid = Boolean(v.trim()) && !sanitizeWebsiteSocial(k, v);
              return (
                <div key={k} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                  <Label htmlFor={`social-${k}`} className="text-xs text-muted">
                    {WEBSITE_SOCIAL_LABELS[k]}
                  </Label>
                  <div>
                    <Input
                      id={`social-${k}`}
                      value={v}
                      placeholder={`https://${k === "youtube" ? "youtube.com/@" : k === "linkedin" ? "linkedin.com/company/" : `${k}.com/`}yourstudio`}
                      onChange={(e) => set({ social: { ...website.social, [k]: e.target.value } })}
                    />
                    {invalid ? <p className="mt-1 text-xs text-red-700">Paste the full {WEBSITE_SOCIAL_LABELS[k]} link (https://…).</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Show “Client Login”
              <span className="block text-xs text-muted">Links to your client portal sign-in.</span>
            </span>
            <Switch checked={website.showClientLogin} onCheckedChange={(showClientLogin) => set({ showClientLogin })} />
          </label>
        </div>
      </SettingsCollapsible>

      <SettingsCollapsible id="settings-website-advanced" title="Advanced" description="Search engines, old website links and pricing." dirty={dirtyAdvanced}>
        <div className="space-y-6">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Show service prices
              <span className="block text-xs text-muted">Uses each service’s “starting at” label or estimate price.</span>
            </span>
            <Switch checked={website.showServicePricing} onCheckedChange={(showServicePricing) => set({ showServicePricing })} />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="website-seo-title">Search title (optional)</Label>
              <Count value={website.seoTitle} max={WEBSITE_LIMITS.seoTitle} />
            </div>
            <Input id="website-seo-title" value={website.seoTitle} maxLength={WEBSITE_LIMITS.seoTitle} placeholder={`${business.businessName} | ${autoHeadline}`.slice(0, 70)} onChange={(e) => set({ seoTitle: e.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="website-seo-desc">Search description (optional)</Label>
              <Count value={website.seoDescription} max={WEBSITE_LIMITS.seoDescription} />
            </div>
            <Textarea id="website-seo-desc" rows={2} value={website.seoDescription} maxLength={WEBSITE_LIMITS.seoDescription} placeholder={autoIntro} onChange={(e) => set({ seoDescription: e.target.value })} />
          </div>

          <div className="space-y-3 border-t border-border pt-5">
            <div>
              <p className="text-sm font-medium text-heading">Redirects from your old website</p>
              <p className="mt-1 text-xs text-muted">
                Replacing a Squarespace, Wix or WordPress site? People and Google may still use links to your old pages. Tell us an old page and where
                it should go now, so those links don’t break. Only needed once your own domain points to ShootPortal.
              </p>
            </div>

            {website.redirects.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {website.redirects.map((r) => (
                  <li key={r.from} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate text-heading">
                        <span className="text-muted">{siteHost}</span>
                        {r.from}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <ArrowRight className="h-3 w-3 shrink-0" /> goes to <span className="font-medium text-heading">{pageLabel(r.to)}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted"
                      aria-label={`Remove redirect ${r.from}`}
                      onClick={() => set({ redirects: website.redirects.filter((x) => x.from !== r.from) })}
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border bg-subtle/50 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="redirect-from">Old page address</Label>
                <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-accent surface-dark:bg-card">
                  <span className="max-w-[45%] shrink-0 truncate border-r border-border bg-subtle px-2.5 py-2.5 text-xs text-muted">{siteHost}</span>
                  <input
                    id="redirect-from"
                    value={newRedirect.from}
                    placeholder="/old-page"
                    onChange={(e) => setNewRedirect((r) => ({ ...r, from: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRedirect();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-foreground outline-none"
                  />
                </div>
                {redirectError ? (
                  <p className="text-xs text-red-700">{redirectError}</p>
                ) : (
                  <p className="text-xs text-muted">Type the path (e.g. /weddings) or paste the full old link.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redirect-to">Send visitors to</Label>
                <select
                  id="redirect-to"
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm surface-dark:bg-card"
                  value={newRedirect.to}
                  onChange={(e) => setNewRedirect((r) => ({ ...r, to: e.target.value }))}
                >
                  <option value="/">Home</option>
                  <option value="/portfolio">Portfolio</option>
                  <option value="/services">Services</option>
                  <option value="/contact">Contact</option>
                  <option value="/request">Book a shoot</option>
                  {(portfolio?.projects ?? []).map((p) => (
                    <option key={p.slug} value={`/portfolio/${p.slug}`}>
                      Portfolio: {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={!redirectFrom || redirectFrom === "/"} onClick={addRedirect}>
                <Plus className="h-4 w-4" /> Add redirect
              </Button>
            </div>

            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-medium text-heading">Already handled automatically</summary>
              <ul className="mt-2 space-y-1">
                {ALIAS_SUMMARY.map(([from, to]) => (
                  <li key={from} className="flex items-center gap-1.5">
                    <code>{from}</code> <ArrowRight className="h-3 w-3" /> {to}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Homepage</Label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Show the Business Website as my homepage
                <span className="block text-xs text-muted">Turn off to keep the classic client landing page live instead.</span>
              </span>
              <Switch checked={website.launched} onCheckedChange={(launched) => set({ launched })} />
            </label>
            {onOpenClassicEditor ? (
              <button type="button" onClick={onOpenClassicEditor} className="text-xs font-medium text-accent hover:underline">
                Edit the classic landing page
              </button>
            ) : null}
          </div>
        </div>
      </SettingsCollapsible>
    </div>
  );

  return (
    <>
    {picker ? (
      <MediaPickerModal
        kind={picker === "video" ? "video" : "photo"}
        title={picker === "about" ? "Choose a photo for your About page" : picker === "video" ? "Choose a hero video" : "Choose a hero image"}
        selectedId={(picker === "photo" ? website.heroImageMedia?.id : picker === "about" ? website.about.imageMedia?.id : website.heroVideoMedia?.id) ?? null}
        onClose={() => setPicker(null)}
        onSelect={(m) => {
          if (picker === "about") {
            set({ about: { ...website.about, imageMedia: m, imageUrl: "" } });
            setPage({ key: "about" });
          } else set(picker === "photo" ? { heroImageMedia: m, heroImageUrl: "" } : { heroVideoMedia: m, heroVideoUrl: "" });
          setPicker(null);
        }}
      />
    ) : null}
    <LandingEditorShell
      nav={shellNav}
      form={form}
      formFooter={shellFooter}
      canvas={
        <WebsitePreview
          view={previewView}
          page={page}
          onPageChange={setPage}
          instantPreliminaryEstimate={settings.proposals.autoPreliminaryEstimate !== false}
          statusLabel={statusLabel}
          statusTone={statusTone}
          liveUrl={siteUrl}
        />
      }
    />
    </>
  );
}
