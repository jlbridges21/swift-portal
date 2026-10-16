import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Calculator, FileText, Lock, Smartphone, Sparkles } from "lucide-react";
import { getSolutionPage, type SolutionKey } from "@/lib/solutions";
import { getResource, type ResourceId } from "@/lib/resources/registry";
import { getTool, type ToolKey } from "@/lib/tools/registry";
import { SECTION_X } from "@/components/solutions/solution-sections";
import { cn } from "@/lib/utils";

/** Server-rendered building blocks shared by /tools and /resources pages. */

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[#64748B]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={c.name} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {c.href ? (
              <Link href={c.href} className="hover:text-[#0F172A] hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-[#0F172A]">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const PROMISES = [
  { icon: Sparkles, text: "Free" },
  { icon: Lock, text: "No signup. Your numbers stay in your browser" },
  { icon: Smartphone, text: "Works on your phone" },
];

/** Compact hero: the tool itself is the main event, so it sits right below. */
export function ToolHero({ crumbs, title, intro, children }: { crumbs: { name: string; href?: string }[]; title: string; intro: ReactNode; children?: ReactNode }) {
  return (
    <section className="tool-page-chrome relative overflow-hidden border-b border-[#E2E8F0]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 60% at 85% -10%, rgba(79,70,229,0.14), transparent 60%), linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)" }}
        aria-hidden
      />
      <div className={cn(SECTION_X, "relative pb-10 pt-8 sm:pt-10 lg:pb-12 lg:pt-12")}>
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-5 max-w-3xl text-[2.1rem] font-bold leading-[1.08] tracking-tight text-[#0F172A] [text-wrap:balance] sm:text-5xl">{title}</h1>
        <div className="mt-4 max-w-2xl text-lg leading-relaxed text-[#475569]">{intro}</div>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#475569]">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-[#4F46E5]" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}

/** Long-form explanatory content under a tool. Server-rendered, readable line length. */
export function Guide({ id, title, children, tone = "white" }: { id?: string; title: string; children: ReactNode; tone?: "white" | "cloud" }) {
  return (
    <section id={id} className={cn("tool-page-chrome scroll-mt-24 border-b border-[#E2E8F0]", tone === "cloud" ? "bg-[#F8FAFC]" : "bg-white")}>
      <div className={cn(SECTION_X, "py-14 lg:py-20")}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] [text-wrap:balance]">{title}</h2>
          <div className="mt-5 space-y-4 text-[1.0625rem] leading-relaxed text-[#334155] [&_a]:font-medium [&_a]:text-[#4F46E5] [&_a]:underline [&_a]:underline-offset-2 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[#0F172A] [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:text-[#0F172A] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A worked example rendered as a calm, document-like table. */
export function WorkedExample({ caption, rows, total }: { caption: string; rows: { label: string; value: string; note?: string }[]; total: { label: string; value: string } }) {
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
      <table className="w-full text-sm">
        <caption className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 text-left text-sm font-medium text-[#0F172A]">{caption}</caption>
        <tbody className="divide-y divide-[#F1F5F9]">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-5 py-2.5 text-left font-normal text-[#334155]">
                {r.label}
                {r.note ? <span className="block text-xs text-[#64748B]">{r.note}</span> : null}
              </th>
              <td className="px-5 py-2.5 text-right tabular-nums text-[#0F172A]">{r.value}</td>
            </tr>
          ))}
          <tr className="bg-[#EEF2FF]/60">
            <th scope="row" className="px-5 py-3 text-left font-semibold text-[#0F172A]">
              {total.label}
            </th>
            <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#0F172A]">{total.value}</td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}

/** Next steps: related tools, templates, articles, and the matching ShootPortal page. */
export function RelatedNext({
  tools = [],
  resources = [],
  articles = [],
  solution,
  heading = "Keep going",
}: {
  tools?: readonly ToolKey[];
  resources?: readonly ResourceId[];
  articles?: readonly { slug: string; title: string }[];
  solution?: SolutionKey;
  heading?: string;
}) {
  const sol = solution ? getSolutionPage(solution) : null;
  const card =
    "group flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-[border-color,box-shadow] hover:border-[#C7D2FE] hover:shadow-[0_24px_50px_-36px_rgba(79,70,229,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]";
  return (
    <section className="tool-page-chrome border-b border-[#E2E8F0] bg-[#F8FAFC]">
      <div className={cn(SECTION_X, "py-14 lg:py-20")}>
        <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A]">{heading}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((k) => {
            const t = getTool(k);
            return (
              <li key={t.path}>
                <Link href={t.path} className={card}>
                  <Calculator className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                  <span className="mt-3 font-semibold text-[#0F172A]">{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</span>
                  <span className="mt-1 text-sm leading-relaxed text-[#475569]">{t.summary}</span>
                  <span className="mt-auto pt-3 text-sm font-semibold text-[#4F46E5]">Free tool</span>
                </Link>
              </li>
            );
          })}
          {resources.map((id) => {
            const r = getResource(id);
            return (
              <li key={r.path}>
                <Link href={r.path} className={card}>
                  <FileText className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                  <span className="mt-3 font-semibold text-[#0F172A]">{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
                  <span className="mt-1 text-sm leading-relaxed text-[#475569]">{r.summary}</span>
                  <span className="mt-auto pt-3 text-sm font-semibold text-[#4F46E5]">Free template</span>
                </Link>
              </li>
            );
          })}
          {articles.map((a) => (
            <li key={a.slug}>
              <Link href={`/blog/${a.slug}`} className={card}>
                <span className="text-xs font-medium text-[#64748B]">Guide</span>
                <span className="mt-2 font-semibold leading-snug text-[#0F172A]">{a.title}</span>
                <span className="mt-auto pt-3 text-sm font-semibold text-[#4F46E5]">Read the guide</span>
              </Link>
            </li>
          ))}
          {sol ? (
            <li>
              <Link href={sol.path} className={cn(card, "border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white")}>
                <span className="text-xs font-medium text-[#4F46E5]">ShootPortal</span>
                <span className="mt-2 font-semibold capitalize leading-snug text-[#0F172A]">{sol.primaryKeyword}</span>
                <span className="mt-1 text-sm leading-relaxed text-[#475569]">{sol.navDescription}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-[#4F46E5]">
                  See how it works <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
