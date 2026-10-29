import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ExternalLink, Info, Lightbulb, Minus, TriangleAlert } from "lucide-react";
import { blogPath, type BlogSlug } from "@/lib/blog/slugs";
import { cn } from "@/lib/utils";
import { TRIAL_SIGNUP_HREF } from "@/lib/signup-intent";

/**
 * Building blocks for article bodies. Server components only; article
 * modules compose these with plain <p>/<h3>/<ul> styled by `.mk-prose`.
 */

/** Typed internal link to another article (typos fail tsc). */
export function BlogLink({ slug, children }: { slug: BlogSlug; children: ReactNode }) {
  return <Link href={blogPath(slug)}>{children}</Link>;
}

/** Link to an existing marketing route. */
export function SiteLink({
  href,
  children,
}: {
  href:
    | "/"
    | "/how-it-works"
    | "/pricing"
    | "/signup"
    | "/contact"
    | "/#product-demo"
    | "/partners"
    | "/real-estate-photography-software"
    | "/drone-business-management-software"
    | "/photography-client-portal"
    | "/real-estate-photography-crm"
    | "/photo-video-delivery-software"
    | "/photography-booking-software"
    | "/photography-invoicing-software"
    | "/video-review-approval-software"
    | "/real-estate-photography-workflow-software"
    | "/photography-business-management-software";
  children: ReactNode;
}) {
  return <Link href={href === "/signup" ? TRIAL_SIGNUP_HREF : href}>{children}</Link>;
}

/** Outbound link to an official third-party source. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const CALLOUT_STYLES = {
  tip: { icon: Lightbulb, ring: "border-[#C7D2FE] bg-[#EEF2FF]", iconColor: "text-[#4F46E5]", label: "Tip" },
  note: { icon: Info, ring: "border-[#E2E8F0] bg-[#F8FAFC]", iconColor: "text-[#475569]", label: "Note" },
  warning: { icon: TriangleAlert, ring: "border-amber-200 bg-amber-50", iconColor: "text-amber-600", label: "Watch out" },
} as const;

export function Callout({
  tone = "tip",
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: ReactNode;
}) {
  const s = CALLOUT_STYLES[tone];
  const Icon = s.icon;
  return (
    <aside className={cn("not-prose flex gap-4 rounded-2xl border p-5 text-[0.98rem] leading-relaxed", s.ring)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconColor)} aria-hidden />
      <div className="min-w-0 text-[#1E293B] [&_a]:font-medium [&_a]:text-[#4F46E5] [&_a]:underline [&_a]:underline-offset-2 [&>p+p]:mt-2">
        <p className="font-semibold text-[#0F172A]">{title ?? s.label}</p>
        <div className="mt-1 [&>p+p]:mt-2">{children}</div>
      </div>
    </aside>
  );
}

export function KeyTakeaways({ title = "Key takeaways", items }: { title?: string; items: ReactNode[] }) {
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#4F46E5] to-[#A855F7]" aria-hidden />
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">{title}</p>
      <ul className="mk-plain-list mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[0.98rem] leading-relaxed">
            <Check className="mt-1 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export type TableCell = ReactNode;

/** Accessible, horizontally scrollable comparison table. */
export function ComparisonTable({
  caption,
  columns,
  rows,
  highlightColumn,
  note,
}: {
  caption: string;
  columns: string[];
  /** First cell of each row is the row header. */
  rows: TableCell[][];
  /** 0-based index into `columns` to tint (e.g. ShootPortal). */
  highlightColumn?: number;
  note?: ReactNode;
}) {
  return (
    <figure className="!mt-8">
      <div className="mk-table-wrap" tabIndex={0} role="region" aria-label={caption}>
        <table className="mk-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={i === highlightColumn ? "mk-col-highlight" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className={i === highlightColumn ? "mk-col-highlight" : undefined}>
                      {cell}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <figcaption className="mt-3 text-sm leading-relaxed text-[#64748B]">{note}</figcaption> : null}
    </figure>
  );
}

/** Table cell helpers for yes / no / partial. */
export function Yes({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <span>{children ?? "Yes"}</span>
    </span>
  );
}
export function No({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-[#64748B]">
      <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children ?? "No"}</span>
    </span>
  );
}

/**
 * Product profile card used in listicles. Facts go in `pricing`/`bestFor`;
 * editorial judgement goes in pros/cons so readers can tell them apart.
 */
export function ToolCard({
  rank,
  name,
  id,
  url,
  tagline,
  pricing,
  bestFor,
  pros,
  cons,
  children,
  isShootPortal,
}: {
  rank?: number;
  name: string;
  id: string;
  url: string;
  tagline: string;
  pricing: ReactNode;
  bestFor: ReactNode;
  pros: ReactNode[];
  cons: ReactNode[];
  children?: ReactNode;
  isShootPortal?: boolean;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "mk-reveal !mt-10 overflow-hidden rounded-3xl border bg-white shadow-[0_20px_50px_-36px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_28px_60px_-36px_rgba(79,70,229,0.45)]",
        isShootPortal ? "border-[#A5B4FC] ring-1 ring-[#C7D2FE]" : "border-[#E2E8F0]"
      )}
    >
      <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b px-6 py-5", isShootPortal ? "border-[#C7D2FE] bg-[#EEF2FF]/70" : "border-[#E2E8F0] bg-[#F8FAFC]")}>
        <div className="flex min-w-0 items-start gap-4">
          {rank ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-base font-bold text-white shadow-sm">
              {rank}
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 id={id} className="!mt-0 scroll-mt-24 text-xl font-bold text-[#0F172A]">
              {name}
            </h3>
            <p className="mt-0.5 text-sm leading-snug text-[#475569]">{tagline}</p>
          </div>
        </div>
        {isShootPortal ? (
          <span className="rounded-full bg-[#4F46E5] px-3 py-1 text-xs font-semibold text-white">Our product</span>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mk-btn inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-medium text-[#475569] hover:border-[#C7D2FE] hover:text-[#4F46E5]"
          >
            Official site <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">for {name} (opens in a new tab)</span>
          </a>
        )}
      </div>
      <div className="space-y-4 px-6 py-6 text-[1rem] leading-relaxed [&>p+p]:mt-3">
        {children}
        <dl className="grid gap-3 rounded-2xl bg-[#F8FAFC] p-4 text-[0.95rem] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">Pricing</dt>
            <dd className="mt-1 text-[#0F172A]">{pricing}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">Best for</dt>
            <dd className="mt-1 text-[#0F172A]">{bestFor}</dd>
          </div>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Where it stands out</p>
            <ul className="mk-plain-list mt-2 space-y-2 text-[0.95rem]">
              {pros.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#9A3412]">Trade-offs to weigh</p>
            <ul className="mk-plain-list mt-2 space-y-2 text-[0.95rem]">
              {cons.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <Minus className="mt-1 h-4 w-4 shrink-0 text-[#C2410C]" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Wraps diagrams / illustrations with a caption that says what they are. */
export function Figure({ caption, children, wide }: { caption: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={cn("mk-reveal !mt-10", wide && "lg:-mx-10")}>
      {children}
      <figcaption className="mt-3 text-center text-sm leading-relaxed text-[#64748B]">{caption}</figcaption>
    </figure>
  );
}

/** Mid-article CTA, matched to the article's angle. */
export function InlineCta({
  title,
  body,
  trialDays,
  href = "/signup",
  label,
}: {
  title: string;
  body: ReactNode;
  trialDays: number;
  href?: "/signup" | "/how-it-works" | "/pricing";
  label?: string;
}) {
  return (
    <aside className="mk-reveal relative !mt-12 overflow-hidden rounded-3xl bg-[#0F172A] p-7 text-white sm:p-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 60% at 85% 10%, rgba(99,102,241,0.45), transparent 60%)" }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-lg font-semibold tracking-tight">{title}</p>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-300">{body}</p>
        </div>
        <div className="shrink-0">
          <Link
            href={href === "/signup" ? TRIAL_SIGNUP_HREF : href}
            data-sp-cta="blog:inline-cta"
            className="mk-btn inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          >
            {label ?? (trialDays > 0 ? `Try ShootPortal free for ${trialDays} days` : "Try ShootPortal")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {trialDays > 0 && href === "/signup" ? (
            <p className="mt-2 text-xs text-slate-400">No credit card required.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** Numbered how-to steps. */
export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="mk-plain-list !mt-6 space-y-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-sm font-bold text-[#4F46E5]">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[#0F172A]">{s.title}</p>
            <div className="mt-1 text-[0.98rem] leading-relaxed text-[#334155]">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Grid of "pick X if…" recommendation cards. */
export function PickGrid({ items }: { items: { who: string; pick: string; why: ReactNode }[] }) {
  return (
    <div className="!mt-6 grid gap-4 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.who}
          className="mk-reveal rounded-2xl border border-[#E2E8F0] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_18px_40px_-30px_rgba(79,70,229,0.6)]"
        >
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">{it.who}</p>
          <p className="mt-1.5 text-lg font-semibold text-[#0F172A]">{it.pick}</p>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-[#475569]">{it.why}</p>
        </div>
      ))}
    </div>
  );
}
