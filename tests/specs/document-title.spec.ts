import { test, expect, type Page } from '@playwright/test';

const SHIPPED = 'Restaurant Ordering System'; // index.html's <title>: the Function replaces it on a real full load
const PLATFORM = 'Fair Technology';

async function mockPlatformLegal(page: Page, platformName = PLATFORM) {
  await page.route('**/api/legal/platform', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        platformName,
        salesSiteUrl: null,
        operator: { legalName: 'Example Operator GmbH', address: 'x', email: 'x@example.com' },
        euRepresentative: null,
        subProcessors: [],
        currentDpaVersion: '2026-10-01',
        currentDpaIsDraft: false,
      }),
    }),
  );
}

async function mockShop(page: Page, slug: string, name: string) {
  await page.route(`**/api/shops/slug/${slug}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: `id-${slug}`, slug, name }),
    }),
  );
  await page.route(`**/api/shops/id-${slug}/catalog**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: [] }) }),
  );
}

// Client-side navigation (no reload), as the SPA router does it.
const spaNavigate = (page: Page, path: string) =>
  page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test.describe('T8: <title> tracks the shop on client-side navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformLegal(page);
  });

  test('/shops/a -> /shops/b -> / without reload', async ({ page }) => {
    await mockShop(page, 'a', 'Shop Alpha');
    await mockShop(page, 'b', 'Shop Beta');
    await page.route('**/api/shops/public', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ shops: [] }) }),
    );

    await page.goto('/');
    await expect(page).toHaveTitle(PLATFORM);
    await spaNavigate(page, '/shops/a');
    await page.evaluate(() => ((window as any).__noReload = true));

    await expect(page).toHaveTitle('Shop Alpha');
    await spaNavigate(page, '/shops/b');
    await expect(page).toHaveTitle('Shop Beta');
    await spaNavigate(page, '/');
    await expect(page).toHaveTitle(PLATFORM);

    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
    expect(await page.locator('head > title').count()).toBe(1);
    expect(await page.locator('head meta[property^="og:"]').count()).toBe(0);
  });

  test('order route: title is shop name only, no order id or token', async ({ page }) => {
    await mockShop(page, 'a', 'Shop Alpha');
    await page.route('**/api/**/orders/**', (r) => r.fulfill({ status: 404, body: '{}' }));
    await page.goto('/');
    await spaNavigate(page, '/shops/a/orders/ord-SECRET123?t=tok-SECRET456');
    await expect(page).toHaveTitle('Shop Alpha');
    const title = await page.title();
    expect(title).not.toContain('SECRET');
  });

  test('legal sub-processors page restores baseline after a shop', async ({ page }) => {
    await mockShop(page, 'a', 'Shop Alpha');
    await page.goto('/');
    await spaNavigate(page, '/shops/a');
    await expect(page).toHaveTitle('Shop Alpha');
    await spaNavigate(page, '/legal/sub-processors');
    await expect(page).toHaveTitle(PLATFORM);
  });

  test('deep link keeps the server (Function) title: hook is navigation-only', async ({ page }) => {
    await mockShop(page, 'a', 'Shop Alpha');
    await mockShop(page, 'b', 'Shop Beta');
    // Land directly on a shop URL. This suite runs against the bare dev server (no shell Function),
    // so index.html's shipped title stands in for whatever the Function served on a real full load —
    // the Function's per-shop title itself is pinned by the live spec in rs-e2e
    // (tests/customer/document-title.live.spec.mjs). The hook must not rewrite a first load's title
    // just because the shop name resolved.
    await page.goto('/shops/a');
    await page.waitForTimeout(1200);
    await expect(page).toHaveTitle(SHIPPED);
    expect(await page.locator('head > title').count()).toBe(1);

    // A subsequent client-side hop is the hook's job.
    await spaNavigate(page, '/shops/b');
    await expect(page).toHaveTitle('Shop Beta');
    expect(await page.locator('head > title').count()).toBe(1);
  });

  test('platformName drives the tab; operator.legalName never does', async ({ page }) => {
    await page.unroute('**/api/legal/platform');
    await mockPlatformLegal(page, 'Acme Cloud');
    await page.goto('/');
    await expect(page).toHaveTitle('Acme Cloud');
    expect(await page.title()).not.toContain('Example Operator');
    expect(await page.locator('head > title').count()).toBe(1);
    expect(await page.locator('head meta[property^="og:"]').count()).toBe(0);
  });

  test('falls back to the shipped title when the platform read fails', async ({ page }) => {
    await page.unroute('**/api/legal/platform');
    await page.route('**/api/legal/platform', (r) => r.fulfill({ status: 500, body: '{}' }));
    await page.goto('/');
    await page.waitForTimeout(1200);
    await expect(page).toHaveTitle(SHIPPED);
  });
});
