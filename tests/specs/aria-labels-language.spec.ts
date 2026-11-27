import { test, expect } from '@playwright/test';

const catalog = {
  language: 'en',
  languages: ['de', 'en'],
  categories: [
    {
      id: 'c1',
      name: 'Mains',
      sortOrder: 1,
      products: [
        {
          id: 'p1',
          name: 'Pasta',
          price: 900,
          images: [{ url: 'https://dish.test/pasta.svg', sortOrder: 0 }],
          variants: [],
          addons: [],
          isAvailable: true,
          additives: [],
          allergens: [],
          dietaryTags: [],
          spice: null,
        },
      ],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://dish.test/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="orange"/></svg>',
    }),
  );
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null }),
    }),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalog) }),
  );
});

test.describe('page language en', () => {
  test.use({ locale: 'en-US' });

  test('header shop button, dish photo button and category nav are English', async ({ page }) => {
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('button', { name: 'Go to Test Shop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View details for Pasta' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Categories' })).toBeVisible();
  });
});

test.describe('page language de', () => {
  test.use({ locale: 'de-DE' });

  test('header shop button, dish photo button and category nav are German', async ({ page }) => {
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('button', { name: 'Zu Test Shop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Details zu Pasta ansehen' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Kategorien' })).toBeVisible();
  });
});
