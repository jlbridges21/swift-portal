"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Globe, Loader2, Megaphone, Palette, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmbeddedCheckoutModal, postStartCheckout } from "@/components/payments/embedded-checkout-modal";
import { paymentCheckoutPath } from "@/lib/payment-status";
import { cn, formatCurrency } from "@/lib/utils";
import type { CartGroup, ClientCart } from "@/lib/marketing/cart";

// ---------------------------------------------------------------------------
// Store — one cart per tab, re-read from the server (the only source of truth) on mount,
// on focus, after every change and when another tab changes it.
// ---------------------------------------------------------------------------

const EMPTY: ClientCart = { groups: [], itemCount: 0, subtotalCents: 0, removableCount: 0, projectCount: 0 };
type State = { cart: ClientCart; loaded: boolean; open: boolean; version: number };
let state: State = { cart: EMPTY, loaded: false, open: false, version: 0 };
const listeners = new Set<() => void>();
const CHANNEL = "shootportal-cart";
let channel: BroadcastChannel | null = null;
let inflight: Promise<ClientCart | null> | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const signature = (c: ClientCart) =>
  c.groups.map((g) => `${g.paymentId}:${g.totalCents}:${g.items.map((i) => i.purchaseId).join(",")}`).join("|");

function setCart(cart: ClientCart) {
  const changed = signature(cart) !== signature(state.cart);
  emit({ cart, loaded: true, version: changed && state.loaded ? state.version + 1 : state.version });
}

/** Re-read the cart. Resolves to the new cart (null on a network error). */
export function refreshCart(): Promise<ClientCart | null> {
  if (inflight) return inflight;
  inflight = fetch("/api/portal/cart", { credentials: "include", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<ClientCart>) : null))
    .then((cart) => {
      if (cart) setCart(cart);
      return cart;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Call after anything that adds, pays or removes an add-on: updates this tab and every other open tab. */
export function notifyCartChanged() {
  void refreshCart();
  try {
    channel?.postMessage("changed");
  } catch {
    /* ignore */
  }
}

export function openCart() {
  emit({ open: true });
  void refreshCart();
}

function closeCart() {
  emit({ open: false });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => state;
const serverSnapshot = () => state;

export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Runs `fn` whenever the cart's contents change after the first load (any tab). */
export function useCartChanged(fn: () => void) {
  const { version } = useCart();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current();
  }, [version]);
}

// ---------------------------------------------------------------------------
// Header button (+ the drawer it owns)
// ---------------------------------------------------------------------------

/** Shopping cart icon for the client portal header. Renders the cart drawer too. */
export function CartButton({ className }: { className?: string }) {
  const { cart, open } = useCart();
  const router = useRouter();

  useEffect(() => {
    void refreshCart();
    try {
      channel ??= new BroadcastChannel(CHANNEL);
    } catch {
      channel = null;
    }
    const onMessage = () => void refreshCart();
    channel?.addEventListener("message", onMessage);
    const onFocus = () => void refreshCart();
    const onVisible = () => document.visibilityState === "visible" && void refreshCart();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      channel?.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Banners, the Estimate & Pay button and My Projects are server-rendered: re-render them
  // whenever the cart actually changes (removed here, paid in another tab, added elsewhere).
  useCartChanged(() => router.refresh());

  const count = cart.itemCount;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn("relative h-9 w-9 p-0 min-h-11 min-w-11", className)}
        onClick={() => (open ? closeCart() : openCart())}
        aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
        aria-expanded={open}
        title="Cart"
      >
        <ShoppingCart className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>
      <CartDrawer />
    </>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

const PRODUCT_ICON = { website: Globe, social: Palette } as const;

const STATUS_LABEL: Record<CartGroup["status"], string> = {
  awaiting_checkout: "Awaiting checkout",
  checkout_started: "Checkout not completed",
  on_invoice: "On your invoice · pay anytime",
};

function CartDrawer() {
  const { cart, open, loaded } = useCart();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [checkout, setCheckout] = useState<CartGroup | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Slide in / out.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmClear && !checkout) closeCart();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, confirmClear, checkout]);

  useEffect(() => {
    if (cart.groups[0]) setLastProjectId(cart.groups[0].projectId);
  }, [cart.groups]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/portal/cart", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      removed?: string[];
      skipped?: { purchaseId: string; reason: string }[];
      cart?: ClientCart;
    };
    if (!res.ok) throw new Error(data.error || "Couldn't update your cart.");
    if (data.cart) setCart(data.cart);
    notifyCartChanged();
    return data;
  }, []);

  async function remove(group: CartGroup, purchaseId: string) {
    const item = group.items.find((i) => i.purchaseId === purchaseId);
    setLastProjectId(group.projectId);
    setRemoving((s) => new Set(s).add(purchaseId));
    try {
      const data = await post({ action: "remove", purchaseIds: [purchaseId] });
      const skip = data.skipped?.find((s) => s.purchaseId === purchaseId);
      if (skip) toast.error(skip.reason);
      else toast.success(`${item?.label ?? "Item"} removed from your cart`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that item.");
    } finally {
      setRemoving((s) => {
        const n = new Set(s);
        n.delete(purchaseId);
        return n;
      });
    }
  }

  async function clearAll() {
    setClearing(true);
    try {
      const data = await post({ action: "clear" });
      const n = data.removed?.length ?? 0;
      const skipped = data.skipped ?? [];
      if (skipped.length) toast.error(skipped[0]!.reason);
      else if (n) toast.success(data.cart?.itemCount ? `Removed ${n} add-on${n === 1 ? "" : "s"} from your cart` : "Your cart is clear");
      setConfirmClear(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clear your cart.");
    } finally {
      setClearing(false);
    }
  }

  const routeProject = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const exploreProject = routeProject ?? lastProjectId;
  const single = cart.groups.length === 1 ? cart.groups[0]! : null;
  const byProject = groupByProject(cart.groups);
  const clearProjects = new Set(cart.groups.filter((g) => g.items.some((i) => i.removable)).map((g) => g.projectId)).size;

  if (!mounted) return checkout ? createPortal(<CartCheckout group={checkout} onClose={() => setCheckout(null)} />, document.body) : null;
  // Portaled: the sticky, blurred header is a containing block for fixed children.
  return createPortal(renderDrawer(), document.body);

  function renderDrawer() {

  return (
    <>
      <div className="fixed inset-0 z-[90]" role="presentation">
        <button
          type="button"
          aria-label="Close cart"
          tabIndex={-1}
          onClick={closeCart}
          className={cn("absolute inset-0 bg-slate-900/30 transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-title"
          className={cn(
            "app-safe-x absolute inset-y-0 right-0 flex w-full flex-col bg-card shadow-2xl transition-transform duration-200 ease-out sm:max-w-[420px] sm:border-l sm:border-border",
            visible ? "translate-x-0" : "translate-x-full"
          )}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <h2 id="cart-title" className="flex items-center gap-2 text-lg font-semibold text-heading">
              <ShoppingCart className="h-5 w-5 text-accent" aria-hidden />
              Your Cart{cart.itemCount ? <span className="text-muted">({cart.itemCount})</span> : null}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={closeCart}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {!loaded ? (
              <div className="flex justify-center py-16 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading cart" />
              </div>
            ) : cart.itemCount === 0 ? (
              <div className="flex flex-col items-center px-4 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                  <ShoppingCart className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold text-heading">Your cart is empty</p>
                <p className="mt-1 max-w-[260px] text-sm text-muted">Explore your project&apos;s Marketing Kit for optional marketing assets.</p>
                {exploreProject ? (
                  <Link
                    href={`/dashboard/projects/${exploreProject}?tab=marketing`}
                    onClick={closeCart}
                    className={cn(buttonVariants({ variant: "outline" }), "mt-5 min-h-11 text-accent")}
                  >
                    <Megaphone className="h-4 w-4" /> Explore Marketing Kit
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                {byProject.map(({ projectId, projectName, projectAddress, groups }) => (
                  <section key={projectId} aria-label={projectName}>
                    {cart.projectCount > 1 ? (
                      <p className="mb-2 truncate text-xs font-semibold uppercase tracking-wider text-muted" title={projectName}>
                        {projectName}
                      </p>
                    ) : null}
                    <div className="space-y-2.5">
                      {groups.map((g) => (
                        <div key={g.paymentId} className="rounded-xl border border-border bg-card">
                          <ul className="divide-y divide-border">
                            {g.items.map((item) => {
                              const Icon = PRODUCT_ICON[item.product];
                              const busy = removing.has(item.purchaseId) || clearing;
                              return (
                                <li key={item.purchaseId} className={cn("flex gap-3 p-3 transition-opacity", busy && "opacity-60")}>
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                                    <Icon className="h-5 w-5" aria-hidden />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-semibold leading-snug text-heading">{item.label}</p>
                                      <p className="shrink-0 font-semibold tabular-nums text-heading">{formatCurrency(item.amountCents)}</p>
                                    </div>
                                    <p className="truncate text-xs text-muted" title={projectAddress || projectName}>
                                      {projectAddress || projectName}
                                    </p>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="inline-flex items-center rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">
                                        {item.addedBy === "business" ? "Added by your photographer" : STATUS_LABEL[g.status]}
                                      </span>
                                      {item.removable ? (
                                        <button
                                          type="button"
                                          onClick={() => void remove(g, item.purchaseId)}
                                          disabled={busy}
                                          className="-mr-1 inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none"
                                          aria-label={`Remove ${item.label} from cart`}
                                        >
                                          {removing.has(item.purchaseId) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                          Remove
                                        </button>
                                      ) : null}
                                    </div>
                                    {item.offerNote ? <p className="mt-1.5 text-xs text-muted">{item.offerNote}</p> : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {g.bundleSavingsCents > 0 ? (
                            <p className="flex justify-between border-t border-border px-3 py-2 text-xs text-emerald-700">
                              <span>Bundle savings</span>
                              <span className="tabular-nums">−{formatCurrency(g.bundleSavingsCents)}</span>
                            </p>
                          ) : null}
                          {!single ? (
                            <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
                              <span className="text-sm font-semibold tabular-nums text-heading">{formatCurrency(g.totalCents)}</span>
                              <Button size="sm" variant="accent" className="min-h-10" onClick={() => setCheckout(g)}>
                                Checkout <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <footer className="space-y-3 border-t border-border bg-card px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            {cart.itemCount > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Subtotal</span>
                  <span className="text-lg font-bold tabular-nums text-heading">{formatCurrency(cart.subtotalCents)}</span>
                </div>
                {single ? (
                  <Button variant="accent" className="min-h-11 w-full" onClick={() => setCheckout(single)} disabled={clearing}>
                    Complete Checkout <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <p className="text-xs text-muted">Each checkout above is paid separately, so every project keeps its own receipt.</p>
                )}
              </>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={closeCart}
                className="min-h-10 rounded-md px-1 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Continue Browsing
              </button>
              {cart.removableCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={clearing}
                  className="min-h-10 rounded-md px-1 text-sm text-muted hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Clear Cart
                </button>
              ) : null}
            </div>
            <p className="text-[11px] leading-snug text-muted">
              Optional Marketing Kit add-ons only. Your project invoices stay on Estimate &amp; Pay.
            </p>
          </footer>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void clearAll()}
        title="Clear your cart?"
        confirmLabel="Clear Cart"
        destructive
        busy={clearing}
      >
        <p>
          This removes {cart.removableCount === 1 ? "1 optional add-on" : `${cart.removableCount} optional add-ons`} from your cart
          {clearProjects > 1 ? ` across ${clearProjects} projects` : ""}. You can add {cart.removableCount === 1 ? "it" : "them"} again anytime from the
          Marketing Kit.
        </p>
        <p className="text-muted">Your project invoices, payments and media aren&apos;t affected.</p>
        {cart.removableCount < cart.itemCount ? (
          <p className="text-muted">Items your photographer added to your invoice stay in the cart.</p>
        ) : null}
      </ConfirmDialog>

      {checkout ? <CartCheckout group={checkout} onClose={() => setCheckout(null)} /> : null}
    </>
  );
  }
}

function groupByProject(groups: CartGroup[]) {
  const out: { projectId: string; projectName: string; projectAddress: string; groups: CartGroup[] }[] = [];
  for (const g of groups) {
    let p = out.find((x) => x.projectId === g.projectId);
    if (!p) {
      p = { projectId: g.projectId, projectName: g.projectName, projectAddress: g.projectAddress, groups: [] };
      out.push(p);
    }
    p.groups.push(g);
  }
  return out;
}

/** Existing in-app Stripe checkout for one add-on payment. Access unlocks only via the webhook. */
function CartCheckout({ group, onClose }: { group: CartGroup; onClose: () => void }) {
  const paymentId = group.paymentId;
  const startCheckout = useCallback(
    ({ method }: { method: "card" | "bank" }) =>
      postStartCheckout(paymentCheckoutPath(paymentId), { method, returnTo: "marketing", embedded: true }),
    [paymentId]
  );
  const refreshUntilPaid = useCallback(async () => {
    for (let n = 0; n < 6; n++) {
      const cart = await refreshCart();
      if (cart && !cart.groups.some((g) => g.paymentId === paymentId)) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    notifyCartChanged();
  }, [paymentId]);
  return (
    <EmbeddedCheckoutModal
      open
      onClose={() => {
        onClose();
        notifyCartChanged();
      }}
      startCheckout={startCheckout}
      statusUrl={(sessionId) => `${paymentCheckoutPath(paymentId)}/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`}
      title={group.items.map((i) => i.label).join(" + ") || "Marketing Kit"}
      onSettled={(outcome) => {
        if (outcome.state === "paid" || outcome.state === "processing") void refreshUntilPaid();
      }}
      paidMessage="Payment received — your Marketing Kit add-on is unlocked."
      fallbackReceiptHref={`/api/payments/${paymentId}/receipt`}
      doneLabel="Done"
    />
  );
}
