import { test, expect, type Page } from '@playwright/test';

const ALL_DAY = [{ open: '00:00', close: '23:59' }];
const HOURS = { mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY, sun: ALL_DAY };
const CATALOG = {
  language: 'en',
  languages: ['en'],
  categories: [
    {
      id: 'c1', name: 'Pasta', sortOrder: 1,
      products: [
        { id: 'p1', name: 'Carbonara', price: 1050, images: [], variants: [], addons: [], isAvailable: true, additives: [], allergens: [], dietaryTags: [], spice: null },
      ],
    },
  ],
};

function shopWith(closures: unknown[]) {
  return {
    id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null,
    timezone: 'Europe/Berlin', openingHours: HOURS, closures,
  };
}
// start/end relative to now so the test never depends on the wall clock
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

async function stub(page: Page, closures: unknown[]) {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shopWith(closures)) }));
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
}

test.describe('shop closures', () => {
  test('closure running now shows the closed popup with its reason', async ({ page }) => {
    await stub(page, [{ id: 'c1', start: iso(-3600_000), end: iso(3600_000), reason: 'Holiday' }]);
    await page.goto('/shops/test-shop');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Closed right now' })).toBeVisible();
    await expect(dialog).toContainText('Holiday');
  });

  test('closure without a reason says closed today', async ({ page }) => {
    await stub(page, [{ id: 'c1', start: iso(-3600_000), end: iso(3600_000) }]);
    await page.goto('/shops/test-shop');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('We are closed today.');
  });

  test('a finished closure shows no popup', async ({ page }) => {
    await stub(page, [{ id: 'c1', start: iso(-7200_000), end: iso(-3600_000) }]);
    await page.goto('/shops/test-shop');
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('the closed popup can be dismissed', async ({ page }) => {
    await stub(page, [{ id: 'c1', start: iso(-3600_000), end: iso(3600_000), reason: 'Holiday' }]);
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
  });
});
