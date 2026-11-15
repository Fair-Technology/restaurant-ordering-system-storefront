// Pure logic for the /shops/* + /legal/* shell Function (spec §14). No Azure imports so it is unit-testable.
//
// Invariants (see docs/reports/2026-11-13-g2.md):
//  - noindex is PATH-derived and injected on every response, independent of any fetch.
//  - Every failure path is HTTP 200 at the same URL. Never 3xx, never 5xx.
//  - The shell is fetched live from the REQUEST's own origin (never configured / baked).
//  - Shell cache is per-origin; shop meta cache is per-shop (two lifetimes).
//  - exactly one <title> in the head: the Function rewrites the shell's own title on a full load.

export const MARKER = '<!--og-inject-->';
export const SHELL_TTL_MS = 60_000;
export const SHELL_TIMEOUT_MS = 2_000;
export const META_TTL_MS = 5 * 60_000;
export const META_NEGATIVE_TTL_MS = 30_000;
export const SHOP_TIMEOUT_MS = 1_000;
export const NOINDEX_TAG = '<meta name="robots" content="noindex, nofollow">';
export const FALLBACK_IMAGE_PATH = '/og-fallback.png'; // 1200x630 raster in public/ — social crawlers do not render SVG
export const PLATFORM_DESCRIPTION = 'Order online directly from your favourite local restaurants.';
export const DEFAULT_PLATFORM_NAME = 'Fair Technology';

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

/**
 * Parse the optional SHELL_HOSTS app setting: comma-separated hostnames (no scheme), whitespace-trimmed,
 * case-insensitive, empty entries ignored. Returns a Set of lower-cased hostnames.
 */
export function parseShellHosts(value) {
  if (!value || typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Hosts Azure assigns to the SWA site itself (default domain and PR preview environments).
const PLATFORM_HOST_SUFFIX = '.azurestaticapps.net';
// Hosts Azure assigns to the managed Functions backend that SWA proxies /api/* to.
const MANAGED_FUNCTIONS_HOST_SUFFIX = '.azurewebsites.net';

/**
 * SSRF guard: may we fetch and re-serve the shell from `originalHostname` (taken from x-ms-original-url)?
 *
 * 1. It equals the host the request arrived on (Host / x-forwarded-host) — custom domains, local `swa start`.
 * 2. The arriving host is an Azure-managed Functions host (*.azurewebsites.net). On SWA managed Functions the
 *    Host header is the INTERNAL Functions host, "a value similar to <randomly-generated-string>.azurewebsites.net",
 *    and on the default *.azurestaticapps.net domain x-forwarded-host "is not there" at all (GitHub issue
 *    Azure/static-web-apps#1012). The public URL only survives in x-ms-original-url (Azure/static-web-apps#580).
 *    So the Host comparison can never match there; instead accept a platform host (*.azurestaticapps.net) or a
 *    host the owner pinned explicitly in SHELL_HOSTS. A real (non-azurewebsites.net) Host gets no such relaxation.
 */
export function isAllowedShellHost(originalHostname, expectedHost, shellHosts = new Set()) {
  const orig = String(originalHostname).toLowerCase();
  const arrived = String(expectedHost).toLowerCase().split(':')[0];
  if (orig === arrived) return true;
  if (!arrived.endsWith(MANAGED_FUNCTIONS_HOST_SUFFIX)) return false;
  return orig.endsWith(PLATFORM_HOST_SUFFIX) || shellHosts.has(orig);
}

/**
 * Parse the x-ms-original-url header. Returns { origin, hostname, pathname } or null.
 * `expectedHost` (the Host / x-forwarded-host the request actually arrived on) is an SSRF guard:
 * a direct call to /api/shopShell that sets the header by hand must not make the Function fetch and
 * re-serve another host's HTML under this origin. Only enforced when we have a host to compare with.
 * See isAllowedShellHost for the rules (and why *.azurewebsites.net is special). `shellHosts` is the
 * parsed SHELL_HOSTS allow-list (a Set or the raw comma-separated string).
 */
export function parseOriginalUrl(header, expectedHost, shellHosts) {
  if (!header) return null;
  let u;
  try {
    u = new URL(header);
  } catch {
    return null;
  }
  if (!HOST_RE.test(u.host)) return null;
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) return null;
  const allow = shellHosts instanceof Set ? shellHosts : parseShellHosts(shellHosts);
  if (expectedHost && !isAllowedShellHost(u.hostname, expectedHost, allow)) return null;
  return { origin: u.origin, hostname: u.hostname, pathname: u.pathname };
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
  // platform: the bare front page (`/`), i.e. zero non-empty segments after trailing-slash normalisation.
  const platform = !noindex && parts.length === 0;
  return { noindex, slug, platform };
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

/** Generic, indexable platform og card for the bare front page `/` (sales site — no noindex). */
export function buildPlatformHead({ platformName, origin }) {
  const name = platformName || DEFAULT_PLATFORM_NAME;
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(name)}">`,
    `<meta property="og:description" content="${escapeHtml(PLATFORM_DESCRIPTION)}">`,
    `<meta property="og:url" content="${escapeHtml(`${origin}/`)}">`,
    `<meta property="og:image" content="${escapeHtml(absoluteHttps(FALLBACK_IMAGE_PATH, origin))}">`,
    `<meta name="description" content="${escapeHtml(PLATFORM_DESCRIPTION)}">`,
  ].join('\n    ');
}

/** Self-contained indexable page for the front page when no shell is available: platform card + visible copy, no robots meta. */
export function platformPage(meta, origin) {
  const name = (meta && meta.platformName) || DEFAULT_PLATFORM_NAME;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(name)}</title>${buildPlatformHead({ platformName: name, origin })}<meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><h1>${escapeHtml(name)}</h1><p>${escapeHtml(PLATFORM_DESCRIPTION)}</p></body></html>`;
}

export function injectIntoShell(shell, headTags) {
  if (shell.includes(MARKER)) return shell.replace(MARKER, () => headTags);
  if (/<\/head>/i.test(shell)) return shell.replace(/<\/head>/i, () => `${headTags}\n</head>`);
  return `${headTags}\n${shell}`;
}

const TITLE_RE = /<title\b[^>]*>[\s\S]*?<\/title>/i;

/**
 * Replace the shell's own <title> so the head holds exactly one. No-op when there is no title to set
 * (e.g. the shop read failed: the shipped title stays — the fail-open rule).
 */
export function applyTitle(html, title) {
  if (!title) return html;
  const tag = `<title>${escapeHtml(title)}</title>`;
  if (TITLE_RE.test(html)) return html.replace(TITLE_RE, () => tag);
  return injectIntoShell(html, tag);
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
 * Resolve the platform display name from the anonymous `GET <backendBase>/legal/platform`
 * (PlatformLegalPublicDto.platformName). Platform-global, so cached under one key with META_TTL_MS.
 * On failure nothing new is cached: fall back to the cached (even stale) name, then DEFAULT_PLATFORM_NAME.
 */
async function fetchPlatformName(fetchFn, backendBase, platformCache, now) {
  if (!backendBase) return DEFAULT_PLATFORM_NAME;
  const cached = platformCache.get('platform');
  if (cached && now() < cached.expires) return cached.name;
  try {
    const raw = JSON.parse(await fetchText(fetchFn, `${backendBase.replace(/\/+$/, '')}/legal/platform`, SHOP_TIMEOUT_MS));
    const rawName = raw && typeof raw.platformName === 'string' ? raw.platformName.trim() : '';
    const name = rawName || DEFAULT_PLATFORM_NAME;
    platformCache.set('platform', { name, expires: now() + META_TTL_MS });
    return name;
  } catch {
    return cached ? cached.name : DEFAULT_PLATFORM_NAME;
  }
}

/**
 * Build the response. Never throws; always status 200.
 * deps: { fetch, now, shellCache: Map, metaCache: Map, backendBase, expectedHost, shellHosts }
 */
export async function handleShell({ originalUrl, deps }) {
  const { fetch: fetchFn, now = Date.now, shellCache, metaCache, platformCache = new Map(), backendBase, expectedHost, shellHosts } = deps;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
    'cache-control': 'no-cache',
  };
  // expectedHost pins the shell origin to the host the request actually arrived on (SSRF guard);
  // on SWA managed Functions that host is internal, so platform hosts / SHELL_HOSTS are accepted instead.
  const parsed = parseOriginalUrl(originalUrl, expectedHost, shellHosts);
  if (!parsed) return { status: 200, headers, body: minimalPage() };

  const { origin, pathname } = parsed;
  const { slug, platform } = classify(pathname);
  // The route rule sends /shops/*, /legal/* AND the bare `/` here. noindex is unconditional for the
  // former (fail safe); `/` is the sales site, so it stays indexable and gains a platform og card.

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
  if (!shell) {
    // Cold-cache shell failure. `/` must stay indexable + carded (sales site); every other path serves the noindex minimal page.
    if (platform) {
      const name = await fetchPlatformName(fetchFn, backendBase, platformCache, now);
      const pageHeaders = { ...headers };
      delete pageHeaders['x-robots-tag'];
      return { status: 200, headers: pageHeaders, body: platformPage({ platformName: name }, origin) };
    }
    return { status: 200, headers, body: minimalPage() };
  }

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

  if (platform) {
    const name = await fetchPlatformName(fetchFn, backendBase, platformCache, now);
    const pageHeaders = { ...headers };
    delete pageHeaders['x-robots-tag'];
    return { status: 200, headers: pageHeaders, body: applyTitle(injectIntoShell(shell, buildPlatformHead({ platformName: name, origin })), name) };
  }

  const head = buildHead({ noindex: true, meta, slug, origin });
  // The Function owns the <title> on a full load (spec §16): the shop name — the same value as og:title,
  // so the tab and the unfurl card agree. `meta` is null when the shop read failed, so the shipped
  // index.html title stays on that path (fail-open), still exactly one <title>.
  return { status: 200, headers, body: applyTitle(injectIntoShell(shell, head), meta?.name) };
}
