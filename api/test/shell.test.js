import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShell, escapeHtml, classify, parseOriginalUrl } from '../src/lib/shell.js';

const ORIGIN = 'https://store.example.com';
const SHELL = '<html><head><!--og-inject--><title>x</title><script type="module" src="/assets/a-123.js"></script></head><body></body></html>';
const SHOPS = {
  fish: { name: 'Fish & Chips', address: { city: 'Leeds' }, branding: { heroImageUrl: 'https://cdn.example.com/h.jpg', logoUrl: null } },
  bare: { name: 'Bare Cafe', address: {}, branding: { heroImageUrl: null, logoUrl: null } },
};
function mkFetch({ shell = SHELL, shopFail, shopHang, shellFail } = {}) {
  return async (url, opts) => {
    if (url === `${ORIGIN}/index.html`) {
      if (shellFail) throw new Error('down');
      return { ok: true, text: async () => shell };
    }
    const m = /\/shops\/slug\/([^/]+)$/.exec(url);
    if (shopHang) return new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('timeout'))));
    if (shopFail || !SHOPS[m?.[1]]) return { ok: false, status: shopFail ? 500 : 404, text: async () => '' };
    return { ok: true, text: async () => JSON.stringify(SHOPS[m[1]]) };
  };
}
const run = (path, f = mkFetch(), extra = {}) =>
  handleShell({
    originalUrl: `${ORIGIN}${path}`,
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
  assert.match(b.body, /og:image" content="https:\/\/store.example.com\/vite.svg"/);
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

test('helpers', () => {
  assert.equal(escapeHtml(`a&"<'`), 'a&amp;&quot;&lt;&#39;');
  assert.deepEqual(classify('/shops/x/'), { noindex: true, slug: 'x' });
  assert.deepEqual(classify('/shops/x/orders/1'), { noindex: true, slug: null });
  assert.equal(parseOriginalUrl('https://evil host/'), null);
  assert.equal(parseOriginalUrl('ftp://a.com/'), null);
});
