"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Settings, X } from "lucide-react";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings-nav";
import { searchSettingsIndex } from "@/lib/settings-search-index";
import { SETTINGS_DIVIDER_AFTER, settingsSectionIcon } from "@/components/admin/settings-section-icons";
import { useSettingsNav } from "@/components/admin/settings-nav-store";
import { cn } from "@/lib/utils";

/** Before the Settings page mounts: the same list it will publish (Business Website and Tax are page-dependent). */
const FALLBACK_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.id !== "landing" && s.id !== "tax").map((s) => ({
  id: s.id,
  label: s.label,
}));

function hashFor(id: SettingsSectionId): string {
  return SETTINGS_SECTIONS.find((s) => s.id === id)?.hashes[0] ?? `settings-${id}`;
}

/**
 * On /admin/settings the shell's sidebar turns into the Settings menu (the main menu steps
 * aside, like GoHighLevel's settings): Back, a "Find a setting" box, then every section with its
 * icon in the usual order. The page decides which section is open; this only reflects it.
 */
export function SettingsSidebar({
  homeHref,
  full,
  labelCls,
  rowCls,
  onNavigate,
}: {
  homeHref: string;
  /** Phone drawer: close it after picking a section (the path doesn't change, only the hash). */
  onNavigate?: () => void;
  /** Drawer: always labelled. Otherwise labels from lg, icon rail below. */
  full: boolean;
  labelCls: string;
  rowCls: string;
}) {
  const nav = useSettingsNav();
  const [query, setQuery] = useState("");
  const sections = nav?.sections ?? FALLBACK_SECTIONS;
  const active = nav?.active ?? "identity";
  const attention = useMemo(() => new Set(nav?.attention ?? []), [nav?.attention]);
  const includeTax = sections.some((s) => s.id === "tax");
  const results = useMemo(
    () => (query.trim().length >= 2 ? searchSettingsIndex(query, 8, { includeTax }) : []),
    [query, includeTax]
  );
  const searching = query.trim().length >= 2;

  function open(e: React.MouseEvent, id: SettingsSectionId) {
    if (!nav || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    nav.select(id);
    onNavigate?.();
  }

  function openResult(e: React.MouseEvent, href: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const hash = href.split("#")[1];
    if (!hash || !nav) return;
    e.preventDefault();
    setQuery("");
    // The page follows hash changes (section + scroll to the field).
    if (window.location.hash === `#${hash}`) window.dispatchEvent(new Event("hashchange"));
    else window.location.hash = hash;
    onNavigate?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("shrink-0 pt-1", full ? "px-3" : "px-2 lg:px-3")}>
        <Link
          href={homeHref}
          title={full ? undefined : "Back"}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-subtle text-sm font-semibold text-foreground transition-colors hover:bg-card hover:text-heading",
            full ? "px-3" : "w-full justify-center px-0 lg:w-auto lg:justify-start lg:px-3"
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className={labelCls}>Back</span>
        </Link>
        <h2
          className={cn(
            "items-center gap-2 pb-2 pt-4 text-lg font-bold tracking-tight text-heading",
            full ? "flex px-1" : "hidden lg:flex lg:px-1"
          )}
        >
          <Settings className="h-5 w-5 text-accent" aria-hidden />
          Settings
        </h2>
        <label className={cn("relative mb-1 items-center", full ? "flex" : "hidden lg:flex")}>
          <span className="sr-only">Find a setting</span>
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                const hash = results[0].href.split("#")[1];
                setQuery("");
                if (hash) window.location.hash = hash;
                onNavigate?.();
              }
            }}
            placeholder="Find a setting…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-8 text-sm text-heading placeholder:text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:text-heading"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        {searching ? (
          results.length ? (
            <ul className="space-y-0.5">
              {results.map((r) => {
                const Icon = settingsSectionIcon(r.sectionId);
                return (
                  <li key={r.id}>
                    <a
                      href={r.href}
                      onClick={(e) => openResult(e, r.href)}
                      className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-subtle hover:text-heading"
                    >
                      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden /> : null}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.label}</span>
                        <span className="line-clamp-2 text-xs text-muted">{r.description}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted">No settings match “{query.trim()}”.</p>
          )
        ) : (
          <ul className="space-y-0.5">
            {sections.map((s) => {
              const selected = s.id === active;
              const Icon = settingsSectionIcon(s.id);
              const needsSetup = attention.has(s.id);
              return (
                <Fragment key={s.id}>
                  <li>
                    <Link
                      href={`/admin/settings#${hashFor(s.id)}`}
                      onClick={(e) => open(e, s.id)}
                      aria-current={selected ? "page" : undefined}
                      title={full ? (needsSetup ? `${s.label}: needs setting up` : undefined) : s.label}
                      className={cn(
                        "group relative flex min-h-9 items-center gap-2.5 rounded-lg py-1.5 text-sm font-medium leading-snug transition-colors",
                        rowCls,
                        selected ? "bg-accent-subtle text-accent" : "text-foreground hover:bg-subtle hover:text-heading"
                      )}
                    >
                      {selected ? (
                        <span className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r bg-accent" aria-hidden />
                      ) : null}
                      {Icon ? (
                        <Icon
                          className={cn(
                            "h-[17px] w-[17px] shrink-0",
                            selected ? "text-accent" : "text-muted group-hover:text-heading"
                          )}
                          aria-hidden
                        />
                      ) : null}
                      {/* Long names wrap rather than cut off. */}
                      <span className={cn("min-w-0", full ? undefined : "hidden lg:inline")}>{s.label}</span>
                      {needsSetup ? (
                        <>
                          <span
                            className={cn(
                              "ml-auto h-2 w-2 shrink-0 rounded-full bg-accent ring-[3px] ring-accent-subtle",
                              !full && "hidden lg:block"
                            )}
                            aria-label="Needs setting up"
                          />
                          {!full ? (
                            <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card lg:hidden" aria-hidden />
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  </li>
                  {SETTINGS_DIVIDER_AFTER.has(s.id) ? (
                    <li role="separator" aria-hidden className="mx-3 my-2 h-px bg-border" />
                  ) : null}
                </Fragment>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
