"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ActionMenuItem =
  | {
      type?: "item";
      id: string;
      label: string;
      icon?: ComponentType<{ className?: string }>;
      onSelect: () => void;
      destructive?: boolean;
      disabled?: boolean;
      hint?: string;
    }
  | { type: "separator"; id: string }
  | { type: "label"; id: string; label: string };

export type ActionMenuAnchor =
  | { kind: "element"; element: HTMLElement }
  | { kind: "point"; x: number; y: number; element: HTMLElement };

interface ActionMenuProps {
  anchor: ActionMenuAnchor | null;
  onClose: () => void;
  items: ActionMenuItem[];
  /** Shown as the sheet heading on phones and as an sr-only label on desktop. */
  title: string;
}

const MENU_WIDTH = 240;
const EDGE = 8;

function useIsSheet() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setSheet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return sheet;
}

/**
 * Contextual menu: anchored popover on desktop/tablet, bottom sheet on phones.
 * Portals into the trigger's surface wrapper so dark-surface tokens still apply.
 */
export function ActionMenu({ anchor, onClose, items, title }: ActionMenuProps) {
  const isSheet = useIsSheet();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = anchor !== null;

  useLayoutEffect(() => {
    if (!anchor || isSheet) {
      setPosition(null);
      return;
    }
    const menu = menuRef.current;
    const height = menu?.offsetHeight ?? 0;
    let top: number;
    let left: number;
    if (anchor.kind === "point") {
      top = anchor.y;
      left = anchor.x;
    } else {
      const rect = anchor.element.getBoundingClientRect();
      top = rect.bottom + 4;
      left = rect.right - MENU_WIDTH;
      if (top + height > window.innerHeight - EDGE) top = rect.top - height - 4;
    }
    if (top + height > window.innerHeight - EDGE) top = window.innerHeight - height - EDGE;
    top = Math.max(EDGE, top);
    left = Math.min(Math.max(EDGE, left), window.innerWidth - MENU_WIDTH - EDGE);
    setPosition({ top, left });
  }, [anchor, isSheet]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("[data-menu-item]:not([disabled])");
    first?.focus();
  }, [open, position, isSheet]);

  const close = useCallback(() => {
    const trigger = anchor?.element;
    onClose();
    if (trigger && anchor?.kind === "element") trigger.focus();
  }, [anchor, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-menu-item]:not([disabled])") ?? []
      );
      if (!buttons.length) return;
      e.preventDefault();
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === "ArrowDown"
          ? buttons[(idx + 1) % buttons.length]
          : buttons[(idx - 1 + buttons.length) % buttons.length];
      next?.focus();
    }
    function onScroll(e: Event) {
      if (isSheet) return;
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    }
    // Mobile toolbars change the height on scroll; only a width change invalidates the anchor.
    const openWidth = window.innerWidth;
    function onResize() {
      if (window.innerWidth !== openWidth) onClose();
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close, onClose, isSheet]);

  if (!anchor || typeof document === "undefined") return null;

  const target =
    (anchor.element.closest("[data-surface]") as HTMLElement | null) ?? document.body;

  const list: ReactNode = items.map((item) => {
    if (item.type === "separator") {
      return <div key={item.id} role="separator" className="my-1 h-px bg-border" />;
    }
    if (item.type === "label") {
      return (
        <p key={item.id} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {item.label}
        </p>
      );
    }
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        data-menu-item
        disabled={item.disabled}
        onClick={() => {
          onClose();
          item.onSelect();
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 text-left text-sm outline-none transition-colors",
          isSheet ? "min-h-12" : "min-h-9",
          "focus-visible:bg-accent-subtle hover:bg-accent-subtle disabled:pointer-events-none disabled:opacity-50",
          item.destructive ? "text-red-600 surface-dark:text-red-400" : "text-foreground"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : <span className="w-4" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.hint ? <span className="shrink-0 text-xs text-muted">{item.hint}</span> : null}
      </button>
    );
  });

  const menu = isSheet ? (
    <div className="fixed inset-0 z-[110] flex items-end" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label={title}
        className="relative z-10 w-full rounded-t-2xl border-t border-border bg-card px-2 pb-2 pt-2 shadow-xl"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border" aria-hidden />
        <p className="truncate px-3 pb-2 pt-1 text-sm font-semibold text-heading">{title}</p>
        {list}
        <button
          type="button"
          onClick={close}
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-md text-sm font-medium text-foreground hover:bg-accent-subtle"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <>
      <div className="fixed inset-0 z-[110]" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }} aria-hidden />
      <div
        ref={menuRef}
        role="menu"
        aria-label={title}
        className="fixed z-[111] rounded-lg border border-border bg-card p-1 shadow-xl"
        style={{
          width: MENU_WIDTH,
          top: position?.top ?? -9999,
          left: position?.left ?? -9999,
        }}
      >
        <span className="sr-only">{title}</span>
        {list}
      </div>
    </>
  );

  return createPortal(menu, target);
}
