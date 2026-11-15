import { test, expect, type Page } from '@playwright/test';

const SHOP = { id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null };
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

function okShop(page: Page) {
  return page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SHOP) }));
}
function okCatalog(page: Page) {
  return page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
}

test.describe('shop lookup errors', () => {
  for (const status of [500, 401]) {
    test(`shop lookup ${status} shows error`, async ({ page }) => {
      await page.route('**/api/shops/slug/test-shop', (route) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'nope' }) }));
      await okCatalog(page);
      await page.goto('/shops/test-shop');
      await expect(page.locator('[data-testid="shop-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
    });
  }

  test('shop lookup aborted shows error', async ({ page }) => {
    await page.route('**/api/shops/slug/test-shop', (route) => route.abort());
    await okCatalog(page);
    await page.goto('/shops/test-shop');
    await expect(page.locator('[data-testid="shop-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
  });

  test('real 404 still shows not found', async ({ page }) => {
    await page.route('**/api/shops/slug/test-shop', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not found' }) }));
    await page.goto('/shops/test-shop');
    await expect(page.getByText('We can’t find this restaurant')).toBeVisible();
    await expect(page.locator('[data-testid="shop-error"]')).toHaveCount(0);
  });

  test('shop lookup retry recovers', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/shops/slug/test-shop', (route) => {
      calls += 1;
      if (calls === 1) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SHOP) });
    });
    await okCatalog(page);
    await page.goto('/shops/test-shop');
    await expect(page.locator('[data-testid="shop-error"]')).toBeVisible();
    await page.click('[data-testid="shop-error-retry"]');
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
  });
});

test.describe('catalog errors', () => {
  for (const status of [500, 401, 404]) {
    test(`catalog ${status} shows menu error`, async ({ page }) => {
      await okShop(page);
      await page.route('**/api/shops/shop-t/catalog**', (route) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'nope' }) }));
      await page.goto('/shops/test-shop');
      await expect(page.getByText('Test Shop').first()).toBeVisible();
      await expect(page.locator('[data-testid="menu-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
    });
  }

  test('catalog aborted shows menu error', async ({ page }) => {
    await okShop(page);
    await page.route('**/api/shops/shop-t/catalog**', (route) => route.abort());
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Test Shop').first()).toBeVisible();
    await expect(page.locator('[data-testid="menu-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
  });

  test('catalog retry recovers', async ({ page }) => {
    await okShop(page);
    let calls = 0;
    await page.route('**/api/shops/shop-t/catalog**', (route) => {
      calls += 1;
      if (calls === 1) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) });
    });
    await page.goto('/shops/test-shop');
    await expect(page.locator('[data-testid="menu-error"]')).toBeVisible();
    await page.click('[data-testid="menu-error-retry"]');
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
  });
});
