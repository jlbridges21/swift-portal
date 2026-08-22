"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  ImageIcon,
  Loader2,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSearch } from "@/components/admin/admin-search-context";
import {
  searchSettingsIndex,
  type SettingsSearchEntry,
} from "@/lib/settings-search-index";
import {
  ADMIN_SEARCH_MIN_CHARS,
  type AdminSearchHit,
  type AdminSearchResults,
} from "@/lib/admin-search";

type FlatItem =
  | { kind: "header"; id: string; label: string; count: number }
  | { kind: "hit"; id: string; hit: AdminSearchHit; group: string }
  | { kind: "settings"; id: string; entry: SettingsSearchEntry }
  | { kind: "see-all"; id: string; label: string; href: string };

type SearchResponse = {
  results?: AdminSearchResults;
  seeAll?: Record<string, string>;
  error?: string;
  elapsedMs?: number;
};

function useIsMobileViewport() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setMobile(mq.matches);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mobile = useIsMobileViewport();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [serverResults, setServerResults] = useState<AdminSearchResults | null>(null);
  const [seeAll, setSeeAll] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setServerResults(null);
    setError(null);
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  const settingsHits = useMemo(
    () => (query.trim().length >= ADMIN_SEARCH_MIN_CHARS ? searchSettingsIndex(query, 8) : []),
    [query]
  );

  // Debounced server search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < ADMIN_SEARCH_MIN_CHARS) {
      setServerResults(null);
      setLoading(false);
      setShowLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const loadTimer = window.setTimeout(() => setShowLoading(true), 180);
    const debounce = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
          credentials: "include",
          signal: ac.signal,
        });
        const data = (await res.json()) as SearchResponse;
        if (!res.ok) {
          setError(data.error || "Search failed");
          setServerResults(null);
        } else {
          setError(null);
          setServerResults(data.results ?? null);
          setSeeAll(data.seeAll ?? {});
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Search failed");
        }
      } finally {
        setLoading(false);
        setShowLoading(false);
        window.clearTimeout(loadTimer);
      }
    }, 220);

    return () => {
      window.clearTimeout(debounce);
      window.clearTimeout(loadTimer);
      abortRef.current?.abort();
    };
  }, [query, open]);

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    const q = query.trim();
    if (q.length < ADMIN_SEARCH_MIN_CHARS) return items;

    const pushGroup = (
      label: string,
      hits: AdminSearchHit[],
      group: string,
      seeAllHref?: string
    ) => {
      if (!hits.length && !seeAllHref) return;
      if (!hits.length) return;
      items.push({ kind: "header", id: `h-${group}`, label, count: hits.length });
      for (const hit of hits) {
        items.push({ kind: "hit", id: `${group}-${hit.id}`, hit, group });
      }
      if (seeAllHref && hits.length >= 8) {
        items.push({
          kind: "see-all",
          id: `all-${group}`,
          label: `See all ${label.toLowerCase()}`,
          href: seeAllHref,
        });
      }
    };

    if (serverResults) {
      pushGroup("Clients", serverResults.clients, "clients", seeAll.clients);
      pushGroup("Projects", serverResults.projects, "projects", seeAll.projects);
      pushGroup("Leads", serverResults.leads, "leads", seeAll.leads);
      pushGroup("Media", serverResults.media, "media", seeAll.media);
    }

    if (settingsHits.length) {
      items.push({
        kind: "header",
        id: "h-settings",
        label: "Settings",
        count: settingsHits.length,
      });
      for (const entry of settingsHits) {
        items.push({ kind: "settings", id: `settings-${entry.id}`, entry });
      }
    }

    return items;
  }, [query, serverResults, settingsHits, seeAll]);

  const selectableIndexes = useMemo(
    () =>
      flatItems
        .map((item, i) => (item.kind === "header" ? -1 : i))
        .filter((i) => i >= 0),
    [flatItems]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, serverResults, settingsHits]);

  const activeSelectable = selectableIndexes[activeIndex] ?? selectableIndexes[0] ?? -1;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const navigateTo = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const activateItem = useCallback(
    (item: FlatItem | undefined) => {
      if (!item || item.kind === "header") return;
      if (item.kind === "hit") navigateTo(item.hit.href);
      else if (item.kind === "settings") navigateTo(item.entry.href);
      else if (item.kind === "see-all") navigateTo(item.href);
    },
    [navigateTo]
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (!selectableIndexes.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % selectableIndexes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + selectableIndexes.length) % selectableIndexes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = selectableIndexes[activeIndex];
      if (idx != null) activateItem(flatItems[idx]);
    }
  };

  if (!mounted || !open) return null;

  const emptyQuery = query.trim().length < ADMIN_SEARCH_MIN_CHARS;
  const noResults =
    !emptyQuery &&
    !loading &&
    !error &&
    flatItems.length === 0 &&
    serverResults != null;

  const panel = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex",
        mobile ? "items-stretch" : "items-start justify-center pt-[12vh] px-4"
      )}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close search"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className={cn(
          "relative z-[101] flex w-full flex-col overflow-hidden bg-white shadow-2xl",
          mobile
            ? "h-full max-h-full rounded-none"
            : "max-h-[min(70vh,560px)] max-w-xl rounded-xl border border-border"
        )}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, projects, media, settings…"
            className="min-h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {showLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-label="Searching" />
          ) : null}
          <button
            type="button"
            onClick={close}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id={listId}
          role="listbox"
          className="flex-1 overflow-y-auto overscroll-contain px-2 py-2"
        >
          {emptyQuery ? (
            <div className="space-y-3 px-3 py-4 text-sm text-muted">
              <p className="font-medium text-heading">Search your studio</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Clients — name, email, phone, company</li>
                <li>Projects — name, address, service, client</li>
                <li>Leads — name, email, phone</li>
                <li>Media — title and file name</li>
                <li>Settings — try “domain”, “stripe”, “reply-to”</li>
              </ul>
              <p className="text-xs">
                Message threads are not searched. Type at least {ADMIN_SEARCH_MIN_CHARS} characters.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="px-3 py-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {noResults ? (
            <div className="space-y-2 px-3 py-6 text-sm text-muted">
              <p className="font-medium text-heading">No matches for “{query.trim()}”</p>
              <p>Try another spelling, a phone number without punctuation, or a settings word like “domain”.</p>
            </div>
          ) : null}

          {flatItems.map((item, i) => {
            if (item.kind === "header") {
              return (
                <div
                  key={item.id}
                  className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  {item.label}
                  <span className="ml-1 font-normal normal-case text-slate-400">({item.count})</span>
                </div>
              );
            }

            const selected = i === activeSelectable;
            const icon =
              item.kind === "settings" ? (
                <Settings className="h-4 w-4 shrink-0 text-muted" />
              ) : item.kind === "see-all" ? (
                <Search className="h-4 w-4 shrink-0 text-muted" />
              ) : item.hit.type === "client" ? (
                <Users className="h-4 w-4 shrink-0 text-muted" />
              ) : item.hit.type === "project" ? (
                <FolderKanban className="h-4 w-4 shrink-0 text-muted" />
              ) : item.hit.type === "lead" ? (
                <UserPlus className="h-4 w-4 shrink-0 text-muted" />
              ) : item.hit.type === "media" ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted" />
              ) : (
                <Building2 className="h-4 w-4 shrink-0 text-muted" />
              );

            const title =
              item.kind === "hit"
                ? item.hit.title
                : item.kind === "settings"
                  ? item.entry.label
                  : item.label;
            const subtitle =
              item.kind === "hit"
                ? item.hit.subtitle
                : item.kind === "settings"
                  ? item.entry.description
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full min-h-11 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  selected ? "bg-accent/10 text-heading" : "hover:bg-slate-50"
                )}
                onMouseEnter={() => {
                  const selIdx = selectableIndexes.indexOf(i);
                  if (selIdx >= 0) setActiveIndex(selIdx);
                }}
                onClick={() => activateItem(item)}
              >
                <span className="mt-0.5">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-heading">{title}</span>
                  {subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {!mobile ? (
          <div className="hidden border-t border-border px-3 py-2 text-[11px] text-muted sm:flex sm:gap-3">
            <span>
              <kbd className="rounded border border-border bg-slate-50 px-1">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-slate-50 px-1">Enter</kbd> open
            </span>
            <span>
              <kbd className="rounded border border-border bg-slate-50 px-1">Esc</kbd> close
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/** Visible header control — opens the shell-mounted command palette. */
export function AdminSearchTrigger() {
  const { openSearch } = useAdminSearch();

  return (
    <button
      type="button"
      onClick={openSearch}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-white px-2.5 text-sm text-muted transition hover:border-accent/40 hover:text-heading sm:min-w-[9.5rem] sm:px-3"
      aria-label="Search (Command K)"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Search</span>
      <kbd className="ml-auto hidden rounded border border-border bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

/** Mobile / PWA entry that opens the shell-mounted palette. */
export function AdminSearchMobileButton({
  className,
  onAfterOpen,
}: {
  className?: string;
  onAfterOpen?: () => void;
}) {
  const { openSearch } = useAdminSearch();
  return (
    <button
      type="button"
      className={className}
      aria-label="Search"
      onClick={() => {
        openSearch();
        onAfterOpen?.();
      }}
    >
      <Search className="h-5 w-5" />
      <span>Search</span>
    </button>
  );
}
