import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShell, escapeHtml, classify, parseOriginalUrl, parseShellHosts, isAllowedShellHost, PLATFORM_DESCRIPTION, DEFAULT_PLATFORM_NAME } from '../src/lib/shell.js';

const ORIGIN = 'https://store.example.com';
const SHELL = '<html><head><!--og-inject--><title>x</title><script type="module" src="/assets/a-123.js"></script></head><body></body></html>';
const SHOPS = {
  fish: { name: 'Fish & Chips', address: { city: 'Leeds' }, branding: { heroImageUrl: 'https://cdn.example.com/h.jpg', logoUrl: null } },
  bare: { name: 'Bare Cafe', address: {}, branding: { heroImageUrl: null, logoUrl: null } },
};
function mkFetch({ shell = SHELL, shopFail, shopHang, shellFail, platformFail, origin = ORIGIN } = {}) {
  return async (url, opts) => {
    if (url === `${origin}/index.html`) {
      if (shellFail) throw new Error('down');
      return { ok: true, text: async () => shell };
    }
    if (/\/legal\/platform$/.test(url)) {
      if (platformFail) throw new Error('down');
      return { ok: true, text: async () => JSON.stringify({ platformName: 'Fair Technology', salesSiteUrl: null }) };
    }
    const m = /\/shops\/slug\/([^/]+)$/.exec(url);
    if (shopHang) return new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('timeout'))));
    if (shopFail || !SHOPS[m?.[1]]) return { ok: false, status: shopFail ? 500 : 404, text: async () => '' };
    return { ok: true, text: async () => JSON.stringify(SHOPS[m[1]]) };
  };
}
// `extra.origin` overrides the x-ms-original-url origin; `extra.expectedHost` / `extra.shellHosts` pass through to deps.
const run = (path, f = mkFetch(), { origin = ORIGIN, ...extra } = {}) =>
  handleShell({
    originalUrl: `${origin}${path}`,
    deps: { fetch: f, shellCache: new Map(), metaCache: new Map(), backendBase: 'https://be/api', ...extra },
  });
const NOINDEX = /name="robots" content="noindex, nofollow"/;

test('T1/T2/T3 shop landing: 200 html, per-shop og, fallback image', async () => {
  const a = await run('/shops/fish');
  assert.equal(a.status, 200);
  assert.match(a.headers['content-type'], /text\/html/);
  assert.match(a.body, /og:title" content="Fish &amp; Chips"/); // T7
  assert.match(a.body, /og:description" content="Fish &amp; Chips · Leeds"/);
  assert.match(a.body, /og:image" content="https:\/\/cdn.example.com\/h.jpg"/);
  assert.match(a.body, /og:url" content="https:\/\/store.example.com\/shops\/fish"/);
  const b = await run('/shops/bare');
  assert.match(b.body, /og:title" content="Bare Cafe"/);
  assert.match(b.body, /og:image" content="https:\/\/store.example.com\/og-fallback.png"/);
  assert.match(b.body, /src="\/assets\/a-123.js"/); // live shell kept
});

test('T4/T5 no og + noindex on sub-paths and /legal/*', async () => {
  for (const p of ['/shops/fish/orders/abc?t=tok', '/shops/fish/checkout', '/legal/sub-processors', '/shops/fish/legal/terms']) {
    const r = await run(p);
    assert.match(r.body, NOINDEX, p);
    assert.doesNotMatch(r.body, /og:/, p);
  }
});

test('T9 hang: ~1s timeout, 200, noindex', async () => {
  const t = Date.now();
  const r = await run('/shops/fish', mkFetch({ shopHang: true }));
  assert.ok(Date.now() - t < 2000);
  assert.equal(r.status, 200);
  assert.match(r.body, NOINDEX);
});

test('T9b backend read fails -> noindex still present, 200', async () => {
  for (const p of ['/shops/fish', '/shops/fish/orders/1?t=x']) {
    const r = await run(p, mkFetch({ shopFail: true }));
    assert.equal(r.status, 200);
    assert.match(r.body, NOINDEX);
  }
});

test('T9c both hops fail + cold cache -> inline minimal page', async () => {
  const r = await run('/shops/fish', mkFetch({ shellFail: true, shopFail: true }));
  assert.equal(r.status, 200);
  assert.match(r.body, NOINDEX);
  assert.doesNotMatch(r.body, /og:|<script|<link|src=|href=/);
});

test('shell failure serves last-good', async () => {
  const shellCache = new Map();
  let t = 0;
  const base = { shellCache, metaCache: new Map(), backendBase: 'https://be/api', now: () => t };
  await handleShell({ originalUrl: `${ORIGIN}/shops/fish`, deps: { ...base, fetch: mkFetch() } });
  t = 10 * 60_000;
  const r = await handleShell({ originalUrl: `${ORIGIN}/shops/fish`, deps: { ...base, fetch: mkFetch({ shellFail: true }) } });
  assert.match(r.body, /a-123\.js/);
  assert.match(r.body, NOINDEX);
});

test('shell cached per origin, meta per shop (shell fetched once for two shops)', async () => {
  let shellHits = 0;
  const inner = mkFetch();
  const f = (u, o) => (u.endsWith('/index.html') && shellHits++, inner(u, o));
  const deps = { fetch: f, shellCache: new Map(), metaCache: new Map(), backendBase: 'https://be/api' };
  await handleShell({ originalUrl: `${ORIGIN}/shops/fish`, deps });
  await handleShell({ originalUrl: `${ORIGIN}/shops/bare`, deps });
  assert.equal(shellHits, 1);
});

test('SSRF guard: foreign x-ms-original-url host -> minimal page, no fetch, noindex', async () => {
  let fetched = false;
  const f = async () => {
    fetched = true;
    return { ok: true, text: async () => SHELL };
  };
  const r = await handleShell({
    originalUrl: 'https://evil.example/shops/fish',
    deps: { fetch: f, shellCache: new Map(), metaCache: new Map(), backendBase: 'https://be/api', expectedHost: 'store.example.com' },
  });
  assert.equal(fetched, false);
  assert.equal(r.status, 200);
  assert.match(r.body, NOINDEX);
  assert.doesNotMatch(r.body, /og:/);
  // same host (port-insensitive) still works
  const ok = await handleShell({
    originalUrl: `${ORIGIN}/shops/fish`,
    deps: { fetch: mkFetch(), shellCache: new Map(), metaCache: new Map(), backendBase: 'https://be/api', expectedHost: 'store.example.com:443' },
  });
  assert.match(ok.body, /og:title" content="Fish &amp; Chips"/);
});

test('helpers', () => {
  assert.equal(escapeHtml(`a&"<'`), 'a&amp;&quot;&lt;&#39;');
  assert.deepEqual(classify('/shops/x/'), { noindex: true, slug: 'x', platform: false });
  assert.deepEqual(classify('/shops/x/orders/1'), { noindex: true, slug: null, platform: false });
  assert.deepEqual(classify('/'), { noindex: false, slug: null, platform: true });
  assert.deepEqual(classify('//'), { noindex: false, slug: null, platform: true });
  assert.deepEqual(classify('/legal/terms/'), { noindex: true, slug: null, platform: false });
  assert.equal(parseOriginalUrl('https://evil host/'), null);
  assert.equal(parseOriginalUrl('ftp://a.com/'), null);
  assert.equal(parseOriginalUrl('https://other.example/shops/x', 'store.example.com'), null);
  assert.equal(parseOriginalUrl('https://store.example.com/shops/x', 'store.example.com').pathname, '/shops/x');
});

// --- Platform front page `/`: indexable, generic og card (spec: sales site, unlike /shops/* + /legal/*) ---
const OG_PLATFORM_DESC = `og:description" content="${PLATFORM_DESCRIPTION}"`;

test('platform: GET / serves indexable og card, live shell kept, no x-robots-tag', async () => {
  const r = await run('/');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.equal(r.headers['x-robots-tag'], undefined);
  assert.doesNotMatch(r.body, /name="robots"/);
  assert.match(r.body, /og:type" content="website"/);
  assert.match(r.body, new RegExp(`og:title" content="${DEFAULT_PLATFORM_NAME}"`));
  assert.ok(r.body.includes(OG_PLATFORM_DESC), 'og:description present');
  assert.match(r.body, /og:url" content="https:\/\/store\.example\.com\/"/);
  assert.match(r.body, /og:image" content="https:\/\/store\.example\.com\/og-fallback\.png"/);
  assert.match(r.body, new RegExp(`<meta name="description" content="${PLATFORM_DESCRIPTION}">`));
  assert.match(r.body, /src="\/assets\/a-123\.js"/); // live shell kept
});

test('platform: GET / when /legal/platform fails -> default name, indexable, carded', async () => {
  const r = await run('/', mkFetch({ platformFail: true }));
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-robots-tag'], undefined);
  assert.doesNotMatch(r.body, /name="robots"/);
  assert.match(r.body, /og:title" content="Fair Technology"/);
  assert.match(r.body, /og:image" content="https:\/\/store\.example\.com\/og-fallback\.png"/);
  assert.match(r.body, /src="\/assets\/a-123\.js"/); // live shell still kept
});

test('platform: GET / shell fails cold cache -> indexable platform page, not minimal', async () => {
  const r = await run('/', mkFetch({ shellFail: true }));
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-robots-tag'], undefined);
  assert.doesNotMatch(r.body, /name="robots"/);
  assert.doesNotMatch(r.body, /Shop unavailable/);
  assert.match(r.body, /og:type" content="website"/);
  assert.match(r.body, /og:title" content="Fair Technology"/);
  assert.match(r.body, /og:url" content="https:\/\/store\.example\.com\/"/);
  assert.match(r.body, /og:image" content="https:\/\/store\.example\.com\/og-fallback\.png"/);
  assert.match(r.body, /<h1>/);
});

test('platform: name fetched at most once across two / requests sharing platformCache', async () => {
  let platformHits = 0;
  const inner = mkFetch();
  const f = (u, o) => (/\/legal\/platform$/.test(u) && platformHits++, inner(u, o));
  const deps = { fetch: f, shellCache: new Map(), metaCache: new Map(), platformCache: new Map(), backendBase: 'https://be/api' };
  await handleShell({ originalUrl: `${ORIGIN}/`, deps });
  await handleShell({ originalUrl: `${ORIGIN}/`, deps });
  assert.equal(platformHits, 1);
});

// --- SWA managed Functions: Host is the internal *.azurewebsites.net host, x-forwarded-host is absent ---
const INTERNAL_HOST = 'foo-123.azurewebsites.net';
const SWA_ORIGIN = 'https://salmon-x.2.azurestaticapps.net';
const neverFetch = () => {
  const f = async () => {
    f.called = true;
    return { ok: true, text: async () => SHELL };
  };
  return f;
};

test('internal Functions Host + default SWA domain in x-ms-original-url -> shell injected (the bug)', async () => {
  const r = await run('/shops/fish', mkFetch({ origin: SWA_ORIGIN }), { origin: SWA_ORIGIN, expectedHost: INTERNAL_HOST });
  assert.equal(r.status, 200);
  assert.match(r.body, /src="\/assets\/a-123.js"/);
  assert.match(r.body, /og:title" content="Fish &amp; Chips"/);
  assert.match(r.body, /og:url" content="https:\/\/salmon-x.2.azurestaticapps.net\/shops\/fish"/);
  assert.match(r.body, NOINDEX);
  assert.doesNotMatch(r.body, /Shop unavailable/);
});

test('internal Functions Host + foreign x-ms-original-url -> minimal page, no fetch', async () => {
  const f = neverFetch();
  const r = await run('/shops/fish', f, { origin: 'https://evil.example', expectedHost: INTERNAL_HOST });
  assert.equal(f.called, undefined);
  assert.equal(r.status, 200);
  assert.match(r.body, /Shop unavailable/);
  assert.match(r.body, NOINDEX);
  assert.doesNotMatch(r.body, /og:|<script/);
});

test('internal Functions Host + SHELL_HOSTS allow-list -> listed custom domain served, others minimal', async () => {
  const shellHosts = 'store.example.com, other.example';
  const ok = await run('/shops/fish', mkFetch(), { expectedHost: INTERNAL_HOST, shellHosts });
  assert.match(ok.body, /src="\/assets\/a-123.js"/);
  assert.match(ok.body, /og:title" content="Fish &amp; Chips"/);
  const f = neverFetch();
  const no = await run('/shops/fish', f, { origin: 'https://not-listed.example', expectedHost: INTERNAL_HOST, shellHosts });
  assert.equal(f.called, undefined);
  assert.match(no.body, /Shop unavailable/);
});

test('real site Host + mismatching x-ms-original-url -> minimal page (no relaxation off azurewebsites.net)', async () => {
  for (const origin of [SWA_ORIGIN, 'https://other.example']) {
    const f = neverFetch();
    const r = await run('/shops/fish', f, { origin, expectedHost: 'store.example.com', shellHosts: 'other.example' });
    assert.equal(f.called, undefined, origin);
    assert.match(r.body, /Shop unavailable/, origin);
  }
});

test('parseShellHosts: whitespace, empty entries, case-insensitive', () => {
  assert.deepEqual([...parseShellHosts(' Store.Example.COM , ,other.example,, ')], ['store.example.com', 'other.example']);
  assert.equal(parseShellHosts('').size, 0);
  assert.equal(parseShellHosts(undefined).size, 0);
  assert.equal(parseShellHosts(' , ').size, 0);
  const set = parseShellHosts('STORE.example.com');
  assert.ok(isAllowedShellHost('store.EXAMPLE.com', 'X-1.AzureWebsites.net:443', set));
  assert.ok(isAllowedShellHost('Salmon-X.2.AzureStaticApps.net', 'foo-123.azurewebsites.net'));
  assert.ok(!isAllowedShellHost('azurestaticapps.net.evil.example', 'foo-123.azurewebsites.net'));
  assert.ok(!isAllowedShellHost('salmon-x.2.azurestaticapps.net', 'store.example.com', set));
  assert.equal(
    parseOriginalUrl('https://store.example.com/shops/x', INTERNAL_HOST, ' store.example.com ').pathname,
    '/shops/x',
  );
});
