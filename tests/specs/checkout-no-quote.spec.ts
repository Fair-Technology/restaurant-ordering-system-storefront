import { test, expect, type Page } from '@playwright/test';

/**
 * Regression cover for the checkout "no price quote" states.
 *
 * A missing or failed price quote must never leave the customer stuck on a
 * permanently disabled "Loading…" button. Each state below has to say what
 * went wrong and, where it can, offer a way to recover.
 *
 * Every API call is mocked; no test here reaches the payment step or POSTs
 * /api/orders.
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

// subtotalCents 1050 and no totalCents => the button total is €10.50
const okQuote = {
  currency: 'EUR',
  fulfilmentMode: 'collection',
  lines: [
    {
      index: 0,
      productId: 'p1',
      name: 'Carbonara',
      quantity: 1,
      status: 'ok',
      unitPriceCents: 1050,
      expectedUnitPriceCents: 1050,
      lineTotalCents: 1050,
    },
  ],
  subtotalCents: 1050,
  taxCents: 69,
  minOrderAmountCents: 0,
  belowMinimum: false,
  openNow: true,
  paymentMethods: ['card'],
  addressRequired: false,
  prepMinutes: 20,
};

const SHOP = {
  id: 'shop-t',
  slug: 'test-shop',
  name: 'Test Shop',
  currency: 'EUR',
  countryCode: 'DE',
  timezone: 'Europe/Berlin',
  fulfilment: {
    modes: ['collection'],
    prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
    delivery: null,
  },
  orderLimitReached: false,
  branding: null,
};

const PRICES_UNAVAILABLE = "We couldn't load the prices for your order. Please try again.";
const ORDER_FAILED = 'Your order could not be sent. Please try again.';

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

/** Catalog + legal mocks for test-shop, without the shop lookup itself. */
async function mockShopExtras(page: Page) {
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

async function mockShop(page: Page) {
  await page.route('**/api/shops/slug/test-shop', (route) => route.fulfill(fulfil(SHOP)));
  await mockShopExtras(page);
}

async function seedCart(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mewmew_cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

const submit = (page: Page) => page.locator('button[form="checkout-details"]');

test.describe('Checkout with no price quote', () => {
  test.use({ locale: 'en-US' });

  for (const mode of ['500', '401', 'abort'] as const) {
    test(`price-check failure (${mode}) says so, keeps the real label, and recovers on retry`, async ({
      page,
    }) => {
      await mockShop(page);
      await seedCart(page);

      let fail = true;
      await page.route('**/api/orders/quote', (route) => {
        if (!fail) return route.fulfill(fulfil(okQuote));
        if (mode === 'abort') return route.abort('failed');
        return route.fulfill(fulfil({ error: 'boom' }, Number(mode)));
      });

      await page.goto('/shops/test-shop/checkout');

      await expect(page.getByTestId('quote-error')).toBeVisible();
      await expect(page.getByTestId('quote-error').getByRole('alert')).toHaveText(
        PRICES_UNAVAILABLE,
      );
      await expect(page.getByTestId('retry-quote')).toBeVisible();
      await expect(submit(page)).toBeDisabled();
      await expect(submit(page)).toContainText('Continue to payment');
      await expect(submit(page)).not.toContainText('Loading');
      await expect(page.getByText(ORDER_FAILED)).toHaveCount(0);

      fail = false;
      await page.getByTestId('retry-quote').click();

      await expect(page.getByTestId('quote-error')).toHaveCount(0);
      await expect(submit(page)).toBeEnabled();
      await expect(submit(page)).toContainText('Continue to payment');
      await expect(submit(page)).toContainText('€10.50');
    });
  }

  test('empty basket shows an empty-basket message, not a form stuck on Loading', async ({
    page,
  }) => {
    await mockShop(page);

    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('empty-basket')).toBeVisible();
    await expect(page.locator('#checkout-details')).toHaveCount(0);
    await expect(page.locator('#checkout-details input')).toHaveCount(0);
    await expect(page.locator('button[form="checkout-details"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Loading');
  });

  test('shop lookup failure shows a retryable error, then recovers', async ({ page }) => {
    let fail = true;
    await page.route('**/api/shops/slug/test-shop', (route) =>
      fail ? route.fulfill(fulfil({ error: 'boom' }, 500)) : route.fulfill(fulfil(SHOP)),
    );
    await mockShopExtras(page);
    await page.route('**/api/orders/quote', (route) => route.fulfill(fulfil(okQuote)));
    await seedCart(page);

    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('shop-error')).toBeVisible();
    await expect(page.getByTestId('retry-shop')).toBeVisible();
    await expect(page.locator('#checkout-details')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Loading');

    fail = false;
    await page.getByTestId('retry-shop').click();

    await expect(page.getByTestId('shop-error')).toHaveCount(0);
    await expect(submit(page)).toBeEnabled();
  });

  test('unknown shop slug shows the restaurant-not-found page', async ({ page }) => {
    await page.route('**/api/shops/slug/nowhere', (route) =>
      route.fulfill(fulfil({ error: 'not found' }, 404)),
    );

    await page.goto('/shops/nowhere/checkout');

    await expect(
      page.getByRole('heading', { name: 'We can’t find this restaurant' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'See all restaurants' })).toBeVisible();
    await expect(page.locator('#checkout-details')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Loading');
  });

  test('control: a good quote enables the submit button with the total', async ({ page }) => {
    await mockShop(page);
    await seedCart(page);
    await page.route('**/api/orders/quote', (route) => route.fulfill(fulfil(okQuote)));

    await page.goto('/shops/test-shop/checkout');

    await expect(submit(page)).toBeEnabled();
    await expect(submit(page)).toContainText('Continue to payment');
    await expect(submit(page)).toContainText('€10.50');
    await expect(page.getByTestId('quote-error')).toHaveCount(0);
  });

  test("409 ORDERS_PAUSED shows the server's own message", async ({ page }) => {
    await mockShop(page);
    await seedCart(page);
    await page.route('**/api/orders/quote', (route) =>
      route.fulfill(fulfil({ error: 'Back at 6 pm', code: 'ORDERS_PAUSED' }, 409)),
    );

    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('quote-error').getByRole('alert')).toHaveText('Back at 6 pm');
    await expect(page.getByText(PRICES_UNAVAILABLE)).toHaveCount(0);
  });

  test('order creation 500 shows the translated generic error, never the raw server text', async ({
    page,
  }) => {
    await mockShop(page);
    await seedCart(page);
    await page.route('**/api/orders/quote', (route) => route.fulfill(fulfil(okQuote)));
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'Internal error' }, 500)),
    );

    await page.goto('/shops/test-shop/checkout');
    await page.getByPlaceholder('Your full name').fill('Test Diner');
    await page.getByPlaceholder('your@email.com').fill('diner@example.com');
    await page.getByPlaceholder('+1 (555) 000-0000').fill('0301234567');
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();

    await expect(page.getByRole('alert').filter({ hasText: ORDER_FAILED })).toBeVisible();
    await expect(page.getByText('Internal error')).toHaveCount(0);
    // not stuck loading: the diner can retry
    await expect(submit(page)).toBeEnabled();
    await expect(submit(page)).toContainText('Continue to payment');
  });
});
