import { test, expect, type Page } from '@playwright/test';

/**
 * An offline shop must say so at checkout, never "Your basket is empty".
 * Every API call is mocked; nothing is POSTed.
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

const allDay = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, opensAt: '00:00', closesAt: '23:59' }));

function shop(isOffline: boolean) {
  return {
    id: 'shop-t',
    slug: 'test-shop',
    name: 'Test Shop',
    currency: 'EUR',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    isOffline,
    openingHours: allDay,
    closures: [] as unknown[],
    fulfilment: {
      modes: ['collection'],
      prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
      delivery: null,
    },
    orderLimitReached: false,
    branding: null,
  };
}

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mock(page: Page, opts: { isOffline: boolean; catalogStatus: number }) {
  await page.route('**/api/shops/slug/test-shop', (route) => route.fulfill(fulfil(shop(opts.isOffline))));
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    opts.catalogStatus === 200
      ? route.fulfill(
          fulfil({
            language: 'en',
            languages: ['en'],
            categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, products: [baseProduct] }],
          }),
        )
      : route.fulfill(fulfil({ error: 'offline' }, opts.catalogStatus)),
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
  await page.route('**/api/orders/quote', (route) =>
    route.fulfill(
      fulfil({
        currency: 'EUR',
        fulfilmentMode: 'collection',
        lines: [],
        subtotalCents: 1050,
        taxCents: 69,
        minOrderAmountCents: 0,
        belowMinimum: false,
        openNow: true,
        paymentMethods: ['card'],
        addressRequired: false,
        prepMinutes: 20,
      }),
    ),
  );
}

async function seedCart(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

async function expectOfflineCard(page: Page) {
  const card = page.getByTestId('shop-offline');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText(/this restaurant is offline/i);
  await expect(card).toContainText(/isn.t taking orders online/i);
  await expect(card.getByRole('link', { name: /back to the menu/i })).toHaveAttribute(
    'href',
    '/shops/test-shop',
  );
  await expect(page.getByTestId('empty-basket')).toHaveCount(0);
}

test.describe('Checkout for an offline shop', () => {
  test.use({ locale: 'en-US' });

  test('offline shop with an empty basket says offline, not "basket is empty"', async ({ page }) => {
    await mock(page, { isOffline: true, catalogStatus: 403 });
    await page.goto('/shops/test-shop/checkout');
    await expectOfflineCard(page);
  });

  test('offline shop with a seeded cart shows no checkout form', async ({ page }) => {
    await mock(page, { isOffline: true, catalogStatus: 403 });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expectOfflineCard(page);
    await expect(page.locator('#checkout-details')).toHaveCount(0);
    await expect(page.locator('button[form="checkout-details"]')).toHaveCount(0);
  });

  test('shop payload says online but catalog answers 403: still offline', async ({ page }) => {
    await mock(page, { isOffline: false, catalogStatus: 403 });
    await page.goto('/shops/test-shop/checkout');
    await expectOfflineCard(page);
  });

  test('control: online shop with a seeded cart shows the checkout form', async ({ page }) => {
    await mock(page, { isOffline: false, catalogStatus: 200 });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.locator('#checkout-details')).toBeVisible();
    await expect(page.getByTestId('shop-offline')).toHaveCount(0);
    await expect(page.getByTestId('empty-basket')).toHaveCount(0);
  });
});
