import { app } from '@azure/functions';
import { handleShell } from '../lib/shell.js';

const shellCache = new Map();
const metaCache = new Map();
// Platform name is platform-global (not per-origin), so this cache is module-level and persists across invocations.
const platformCache = new Map();

// Route: staticwebapp.config.json `routes` rewrites /shops/* and /legal/* here. The ORIGINAL path is only
// available in x-ms-original-url (a navigationFallback rewrite would hide it).
app.http('shopShell', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  route: 'shopShell',
  handler: async (request) => {
    try {
      const r = await handleShell({
        originalUrl: request.headers.get('x-ms-original-url'),
        deps: {
          fetch,
          shellCache,
          metaCache,
          platformCache,
          // SSRF guard: only serve the origin the request actually arrived on.
          // On SWA managed Functions `host` is the internal *.azurewebsites.net host (see lib/shell.js).
          expectedHost: request.headers.get('x-forwarded-host') || request.headers.get('host'),
          // Optional owner-set app setting: comma-separated custom-domain hostnames to accept in that case.
          shellHosts: process.env.SHELL_HOSTS,
          // SWA app setting (owner-side Azure write). Value e.g. https://<backend-host>/api
          backendBase: process.env.BACKEND_API_BASE_URL,
        },
      });
      return { status: r.status, headers: r.headers, body: request.method === 'HEAD' ? undefined : r.body };
    } catch {
      // handleShell never throws; belt and braces — still 200 + noindex.
      return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' }, body: '<!doctype html><meta name="robots" content="noindex, nofollow"><p>Shop unavailable</p>' };
    }
  },
});
