// Pure logic for the /shops/* + /legal/* shell Function (spec §14). No Azure imports so it is unit-testable.
//
// Invariants (see docs/reports/2026-11-13-g2.md):
//  - noindex is PATH-derived and injected on every response, independent of any fetch.
//  - Every failure path is HTTP 200 at the same URL. Never 3xx, never 5xx.
//  - The shell is fetched live from the REQUEST's own origin (never configured / baked).
//  - Shell cache is per-origin; shop meta cache is per-shop (two lifetimes).

export const MARKER = '<!--og-inject-->';
export const SHELL_TTL_MS = 60_000;
export const SHELL_TIMEOUT_MS = 2_000;
export const META_TTL_MS = 5 * 60_000;
export const META_NEGATIVE_TTL_MS = 30_000;
export const SHOP_TIMEOUT_MS = 1_000;
export const NOINDEX_TAG = '<meta name="robots" content="noindex, nofollow">';
export const FALLBACK_IMAGE_PATH = '/vite.svg'; // static last resort of hero -> logo -> static

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const HOST_RE = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Parse the x-ms-original-url header. Returns { origin, pathname } or null. */
export function parseOriginalUrl(header) {
  if (!header) return null;
  let u;
  try {
    u = new URL(header);
  } catch {
    return null;
  }
  if (!HOST_RE.test(u.host)) return null;
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) return null;
  return { origin: u.origin, pathname: u.pathname };
}

/**
 * noindex: blanket under /shops/* and /legal/*. og: opt-in, shop landing page only.
 * Anything else (including '/') gets neither (the route rule should never send it here).
 */
export function classify(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean);
  const noindex = parts[0] === 'shops' || parts[0] === 'legal';
  const slug = parts[0] === 'shops' && parts.length === 2 && SLUG_RE.test(parts[1]) ? parts[1] : null;
  return { noindex, slug };
}

function absoluteHttps(url, origin) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url, origin);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Reduce the backend shop payload to the meta we need. Returns null if unusable. */
export function toMeta(raw, origin) {
  const shop = raw && (raw.shop ?? raw.data ?? raw);
  if (!shop || typeof shop.name !== 'string' || !shop.name.trim()) return null;
  const name = shop.name.trim();
  const city = typeof shop.address?.city === 'string' ? shop.address.city.trim() : '';
  const b = shop.branding ?? {};
  const image =
    absoluteHttps(b.heroImageUrl, origin) ??
    absoluteHttps(b.logoUrl, origin) ??
    absoluteHttps(FALLBACK_IMAGE_PATH, origin);
  return { name, description: city ? `${name} · ${city}` : `${name} · Order online`, image };
}

export function buildHead({ noindex, meta, slug, origin }) {
  const tags = [];
  if (noindex) tags.push(NOINDEX_TAG);
  if (meta && slug) {
    tags.push(
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${escapeHtml(meta.name)}">`,
      `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
      `<meta property="og:url" content="${escapeHtml(`${origin}/shops/${slug}`)}">`,
      ...(meta.image ? [`<meta property="og:image" content="${escapeHtml(meta.image)}">`] : []),
      `<meta name="description" content="${escapeHtml(meta.description)}">`,
    );
  }
  return tags.join('\n    ');
}

export function injectIntoShell(shell, headTags) {
  if (shell.includes(MARKER)) return shell.replace(MARKER, () => headTags);
  if (/<\/head>/i.test(shell)) return shell.replace(/<\/head>/i, () => `${headTags}\n</head>`);
  return `${headTags}\n${shell}`;
}

/** Self-contained page for when there is no shell at all: no assets, no og:*, noindex. */
export function minimalPage() {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">${NOINDEX_TAG}<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Shop unavailable</title></head><body><p>This shop is temporarily unavailable. Please try again shortly.</p></body></html>`;
}

async function fetchText(fetchFn, url, timeoutMs) {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.text();
}

/**
 * Build the response. Never throws; always status 200.
 * deps: { fetch, now, shellCache: Map, metaCache: Map, backendBase }
 */
export async function handleShell({ originalUrl, deps }) {
  const { fetch: fetchFn, now = Date.now, shellCache, metaCache, backendBase } = deps;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
    'cache-control': 'no-cache',
  };
  const parsed = parseOriginalUrl(originalUrl);
  if (!parsed) return { status: 200, headers, body: minimalPage() };

  const { origin, pathname } = parsed;
  const { slug } = classify(pathname);
  // The route rule only sends /shops/* and /legal/* here, so noindex is unconditional (fail safe).

  // --- shell: per-origin cache, last-good on failure ---
  let shell = null;
  const cached = shellCache.get(origin);
  if (cached && now() - cached.at < SHELL_TTL_MS) {
    shell = cached.html;
  } else {
    try {
      shell = await fetchText(fetchFn, `${origin}/index.html`, SHELL_TIMEOUT_MS);
      shellCache.set(origin, { html: shell, at: now() });
    } catch {
      shell = cached ? cached.html : null; // last-good (stale) if any
    }
  }
  if (!shell) return { status: 200, headers, body: minimalPage() };

  // --- meta: per-shop cache, only for the shop landing path ---
  let meta = null;
  if (slug && backendBase) {
    const key = `${origin}|${slug.toLowerCase()}`;
    const m = metaCache.get(key);
    if (m && now() < m.expires) {
      meta = m.meta;
    } else {
      try {
        const raw = JSON.parse(
          await fetchText(
            fetchFn,
            `${backendBase.replace(/\/+$/, '')}/shops/slug/${encodeURIComponent(slug)}`,
            SHOP_TIMEOUT_MS,
          ),
        );
        meta = toMeta(raw, origin);
        metaCache.set(key, { meta, expires: now() + (meta ? META_TTL_MS : META_NEGATIVE_TTL_MS) });
      } catch {
        // negative-cache briefly so an outage/hang is not re-hit per unfurl; serve stale meta if we have it
        meta = m ? m.meta : null;
        metaCache.set(key, { meta, expires: now() + META_NEGATIVE_TTL_MS });
      }
    }
  }

  const head = buildHead({ noindex: true, meta, slug, origin });
  return { status: 200, headers, body: injectIntoShell(shell, head) };
}
