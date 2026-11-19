// Pure logic for the /shops/* + /legal/* shell Function (spec §14). No Azure imports so it is unit-testable.
//
// Invariants (see rs-backend/docs/specs.md §16, "Storefront, URL and going live"):
//  - noindex is PATH-derived and injected on every response, independent of any fetch.
//  - Every FAILURE path (timeout, 404, malformed body, backend error, shell fetch failure) is HTTP 200 at the same
//    URL, noindex. Never 5xx. The single non-failure exception is a 301 on a SUCCESS path: the shop read succeeded
//    and named a different current slug (a retired slug, spec §16) -> permanent redirect to /shops/<current>.
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
 * Parse the x-ms-original-url header. Returns { origin, hostname, pathname, search } or null (`search` is the raw `?…` query string, '' when none).
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
  return { origin: u.origin, hostname: u.hostname, pathname: u.pathname, search: u.search };
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

export const REDIRECT_STATUS = 301;
const SHOP_PATH_RE = /^\/shops\/([^/?#]+)/;

/** The shop slug of any /shops/<slug>[...] path (landing, checkout, orders, legal, …), or null. */
export function shopSlugFromPath(pathname) {
  const m = SHOP_PATH_RE.exec(String(pathname));
  return m && SLUG_RE.test(m[1]) ? m[1] : null;
}

/** Permanent-redirect target: the same path with the slug swapped, query preserved verbatim. */
export function shopRedirectLocation(pathname, search, requestedSlug, currentSlug) {
  const rest = String(pathname).slice('/shops/'.length + String(requestedSlug).length);
  return `/shops/${currentSlug}${rest}${typeof search === 'string' ? search : ''}`;
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
 * One cached read of GET <backendBase>/shops/slug/<slug>, shared by the redirect decision and the og meta.
 * Returns { meta, resolvedSlug, expires }. resolvedSlug is the shop's CURRENT slug, or null when the payload
 * carries no valid slug (so nothing can redirect on a payload that omits it). On failure the last-good
 * meta/resolvedSlug are kept (a retired slug never becomes live for another shop).
 */
async function readShop({ fetchFn, backendBase, origin, slug, metaCache, now }) {
  const key = `${origin}|${slug.toLowerCase()}`;
  const cached = metaCache.get(key);
  if (cached && now() < cached.expires) return cached;
  let entry;
  try {
    const raw = JSON.parse(
      await fetchText(fetchFn, `${backendBase.replace(/\/+$/, '')}/shops/slug/${encodeURIComponent(slug)}`, SHOP_TIMEOUT_MS),
    );
    const shop = raw && (raw.shop ?? raw.data ?? raw);
    // The slug ends up in a Location header, so it must pass the same SLUG_RE as the request path (no ?, #, .., whitespace, CR/LF).
    const resolvedSlug =
      shop && typeof shop.slug === 'string' && SLUG_RE.test(shop.slug.trim()) ? shop.slug.trim() : null;
    const meta = toMeta(raw, origin);
    entry = { meta, resolvedSlug, expires: now() + (meta ? META_TTL_MS : META_NEGATIVE_TTL_MS) };
  } catch {
    // negative-cache briefly so an outage/hang is not re-hit per unfurl; keep last-good meta + resolvedSlug
    entry = { meta: cached?.meta ?? null, resolvedSlug: cached?.resolvedSlug ?? null, expires: now() + META_NEGATIVE_TTL_MS };
  }
  metaCache.set(key, entry);
  return entry;
}

/**
 * Build the response. Never throws; status 200, except a 301 when a successful shop read names a different current slug.
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

  const { origin, pathname, search } = parsed;
  const { slug, platform } = classify(pathname);
  // The route rule sends /shops/*, /legal/* AND the bare `/` here. noindex is unconditional for the
  // former (fail safe); `/` is the sales site, so it stays indexable and gains a platform og card.

  // --- retired slug: a successful read naming a different current slug is a permanent redirect (no shell needed) ---
  const shopSlug = shopSlugFromPath(pathname);
  let shopRead = null;
  if (shopSlug && backendBase && !platform) {
    shopRead = await readShop({ fetchFn, backendBase, origin, slug: shopSlug, metaCache, now });
    if (shopRead.resolvedSlug && shopRead.resolvedSlug !== shopSlug) {
      return {
        status: REDIRECT_STATUS,
        headers: { ...headers, location: shopRedirectLocation(pathname, search, shopSlug, shopRead.resolvedSlug) },
        body: '',
      };
    }
  }

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

  // --- meta: only for the shop landing path, from the shared per-shop read ---
  const meta = slug && shopRead ? shopRead.meta : null;

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
