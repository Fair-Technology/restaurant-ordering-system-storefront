import { test, expect, type Page } from '@playwright/test';

async function mockMenu(page: Page, language: 'en' | 'de') {
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
        language,
        languages: [language],
        categories: [
          {
            id: 'c1',
            name: 'Pasta',
            sortOrder: 1,
            products: [
              {
                id: 'p1',
                name: 'Carbonara',
                price: 1050,
                images: [],
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
      }),
    }),
  );
}

test.describe('Euro prices', () => {
  test.describe('German visitor', () => {
    test.use({ locale: 'de-DE' });

    test('a euro shop shows euro prices to a German visitor', async ({ page }) => {
      await mockMenu(page, 'de');
      await page.goto('/shops/test-shop');
      await expect(page.getByText(/10,50\s€/)).toBeVisible();
      await expect(page.getByText(/\$\d/)).toHaveCount(0);
    });
  });

  test.describe('English visitor', () => {
    test.use({ locale: 'en-US' });

    test('English visitors see €10.50', async ({ page }) => {
      await mockMenu(page, 'en');
      await page.goto('/shops/test-shop');
      await expect(page.getByText('€10.50')).toBeVisible();
    });

    test('an English visitor to a German-only menu sees German prices', async ({ page }) => {
      // The shop offers only German, so the catalog comes back in German despite the English browser
      await mockMenu(page, 'de');
      await page.goto('/shops/test-shop');
      await expect(page.getByText(/10,50\s€/)).toBeVisible();
      await expect(page.getByText('€10.50')).toHaveCount(0);
    });
  });
});
