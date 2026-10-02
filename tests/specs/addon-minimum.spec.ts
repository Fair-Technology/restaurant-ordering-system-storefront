import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

test('a dressing must be chosen', async ({ page }) => {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null }),
    }),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        language: 'en',
        languages: ['en'],
        categories: [
          {
            id: 'c1',
            name: 'Salads',
            sortOrder: 1,
            products: [
              {
                id: 'p2',
                name: 'Insalata',
                price: 800,
                images: [],
                variants: [],
                addons: [
                  {
                    id: 'dr',
                    name: 'Dressing',
                    minSelectable: 1,
                    maxSelectable: 1,
                    options: [
                      { id: 'oil', name: 'Oil', priceDelta: 0, isAvailable: true },
                      { id: 'yog', name: 'Yoghurt', priceDelta: 0, isAvailable: true },
                    ],
                  },
                ],
                isAvailable: true,
                additives: [],
                allergens: [],
                dietaryTags: [],
                spice: null,
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.goto('/shops/test-shop');
  await page.getByRole('button', { name: 'View details for Insalata' }).click();

  const add = page.getByRole('button', { name: 'Add To Order' });
  await expect(add).toBeDisabled();

  // TickCheckbox only reacts to a click on its tick box, not on the label text
  const tick = (name: string) => page.locator('label', { hasText: name }).locator('span').first();
  await tick('Oil').click();
  await expect(add).toBeEnabled();

  await tick('Yoghurt').click();
  await expect(add).toBeEnabled();
  await expect(page.locator('label', { hasText: 'Oil' }).locator('svg')).toHaveCount(0);
  await expect(page.locator('label', { hasText: 'Yoghurt' }).locator('svg')).toHaveCount(1);
});
