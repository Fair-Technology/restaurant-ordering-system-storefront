# Tailwind CSS 3.4 → 4 migration (rs-storefront)

## 1. What changed, file by file
- `package.json` / `package-lock.json` — `tailwindcss` ^3.4.19 → ^4.3.5, added `@tailwindcss/postcss` ^4.3.5, removed `autoprefixer` (v4 prefixes itself). `postcss` kept. `eslint-plugin-react-hooks` untouched (see §6).
- `postcss.config.js` — plugin is now `@tailwindcss/postcss` only.
- `src/main.css` — `@tailwind` directives → `@import "tailwindcss";`; added `@theme` with all custom tokens; added a v3-compat `@layer base` block (see below). Existing `@layer base`/`@layer utilities` blocks, `@keyframes`, `@property` and `.fair-preview` rules are unchanged. The one `@apply` (on `body`) still compiles.
- `tailwind.config.js` — deleted (everything moved to `@theme`; nothing needs a config file). Content scanning is now v4 automatic detection (includes `index.html` and `src/`).
- 11 `.tsx` files — class renames listed in §2.

The compat block in `@layer base` preserves three v3 defaults that v4 changed silently (per the official upgrade guide):
  - default border colour `gray-200` (v4: `currentColor`) — bare `border` is used widely;
  - placeholder colour `gray-400` (v4: 50% of current colour);
  - `cursor: pointer` on buttons (v4: `default`).

## 2. Classes renamed because meaning changed
| old → new | where |
|---|---|
| `shadow-sm` → `shadow-xs` | src/shared/Button.tsx:21, :23; src/shared/CartDropdown.tsx:257; src/features/menu/ProductModal.tsx:541; src/features/menu/ComboModal.tsx:566 |
| `rounded` → `rounded-sm` | src/shared/NavBar.tsx:121; src/shared/TickCheckbox.tsx:26 |
| `outline-none` → `outline-hidden` (v3 `outline-none` was a transparent 2px outline kept for forced-colors/keyboard users; that is exactly v4 `outline-hidden`. v4 `outline-none` would be `outline-style:none` and drop it.) | src/features/checkout/components/CustomerDetailsForm.tsx:61; src/features/menu/ComboModal.tsx:182, :246, :447; src/features/menu/ProductModal.tsx:248, :277; src/features/shop/ShopNoticeModal.tsx:100; src/shared/ConfirmModal.tsx:75, :82; src/shared/PlatformHeader.tsx:33; src/shared/CartDropdown.tsx:118; src/pages/HomePage.tsx:63 |

Audited and found nothing to change: bare `ring` (none; every ring is `ring-2`, so the 3px→1px default change does not apply), `bg/text/border-opacity-*`, `flex-shrink/grow-*`, `blur`/`drop-shadow` renames, `bg-gradient-to-*`, `space-*`/`divide-*` (only `space-y-*` used; no layout in the diff expected), important-modifier position, `bg-[--var]` syntax.

## 3. Tokens not expressible in `@theme`
None — no config file is kept. Notes:
- `spacing.15` and `borderWidth.3` get **no** token: v4 derives numeric spacing from `--spacing: 0.25rem` (`p-15` = 3.75rem) and `border-3` is built in (3px). Verified by compiling both classes.
- `primary/secondary/accent` DEFAULT → `--color-primary` etc.; `sidebar.bg/hover/active` → `--color-sidebar-bg/-hover/-active`; `app-gradient` → `--background-image-app-gradient`; fonts → `--font-sans`, `--font-display`.
- Verification: compiled a stylesheet with `@source inline(...)` for `bg-primary(-50/-700)`, `bg-secondary-300`, `bg-accent-700`, `bg-sidebar-*`, `font-sans`, `font-display`, `p-15`, `border-3`, `bg-app-gradient`; all resolve to the same values as the old config. (v4 only emits theme variables for utilities actually used, so the production CSS contains just the used ones.)

## 4. Commands run and outcome
- `npm install -D tailwindcss@^4 @tailwindcss/postcss@^4` and `npm uninstall autoprefixer` — ok.
- `npx eslint .` before the change (baseline) — clean (no output). After — clean, exit 0.
- `npm run build` (`tsc && vite build`) — passed; only the pre-existing >500 kB chunk warning.
- `npm run check:api-types` — `check:api-types OK - src/api/endpoints.ts matches openapi/swagger.json`.
- Playwright e2e — **skipped** (needs running servers).

## 5. Please eyeball in a browser before merging
- Any page with focusable controls (Tab through the product modal, combo modal, confirm modal, shop-notice modal, cart dropdown button, platform header logo): the keyboard focus ring (`focus-visible:ring-2`) must look as before; no new visible default outline.
- Checkout → customer details form: input borders, focus ring, placeholder colour.
- Shop page: bare `border` elements (fulfilment bar, category filter bar, cards, legal pages) — border colour should still be light gray.
- Primary buttons / cart pill / "add to basket" buttons: shadow weight (`shadow-xs`) matches before.
- NavBar logo (corner radius) and the TickCheckbox (corner radius).
- Skeleton shimmer, mobile menu rail (`menu-rail-mobile`) and the LogoLoader sweep: these are custom classes; `.skeleton`/`.menu-rail-mobile` stay in `@layer utilities`, `.logo-loader-*` and `.fair-preview` rules are unlayered (unlayered CSS beats layered utilities in v4 — check no Tailwind utility on those elements was relying on winning).
- Gray scale / default colours: v4 uses oklch palette values for built-in colours (`gray-*`, etc.), so tiny hue differences are possible.

## 6. Deliberately NOT done
- Did not run the e2e suite or a visual-regression comparison (no browser check was performed).
- Did not bump `eslint-plugin-react-hooks` (still ^5.2.0): not needed for this migration, and the brief permits it only if lint stays green; left alone.
- Did not convert `.skeleton`/`.menu-rail-mobile` to `@utility` (they work as plain layered CSS and are not used with variants).
- Did not touch layout, colours, copy, component structure, generated API files or `openapi/`.
- Did not push.
