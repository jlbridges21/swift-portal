import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, Minus, Plus, Plane, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BlogCard } from "@/components/blog/blog-card";
import { getArticle, toCardData } from "@/lib/blog/registry";
import { BLOG_AUTHORS } from "@/lib/blog/authors";
import type { BlogSlug } from "@/lib/blog/slugs";
import type { BlogRenderContext } from "@/lib/blog/types";
import { getSolutionPage, type SolutionKey } from "@/lib/solutions";
import type { SolutionVideoAsset } from "@/lib/solution-media";
import { DemoVideo, LoopVideo } from "@/components/solutions/solution-media";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the commercial "Solutions" landing pages. Server components;
 * motion is CSS-only (mk-* classes in marketing.css, reduced-motion aware). Signup
 * links carry data-sp-cta so the existing first-party analytics attributes clicks.
 * Product claims must stay within the verified fact sheet (docs/SEO-KEYWORD-MAP.md).
 */

export const SECTION_X = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8";

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", tone === "dark" ? "text-[#A5B4FC]" : "text-[#4F46E5]")}>
      {children}
    </p>
  );
}

export function GradientText({ children }: { children: ReactNode }) {
  return <span className="bg-gradient-to-r from-[#4F46E5] via-[#6D28D9] to-[#A855F7] bg-clip-text text-transparent">{children}</span>;
}

export function TrialButton({
  ctaId,
  trialDays,
  label,
  tone = "light",
  size = "lg",
}: {
  ctaId: string;
  trialDays: number;
  label?: string;
  tone?: "light" | "dark";
  size?: "lg" | "md";
}) {
  return (
    <Link
      href="/signup"
      data-sp-cta={ctaId}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-[#4338CA] hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        tone === "dark" ? "focus-visible:ring-white focus-visible:ring-offset-[#0B1124]" : "focus-visible:ring-[#4F46E5]",
        size === "lg" ? "min-h-12 px-7 text-base" : "min-h-11 px-5 text-sm"
      )}
    >
      {label ?? (trialDays > 0 ? `Start your ${trialDays}-day free trial` : "Start free")}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function SecondaryButton({ href, children, tone = "light" }: { href: string; children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-xl border px-6 text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        tone === "dark"
          ? "border-white/20 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-[#0B1124]"
          : "border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/50 focus-visible:ring-[#4F46E5]"
      )}
    >
      {children}
    </Link>
  );
}

/** Verified offer: trial length from the live plan, no card at signup, Google or five-field form. */
export function TrialFacts({ trialDays, tone = "light", className }: { trialDays: number; tone?: "light" | "dark"; className?: string }) {
  const items = [
    trialDays > 0 ? `${trialDays}-day free trial` : "Free to start",
    "No credit card required",
    "Sign up with Google or five fields",
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 text-sm", tone === "dark" ? "text-slate-300" : "text-[#475569]", className)}>
      {items.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <Check className={cn("h-4 w-4", tone === "dark" ? "text-[#A5B4FC]" : "text-[#4F46E5]")} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function SolutionHero({
  eyebrow,
  title,
  subtitle,
  ctaId,
  ctx,
  visual,
  tone = "light",
  secondary = { href: "/how-it-works", label: "See how it works" },
  layout = "split",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  ctaId: string;
  ctx: BlogRenderContext;
  visual: ReactNode;
  tone?: "light" | "dark";
  secondary?: { href: string; label: string };
  /** split: copy left, visual right. stacked: centered copy above a wide visual. */
  layout?: "split" | "stacked";
}) {
  const dark = tone === "dark";
  return (
    <section className={cn("relative overflow-hidden border-b", dark ? "border-white/10 bg-[#0B1124]" : "border-[#E2E8F0]")}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(ellipse 70% 60% at 80% 0%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(168,85,247,0.22), transparent 60%)"
            : "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(79,70,229,0.15), transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 85%)",
        }}
        aria-hidden
      />
      <div
        className={cn(
          SECTION_X,
          "relative pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-20",
          layout === "split" ? "grid items-center gap-12 lg:grid-cols-[1.02fr_1fr]" : "text-center"
        )}
      >
        <div className={cn(layout === "stacked" && "mx-auto max-w-3xl")}>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
          <h1
            className={cn(
              "mt-4 text-[2.15rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.35rem]",
              dark ? "text-white" : "text-[#0F172A]"
            )}
          >
            {title}
          </h1>
          <p className={cn("mt-5 text-lg leading-relaxed", dark ? "text-slate-300" : "text-[#475569]", layout === "stacked" && "mx-auto max-w-2xl")}>
            {subtitle}
          </p>
          <div className={cn("mt-8 flex flex-wrap gap-3", layout === "stacked" && "justify-center")}>
            <TrialButton ctaId={ctaId} trialDays={ctx.trialDays} tone={tone} />
            <SecondaryButton href={secondary.href} tone={tone}>
              {secondary.label}
            </SecondaryButton>
          </div>
          <TrialFacts trialDays={ctx.trialDays} tone={tone} className={cn("mt-5", layout === "stacked" && "justify-center")} />
        </div>
        <div className={cn("relative", layout === "stacked" && "mx-auto mt-14 max-w-5xl")}>{visual}</div>
      </div>
    </section>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "white",
  align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "white" | "cloud" | "dark";
  align?: "center" | "left";
}) {
  const dark = tone === "dark";
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24 border-b",
        tone === "white" && "border-[#E2E8F0] bg-white",
        tone === "cloud" && "border-[#E2E8F0] bg-[#F8FAFC]",
        dark && "overflow-hidden border-white/10 bg-[#0F172A]"
      )}
    >
      {dark ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 75% 0%, rgba(79,70,229,0.3), transparent 60%)" }}
          aria-hidden
        />
      ) : null}
      <div className={cn(SECTION_X, "relative py-16 lg:py-24")}>
        <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
          {eyebrow ? <Eyebrow tone={dark ? "dark" : "light"}>{eyebrow}</Eyebrow> : null}
          <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", dark ? "text-white" : "text-[#0F172A]")}>{title}</h2>
          {intro ? <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", dark ? "text-slate-300" : "text-[#475569]")}>{intro}</p> : null}
        </div>
        <div className="mt-10 lg:mt-14">{children}</div>
      </div>
    </section>
  );
}

export function ProblemGrid({ items }: { items: { icon: LucideIcon; title: string; body: ReactNode }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li key={it.title} className="mk-reveal rounded-2xl border border-[#E2E8F0] bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-semibold text-[#0F172A]">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{it.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Alternating copy + visual rows for concrete feature demonstrations. */
export function FeatureSpotlight({
  eyebrow,
  title,
  body,
  bullets,
  visual,
  reverse,
  caption,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  bullets?: ReactNode[];
  visual: ReactNode;
  reverse?: boolean;
  caption?: string;
}) {
  return (
    <div className="mk-reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">{title}</h3>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-[#475569]">{body}</div>
        {bullets?.length ? (
          <ul className="mt-6 space-y-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-[0.98rem] text-[#1E293B]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF]">
                  <Check className="h-3 w-3 text-[#4F46E5]" strokeWidth={3} aria-hidden />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <figure className={cn(reverse && "lg:order-1")}>
        {visual}
        {caption ? <figcaption className="mt-3 text-center text-xs text-[#64748B]">{caption}</figcaption> : null}
      </figure>
    </div>
  );
}

export function FeatureCards({ items, columns = 3 }: { items: { icon: LucideIcon; title: string; body: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", columns === 4 && "lg:grid-cols-4")}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li
            key={it.title}
            className="mk-reveal group rounded-2xl border border-[#E2E8F0] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_24px_50px_-36px_rgba(79,70,229,0.6)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-sm">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-semibold text-[#0F172A]">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{it.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** "Disconnected tools" vs "ShootPortal" rows. */
export function ToolsVsPlatform({
  rows,
  leftTitle = "Disconnected tools",
}: {
  rows: { task: string; before: string; after: string }[];
  leftTitle?: string;
}) {
  return (
    <div className="mk-reveal overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-55px_rgba(15,23,42,0.7)]">
      <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold uppercase tracking-[0.12em] text-[#64748B] md:grid">
        <div className="px-6 py-3">Job</div>
        <div className="px-6 py-3">{leftTitle}</div>
        <div className="bg-[#EEF2FF] px-6 py-3 text-[#4F46E5]">ShootPortal</div>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.task} className="grid border-b border-[#F1F5F9] last:border-0 md:grid-cols-[1fr_1.2fr_1.2fr]">
            <div className="px-6 pb-1 pt-4 font-semibold text-[#0F172A] md:py-4">{r.task}</div>
            <div className="flex gap-2.5 px-6 py-2 text-sm text-[#64748B] md:py-4">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[#CBD5E1]" aria-hidden />
              <span>
                <span className="sr-only">{leftTitle}: </span>
                {r.before}
              </span>
            </div>
            <div className="flex gap-2.5 bg-[#EEF2FF]/40 px-6 pb-4 pt-2 text-sm text-[#1E293B] md:py-4">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
              <span>
                <span className="sr-only">ShootPortal: </span>
                {r.after}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AudienceSplit({
  items,
}: {
  items: { label: string; title: string; body: ReactNode; points: ReactNode[] }[];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {items.map((it, i) => (
        <div
          key={it.title}
          className={cn(
            "mk-reveal rounded-3xl border p-7",
            i === 0 ? "border-[#E2E8F0] bg-white" : "border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white"
          )}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">{it.label}</p>
          <h3 className="mt-2 text-xl font-semibold text-[#0F172A]">{it.title}</h3>
          <div className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">{it.body}</div>
          <ul className="mt-5 space-y-2">
            {it.points.map((p, j) => (
              <li key={j} className="flex gap-2.5 text-sm text-[#1E293B]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Honest scope: what the product does and does not do for this audience. */
export function ScopeCard({ does, doesNot, title = "What ShootPortal does, and what it doesn't" }: { does: ReactNode[]; doesNot: ReactNode[]; title?: string }) {
  return (
    <div className="mk-reveal grid overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white md:grid-cols-2">
      <div className="p-7">
        <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Handles</p>
        <ul className="mt-2 space-y-2 text-sm text-[#1E293B]">
          {does.map((d, i) => (
            <li key={i} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-7 md:border-l md:border-t-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Use a specialist tool for</p>
        <ul className="mt-2 space-y-2 text-sm text-[#475569]">
          {doesNot.map((d, i) => (
            <li key={i} className="flex gap-2.5">
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Founder facts come from the blog author record (single source, allowlisted for brand literals). */
const FOUNDER = BLOG_AUTHORS["jackson-bridges"];

export function FounderNote({ children, detail }: { children?: ReactNode; detail?: ReactNode }) {
  return (
    <div className="mk-reveal mx-auto flex max-w-3xl flex-col items-start gap-5 rounded-3xl border border-[#E2E8F0] bg-white p-7 sm:flex-row sm:items-center">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#312E81] text-white">
        <Plane className="h-6 w-6 -rotate-12" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-[#0F172A]">Built by a working drone photographer</p>
        <p className="mt-1 text-sm leading-relaxed text-[#475569]">
          {children ?? (
            <>
              ShootPortal was built by {FOUNDER.name}. {FOUNDER.credentials.join(" · ")}.{" "}
              {detail ?? "It was made to run real jobs: requests, quotes, reschedules, revisions, payments, and deliveries."}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function PricingStrip({ ctx, ctaId }: { ctx: BlogRenderContext; ctaId: string }) {
  return (
    <div className="mk-reveal mx-auto grid max-w-4xl items-center gap-6 rounded-3xl border border-[#E2E8F0] bg-white p-7 shadow-[0_30px_70px_-55px_rgba(79,70,229,0.7)] md:grid-cols-[1.1fr_1fr] md:p-9">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">Simple pricing</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A]">
          {ctx.studioMonthly ? (
            <>
              {ctx.studioMonthly}
              <span className="text-base font-medium text-[#64748B]">/month</span>
            </>
          ) : (
            "One plan, every feature"
          )}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
          {ctx.studioAnnual ? <>Or {ctx.studioAnnual}/month billed annually. </> : null}
          One flat Studio plan with the full feature set: no per-listing or per-delivery fees. Card payments from your clients go
          through your own Stripe account at Stripe&apos;s standard rates.
        </p>
      </div>
      <div className="space-y-3">
        <TrialButton ctaId={ctaId} trialDays={ctx.trialDays} />
        <TrialFacts trialDays={ctx.trialDays} />
        <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5] hover:text-[#4338CA]">
          See full pricing <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function SolutionFaq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-[#E2E8F0] rounded-3xl border border-[#E2E8F0] bg-white">
      {items.map((f) => (
        <details key={f.q} className="group px-6 py-1">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
            <h3 className="font-semibold leading-snug text-[#0F172A]">{f.q}</h3>
            <Plus className="mt-0.5 h-5 w-5 shrink-0 text-[#4F46E5] transition-transform group-open:rotate-45" aria-hidden />
          </summary>
          <div className="pb-5 text-[0.98rem] leading-relaxed text-[#475569] [&>p+p]:mt-3 [&_a]:font-medium [&_a]:text-[#4F46E5] [&_a]:underline [&_a]:underline-offset-2">
            {f.a}
          </div>
        </details>
      ))}
    </div>
  );
}

export function RelatedReading({ slugs }: { slugs: readonly BlogSlug[] }) {
  const cards = slugs.map((s) => getArticle(s)).filter((a): a is NonNullable<typeof a> => !!a).map(toCardData);
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <BlogCard key={c.slug} post={c} />
      ))}
    </div>
  );
}

export function FinalCta({
  title,
  body,
  ctaId,
  ctx,
}: {
  title: string;
  body: ReactNode;
  ctaId: string;
  ctx: BlogRenderContext;
}) {
  return (
    <section className="relative overflow-hidden bg-[#0B1124]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 80% 0%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(ellipse 50% 50% at 10% 100%, rgba(168,85,247,0.25), transparent 60%)",
        }}
        aria-hidden
      />
      <div className={cn(SECTION_X, "relative py-20 text-center lg:py-24")}>
        <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem] sm:leading-tight">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <TrialButton ctaId={ctaId} trialDays={ctx.trialDays} tone="dark" label="Start your free trial" />
          <SecondaryButton href="/pricing" tone="dark">
            View pricing
          </SecondaryButton>
        </div>
        <TrialFacts trialDays={ctx.trialDays} tone="dark" className="mt-5 justify-center" />
      </div>
    </section>
  );
}

/** Cross-links to sibling Solutions pages (crawlable anchors with keyword-led labels). */
export function RelatedSolutions({ keys, title = "Related solutions" }: { keys: SolutionKey[]; title?: string }) {
  const pages = keys.map(getSolutionPage);
  return (
    <nav aria-label={title} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <Link
          key={p.path}
          href={p.path}
          className="mk-reveal group rounded-2xl border border-[#E2E8F0] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_24px_50px_-36px_rgba(79,70,229,0.6)]"
        >
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">{p.navTitle}</span>
          <span className="mt-2 block font-semibold capitalize text-[#0F172A]">{p.primaryKeyword}</span>
          <span className="mt-1.5 block text-sm leading-relaxed text-[#475569]">{p.navDescription}</span>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5]">
            Learn more <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Numbered horizontal (desktop) / vertical (mobile) step timeline. */
export function StepTimeline({ steps, tone = "light" }: { steps: { title: string; body: ReactNode; tag?: string }[]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <ol className={cn("relative grid gap-5", steps.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
      {steps.map((st, i) => (
        <li
          key={st.title}
          className={cn("mk-reveal relative rounded-2xl border p-6", dark ? "border-white/10 bg-white/[0.04]" : "border-[#E2E8F0] bg-white")}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white">{i + 1}</span>
            {st.tag ? (
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", dark ? "bg-white/10 text-indigo-200" : "bg-[#EEF2FF] text-[#4F46E5]")}>{st.tag}</span>
            ) : null}
          </div>
          <h3 className={cn("mt-4 font-semibold", dark ? "text-white" : "text-[#0F172A]")}>{st.title}</h3>
          <div className={cn("mt-1.5 text-sm leading-relaxed", dark ? "text-slate-300" : "text-[#475569]")}>{st.body}</div>
        </li>
      ))}
    </ol>
  );
}

/** Honest side-by-side of two approaches, with who each one fits. */
export function ApproachCompare({
  left,
  right,
}: {
  left: { label: string; title: string; points: ReactNode[]; fit: ReactNode };
  right: { label: string; title: string; points: ReactNode[]; fit: ReactNode };
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[left, right].map((side, i) => (
        <div
          key={side.label}
          className={cn(
            "mk-reveal flex flex-col rounded-3xl border p-7",
            i === 0 ? "border-[#E2E8F0] bg-white" : "border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white"
          )}
        >
          <p className={cn("text-xs font-bold uppercase tracking-[0.14em]", i === 0 ? "text-[#64748B]" : "text-[#4F46E5]")}>{side.label}</p>
          <h3 className="mt-2 text-xl font-semibold text-[#0F172A]">{side.title}</h3>
          <ul className="mt-4 space-y-2">
            {side.points.map((pt, j) => (
              <li key={j} className="flex gap-2.5 text-sm text-[#1E293B]">
                {i === 0 ? (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                )}
                <span>{pt}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-6 text-sm leading-relaxed text-[#475569]">
            <span className="font-semibold text-[#0F172A]">Best fit: </span>
            {side.fit}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Caption used under real ShootPortal captures. */
export const REAL_CAPTURE_NOTE = "Real ShootPortal screens from a live account. Client details are blurred.";

/** "See it in action": a click-to-play product demo with what to watch for and a CTA. */
export function DemoShowcase({
  id,
  eyebrow = "See it in action",
  title,
  intro,
  video,
  points,
  ctaId,
  trialDays,
  ctaLabel,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  video: SolutionVideoAsset;
  points: ReactNode[];
  ctaId: string;
  trialDays: number;
  ctaLabel?: string;
}) {
  return (
    <Section id={id} eyebrow={eyebrow} title={title} intro={intro} tone="dark">
      <div className="mx-auto max-w-5xl">
        <DemoVideo video={video} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {points.map((pt, i) => (
            <li key={i} className="flex gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-200">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#A5B4FC]" aria-hidden />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-slate-400">{REAL_CAPTURE_NOTE} No sound.</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <TrialButton ctaId={ctaId} trialDays={trialDays} tone="dark" label={ctaLabel} />
          <TrialFacts trialDays={trialDays} tone="dark" className="justify-center" />
        </div>
      </div>
    </Section>
  );
}

/** Full-width cinematic band with a muted motion loop (brand film or workflow animation). */
export function FilmBand({ video, eyebrow, title, body }: { video: SolutionVideoAsset; eyebrow?: string; title?: string; body?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#0B1124]">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(99,102,241,0.3), transparent 65%)" }} aria-hidden />
      <div className={cn(SECTION_X, "relative py-14 lg:py-20")}>
        {title ? (
          <div className="mx-auto mb-8 max-w-2xl text-center">
            {eyebrow ? <Eyebrow tone="dark">{eyebrow}</Eyebrow> : null}
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
            {body ? <p className="mt-3 text-base leading-relaxed text-slate-300">{body}</p> : null}
          </div>
        ) : null}
        <LoopVideo video={video} frame="dark" className="mx-auto max-w-5xl" />
      </div>
    </section>
  );
}
