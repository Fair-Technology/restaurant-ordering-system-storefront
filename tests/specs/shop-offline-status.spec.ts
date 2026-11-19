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

function shopWith(isOffline: boolean) {
  return {
    id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null,
    timezone: 'Europe/Berlin', openingHours: HOURS, closures: [], isOffline,
  };
}

async function stub(page: Page, isOffline: boolean) {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shopWith(isOffline)) }));
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
}

test.describe('shop intro status pill vs offline flag', () => {
  test('offline shop inside opening hours shows Offline, never Open now', async ({ page }) => {
    await stub(page, true);
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('alertdialog').getByRole('heading', { name: 'This restaurant is offline' })).toBeVisible();
    const intro = page.getByTestId('shop-intro');
    await expect(intro).toContainText('Offline');
    await expect(intro).not.toContainText('Open now');
    await expect(intro).not.toContainText('Open until');
  });

  test('online shop inside opening hours still shows an open status', async ({ page }) => {
    await stub(page, false);
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('shop-intro')).toContainText(/Open (now|until)/);
  });
});
