/**
 * Client-side batched thumbnail URL loader with an in-memory cache so scroll-back
 * reuses the same signed URL (browser HTTP cache can hit) within the TTL window.
 */

const BATCH_MAX = 48;
/** Keep slightly under server TTL (7200s) so we refresh before the signed URL dies. */
const CLIENT_CACHE_TTL_MS = 90 * 60 * 1000;

type CacheEntry = { url: string; expiresAt: number };

const urlCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

export function getCachedThumbUrl(assetId: string): string | null {
  const hit = urlCache.get(assetId);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    urlCache.delete(assetId);
    return null;
  }
  return hit.url;
}

export function invalidateThumbUrl(assetId: string) {
  urlCache.delete(assetId);
  inFlight.delete(assetId);
}

function putCache(assetId: string, url: string | null) {
  if (!url) return;
  urlCache.set(assetId, { url, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
}

async function fetchBatch(ids: string[]): Promise<Record<string, string | null>> {
  const res = await fetch("/api/media/thumbnails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) return Object.fromEntries(ids.map((id) => [id, null]));
  const data = (await res.json()) as { urls?: Record<string, string | null> };
  return data.urls ?? {};
}

/** Fetch thumbnail URLs for many assets in ≤48-id batches. Uses cache when warm. */
export async function fetchThumbUrls(
  assetIds: string[],
  options?: { force?: boolean }
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const need: string[] = [];

  for (const id of assetIds) {
    if (!id) continue;
    if (options?.force) invalidateThumbUrl(id);
    const cached = getCachedThumbUrl(id);
    if (cached) {
      out[id] = cached;
      continue;
    }
    const pending = inFlight.get(id);
    if (pending) {
      out[id] = await pending;
      continue;
    }
    need.push(id);
  }

  for (let i = 0; i < need.length; i += BATCH_MAX) {
    const chunk = need.slice(i, i + BATCH_MAX);
    const deferred = chunk.map((id) => {
      let resolve!: (v: string | null) => void;
      const promise = new Promise<string | null>((r) => {
        resolve = r;
      });
      inFlight.set(id, promise);
      return { id, resolve, promise };
    });

    try {
      const urls = await fetchBatch(chunk);
      for (const { id, resolve } of deferred) {
        const url = urls[id] ?? null;
        putCache(id, url);
        out[id] = url;
        resolve(url);
        inFlight.delete(id);
      }
    } catch {
      for (const { id, resolve } of deferred) {
        out[id] = null;
        resolve(null);
        inFlight.delete(id);
      }
    }
  }

  return out;
}

/**
 * Debounced queue: cards call request(id) on intersection; one network round-trip
 * covers the visible page.
 */
export function createThumbRequestQueue(
  onUrls: (urls: Record<string, string>) => void
): { request: (id: string) => void; flush: () => void; reset: () => void } {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const ids = Array.from(pending);
    pending.clear();
    if (!ids.length) return;

    const immediate: Record<string, string> = {};
    const toFetch: string[] = [];
    for (const id of ids) {
      const cached = getCachedThumbUrl(id);
      if (cached) immediate[id] = cached;
      else toFetch.push(id);
    }
    if (Object.keys(immediate).length) onUrls(immediate);

    if (!toFetch.length) return;
    void fetchThumbUrls(toFetch).then((urls) => {
      const found: Record<string, string> = {};
      for (const [id, url] of Object.entries(urls)) {
        if (url) found[id] = url;
      }
      if (Object.keys(found).length) onUrls(found);
    });
  };

  return {
    request(id: string) {
      if (!id) return;
      const cached = getCachedThumbUrl(id);
      if (cached) {
        onUrls({ [id]: cached });
        return;
      }
      pending.add(id);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 40);
    },
    flush,
    reset() {
      pending.clear();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
