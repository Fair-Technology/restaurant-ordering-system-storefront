import { test, expect, type Page } from '@playwright/test';

const SHELL = 'Restaurant Ordering System';

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
  test('/shops/a -> /shops/b -> / without reload', async ({ page }) => {
    await mockShop(page, 'a', 'Shop Alpha');
    await mockShop(page, 'b', 'Shop Beta');
    await page.route('**/api/shops/public', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ shops: [] }) }),
    );

    await page.goto('/');
    await expect(page).toHaveTitle(SHELL);
    await spaNavigate(page, '/shops/a');
    await page.evaluate(() => ((window as any).__noReload = true));

    await expect(page).toHaveTitle('Shop Alpha');
    await spaNavigate(page, '/shops/b');
    await expect(page).toHaveTitle('Shop Beta');
    await spaNavigate(page, '/');
    await expect(page).toHaveTitle(SHELL);

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
    await expect(page).toHaveTitle(SHELL);
  });
});
