import { test, expect, type Page } from '@playwright/test';

/**
 * Delivery postcode box: a malformed postcode gets a format message (and no
 * "Collect instead"), a well-formed but unserved one gets "not served", and a
 * served one is accepted.
 *
 * Every API call is mocked.
 */

const baseProduct = {
  id: 'p1',
  name: 'Carbonara',
  description: 'Egg, guanciale, pecorino.',
  price: 1050,
  images: [] as unknown[],
  variants: [] as unknown[],
  addons: [] as unknown[],
  isAvailable: true,
  additives: [] as unknown[],
  allergens: [] as unknown[],
  dietaryTags: [] as unknown[],
  spice: null,
};

const SHOP = {
  id: 'shop-t',
  slug: 'test-shop',
  name: 'Test Shop',
  currency: 'EUR',
  countryCode: 'DE',
  timezone: 'Europe/Berlin',
  fulfilment: {
    modes: ['collection', 'delivery'],
    prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
    delivery: { zones: [{ postcode: '10115', feeCents: 250, minOrderCents: 1500 }] },
  },
  orderLimitReached: false,
  branding: null,
};

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockShop(page: Page) {
  await page.route('**/api/shops/slug/test-shop', (route) => route.fulfill(fulfil(SHOP)));
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill(
      fulfil({
        language: 'en',
        languages: ['en'],
        categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, products: [baseProduct] }],
      }),
    ),
  );
  await page.route('**/api/shops/slug/test-shop/legal**', (route) =>
    route.fulfill(
      fulfil({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: 'en',
        impressum: { lines: [{ label: 'Provider', value: 'Test Shop GmbH' }] },
        terms: { text: 'T'.repeat(60), revision: 1, updatedAt: 'x' },
        withdrawal: { text: 'W'.repeat(60), revision: 1, updatedAt: 'x' },
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    ),
  );
}

test.describe('Delivery postcode format', () => {
  test.use({ locale: 'en-US' });

  test('malformed, not-served and served postcodes', async ({ page }) => {
    await mockShop(page);
    await page.goto('/shops/test-shop');

    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    const input = page.getByLabel('Your postcode');
    const check = page.getByRole('button', { name: 'Check', exact: true });
    const collect = page.getByRole('button', { name: 'Collect instead' });

    await input.fill('12');
    await check.click();
    await expect(page.getByText('Please enter a 5-digit postcode.')).toBeVisible();
    await expect(collect).toHaveCount(0);

    await input.clear();
    await input.fill('99999');
    await check.click();
    await expect(page.getByText(/We don't deliver to 99999/)).toBeVisible();
    await expect(page.getByText('Please enter a 5-digit postcode.')).toHaveCount(0);
    await expect(collect).toBeVisible();

    await input.clear();
    await input.fill('10115');
    await check.click();
    await expect(page.getByText(/10115/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    await expect(page.getByText(/We don't deliver to/)).toHaveCount(0);
    await expect(page.getByText('Please enter a 5-digit postcode.')).toHaveCount(0);
  });
});
