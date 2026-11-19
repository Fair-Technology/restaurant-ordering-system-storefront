import { test, expect } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
// @ts-expect-error plain-JS module without types
import { handleShell } from '../../api/src/lib/shell.js';

// Stands up its own HTTP server and drives the REAL handleShell behind a tiny emulation of the SWA route
// rewrite in staticwebapp.config.json (/, /shops/*, /legal/* -> handleShell). Independent of the baseURL.

const SHELL = '<html><head><!--og-inject--><title>Shipped</title></head><body></body></html>';
const CURRENT = { id: 's1', slug: 'current', name: 'Current Cafe', address: { city: 'Leeds' }, branding: null };

let server: http.Server;
let base = '';
let mode: 'ok' | 'fail' = 'ok';
// The "backend": requested slug -> shop DTO. A retired slug maps to the shop holding the current slug.
const backend: Record<string, unknown> = {};

const shellDeps = { shellCache: new Map(), metaCache: new Map(), platformCache: new Map() };

test.beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(SHELL);
      return;
    }
    const stub = /^\/api-stub\/shops\/slug\/([^/?]+)/.exec(url);
    if (stub) {
      const dto = backend[decodeURIComponent(stub[1])];
      if (mode === 'fail') res.writeHead(500).end();
      else if (!dto) res.writeHead(404, { 'content-type': 'application/json' }).end('{"code":"NOT_FOUND"}');
      else res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(dto));
      return;
    }
    const port = (server.address() as AddressInfo).port;
    const out = await handleShell({
      originalUrl: `http://localhost:${port}${url}`,
      deps: { fetch, ...shellDeps, backendBase: `http://localhost:${port}/api-stub`, expectedHost: req.headers.host },
    });
    res.writeHead(out.status, out.headers).end(out.body);
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(() => {
  mode = 'ok';
  shellDeps.metaCache.clear();
  for (const k of Object.keys(backend)) delete backend[k];
  backend.current = CURRENT;
  backend.old = CURRENT; // the rename: the old slug now resolves to the shop whose slug is "current"
});

test('retired slug answers a permanent 301 to the current slug, noindex kept', async ({ request }) => {
  const res = await request.get(`${base}/shops/old`, { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()['location']).toBe('/shops/current');
  expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test('deep path and query survive the redirect verbatim', async ({ request }) => {
  const res = await request.get(`${base}/shops/old/checkout?t=tok&x=1`, { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()['location']).toBe('/shops/current/checkout?t=tok&x=1');
});

test('browser follows exactly one 301 to the current URL', async ({ page }) => {
  await page.goto(`${base}/shops/old/checkout?t=tok&x=1`);
  expect(page.url()).toBe(`${base}/shops/current/checkout?t=tok&x=1`);
});

test('one hop: the redirect target never redirects', async ({ request }) => {
  const res = await request.get(`${base}/shops/current`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});

test('live and unknown slugs answer 200 with no location', async ({ request }) => {
  const live = await request.get(`${base}/shops/current`, { maxRedirects: 0 });
  expect(live.status()).toBe(200);
  expect(live.headers()['location']).toBeUndefined();
  const unknown = await request.get(`${base}/shops/nope`, { maxRedirects: 0 });
  expect(unknown.status()).toBe(200);
  expect(unknown.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(unknown.headers()['location']).toBeUndefined();
});

test('backend 500 fails open: 200 + noindex, never a 3xx', async ({ request }) => {
  mode = 'fail';
  const res = await request.get(`${base}/shops/old`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(res.headers()['location']).toBeUndefined();
});
