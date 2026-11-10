# rs-storefront

The diner-facing storefront of the restaurant ordering system (React + TypeScript + Vite).

## Running locally

### 1. Start the backend first

The storefront renders nothing useful without the API, so start `rs-backend` first:

```bash
cd ../rs-backend
npm start                 # = npm run build && func start → http://localhost:7071/api
```

- Needs Azure Functions Core Tools v4 (`func`) and the backend's own `local.settings.json`. That file holds live dev credentials and isn't committed; ask for it.
- The local backend uses the **shared dev** Cosmos DB and storage (no Azurite). Its three timers are switched off locally (`AzureWebJobs.<timer>.Disabled = true`); the deployed dev app runs them.
- Its CORS allow-list is exactly `http://localhost:5173`–`http://localhost:5176`. An origin outside that list (including `127.0.0.1`) gets its API calls blocked.

Quick check: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:7071/api/shops/public` → `200`.

### 2. Configure `.env.local`

Create `.env.local` in this folder (it's git-ignored). `src/` reads exactly two variables:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:7071/api`. If you leave off `/api` it's appended for you (`vite.config.ts`, `src/api/baseApi.ts`); unset, it defaults to `http://localhost:7071/api` |
| `VITE_STRIPE_PUBLIC_KEY` | the platform's Stripe **publishable** test key (`pk_test_…`). Stripe.js is loaded with it *on behalf of the restaurant's connected account* (`src/utils/stripe.ts`). Without it, the card step can't load |

`.env.example` currently lists only `VITE_API_BASE_URL` (and `NODE_ENV`). Add `VITE_STRIPE_PUBLIC_KEY` yourself. Diners don't sign in, so there's no MSAL configuration here.

### 3. Run on port 5176

```bash
npm install
npm run dev -- --port 5176 --strictPort
```

Open **http://localhost:5176** (e.g. `http://localhost:5176/shops/mapasta` for the seeded test restaurant Ma Pasta). Use `localhost`, not `127.0.0.1`: Vite binds IPv6 (`::1`) only, so `http://127.0.0.1:5176` doesn't answer even while the app is running.

`vite.config.ts` doesn't pin a port, so a bare `npm run dev` takes 5173 or whatever is free. 5176 is the storefront's assigned port; rs-admin's `.env.local` (`VITE_SHOP_BASE_URL`) points at it.

| App | Port |
|---|---|
| rs-backend (Functions host) | 7071 |
| rs-superadmin | 5174 |
| rs-admin | 5175 |
| rs-storefront (this repo) | 5176 |

### 4. Card payments locally: the Stripe forwarder

Card checkouts complete through Stripe **Connect** webhooks. To have them reach your local backend, run the Stripe CLI from `rs-backend`:

```bash
cd ../rs-backend
stripe listen --forward-connect-to localhost:7071/api/webhooks/stripe-connect --all-snapshot
```

- `--all-snapshot` is required on Stripe CLI 1.55.x. Without an event selection, `stripe listen` exits immediately ("must specify events to forward…").
- The CLI prints a signing secret (`whsec_…`) on startup. It must equal the backend's `STRIPE_CONNECT_WEBHOOK_SECRET`, or every event is rejected with 400. Subscription webhooks use the separate `STRIPE_WEBHOOK_SECRET`.
- The **deployed** dev app receives the same Connect events and works on the same database. An order can move because the deployed app handled it, so judge local behaviour by your local log, not by the end state.

### 5. Checks

```bash
npm run check         # tsc --noEmit
npm run build         # tsc && vite build
npm test              # Playwright, against http://localhost:5176 (starts the dev server if none is running there)
```

`npm test` is **Playwright**, not vitest. Every spec mocks the API (`page.route`), so it needs no backend. Locally it reuses a server already on 5176; CI always starts its own.

### API client

The RTK Query client lives in **`src/api/`**, not `src/services/`:

| File | What |
|---|---|
| `src/api/baseApi.ts` | `createApi` + `fetchBaseQuery` (base URL from `VITE_API_BASE_URL`) |
| `src/api/endpoints.ts` | **generated**. Don't edit by hand |
| `src/api/orderEndpoints.ts`, `legalEndpoints.ts`, `publicShopEndpoints.ts` | hand-written **types** and the backend's literal error strings, plus re-exports of generated hooks. They must **not** declare endpoints: RTK silently keeps the first definition of a duplicated name |

Regenerate after the backend's spec changes:

```bash
curl -s http://localhost:7071/api/swagger.json -o openapi/swagger.json   # or the dev API's /api/swagger.json
npm run codegen:api                                                       # → src/api/endpoints.ts
npm run check && npm run build
```

`openapi/rtk-query.config.cjs` uses `flattenArg: true` and `tag: true` (unlike rs-admin), and forces `quoteBasket` and `viewCustomerOrder` to be **queries** (the generator would make every POST a mutation). Watch for name clashes: the generated `getShopLegal` is the owner-only `GET /shops/{shopId}/legal`; the diner legal pack is `getPublicLegalPack`.

---

*The text below is the original Vite template.*

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Where the product spec is

The Restaurant Ordering System is one product across several repositories, and almost every rule that
matters — how money is represented, how orders move, who may see what — cuts
across all of them. Keeping one copy of the spec is what stops several copies
drifting apart.

The spec is shared and lives in the **rs-backend** repo:

- in a checkout with the standard layout: `rs-backend/docs/spec.md` (sibling checkout)
- on GitHub: https://github.com/Fair-Technology/restaurant-ordering-system-backend/blob/main/docs/spec.md

Don't restate product rules here — a frontend only hides controls a user cannot
use; the rules are enforced in the backend. If you learn something new about how
the product behaves, edit the spec, not this file.

## API drift gate

`src/api/endpoints.ts` is generated from `openapi/swagger.json` (`npm run codegen:api`).
`npm run check:api-types` regenerates to a temp file and diffs it against the committed client; it fails if they differ.

Enable the pre-push hook that runs it (once per clone; `npm install` also does this via `prepare`):

```
npm run hooks:install
```

It is intentionally not part of `npm run build`.
