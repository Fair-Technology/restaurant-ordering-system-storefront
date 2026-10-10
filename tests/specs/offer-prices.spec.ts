import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

const product = (over: Record<string, unknown>) => ({
  images: [],
  variants: [],
  addons: [],
  isAvailable: true,
  additives: [],
  allergens: [],
  dietaryTags: [],
  spice: null,
  ...over,
});

test.beforeEach(async ({ page }) => {
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
            name: 'Lunch',
            sortOrder: 1,
            products: [
              product({
                id: 'p1',
                name: 'Carbonara',
                price: 1050,
                offerPrice: 800,
                offerLabel: 'Lunch special',
                variants: [
                  {
                    id: 'vg',
                    name: 'Size',
                    options: [{ id: 'big', name: 'Large', priceDelta: 300, isAvailable: true }],
                  },
                ],
              }),
              product({ id: 'p2', name: 'Cola', price: 350, offerPrice: null, offerLabel: null }),
            ],
          },
        ],
      }),
    }),
  );
});

test('a dish on offer shows the offer price, its label and the normal price struck through', async ({ page }) => {
  await page.goto('/shops/test-shop');
  await expect(page.getByTestId('product-price').first()).toHaveText('€8.00');
  await expect(page.getByTestId('regular-price')).toHaveText('€10.50');
  await expect(page.getByTestId('regular-price')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.getByTestId('offer-label')).toHaveText('Lunch special');
});

test('a dish without an offer shows only its normal price', async ({ page }) => {
  await page.goto('/shops/test-shop');
  await expect(page.getByTestId('product-price').nth(1)).toHaveText('€3.50');
  await expect(page.getByTestId('regular-price')).toHaveCount(1); // only the Carbonara card
});

test('the dish popup and the basket charge the offer price plus the size surcharge', async ({ page }) => {
  await page.goto('/shops/test-shop');
  await page.getByRole('button', { name: 'View details for Carbonara' }).click();
  // The first size (Large, +3.00) is preselected: 8.00 offer + 3.00 = 11.00, with 10.50 + 3.00 struck through
  await expect(page.getByText('Total €11.00')).toBeVisible();
  await expect(page.getByText('€13.50')).toHaveCSS('text-decoration-line', 'line-through');
});

test('the dish card has no "View details" button and opens from its name', async ({ page }) => {
  await page.goto('/shops/test-shop');
  await expect(page.getByRole('button', { name: 'View Details', exact: true })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Carbonara' }).click();
  await expect(page.getByText('Total €11.00')).toBeVisible();
});
