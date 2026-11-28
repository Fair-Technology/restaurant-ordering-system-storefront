import { test, expect, type Page } from '@playwright/test';

/**
 * Checkout refusals that retrying cannot fix: SHOP_OFFLINE, SHOP_CLOSED, BELOW_MINIMUM.
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
  phone: '030 7654321',
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

const ORDER_FAILED = 'Your order could not be sent. Please try again.';
const PRICES_UNAVAILABLE = "We couldn't load the prices for your order. Please try again.";

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockShop(page: Page, shop: () => Record<string, unknown> = () => SHOP) {
  await page.route('**/api/shops/slug/test-shop', (route) => route.fulfill(fulfil(shop())));
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

async function seedCart(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

const submit = (page: Page) => page.locator('button[form="checkout-details"]');

async function fillAndSubmit(page: Page) {
  await page.getByPlaceholder('Your full name').fill('Test Diner');
  await page.getByPlaceholder('your@email.com').fill('diner@example.com');
  await page.getByTestId('checkout-phone-input').fill('0301234567');
  await expect(submit(page)).toBeEnabled();
  await submit(page).click();
}

test.describe('Checkout cannot be sent', () => {
  test.use({ locale: 'en-US' });

  test('SHOP_OFFLINE on the quote hands over to the offline screen, no retry UI', async ({ page }) => {
    let offline = false;
    await mockShop(page, () => ({ ...SHOP, isOffline: offline }));
    await seedCart(page);
    let posts = 0;
    await page.route('**/api/orders', (route) => {
      posts++;
      return route.fulfill(fulfil({ error: 'x' }, 500));
    });
    await page.route('**/api/orders/quote', (route) => {
      offline = true;
      return route.fulfill(fulfil({ error: 'Back soon', errorCode: 'SHOP_OFFLINE' }, 400));
    });

    await page.goto('/shops/test-shop/checkout');

    const screen = page.getByTestId('shop-offline');
    await expect(screen).toBeVisible();
    await expect(screen.getByRole('link', { name: /030 7654321/ })).toHaveAttribute(
      'href',
      /^tel:/,
    );
    await expect(page.getByTestId('quote-error')).toHaveCount(0);
    await expect(page.getByTestId('retry-quote')).toHaveCount(0);
    await expect(page.getByText(PRICES_UNAVAILABLE)).toHaveCount(0);
    expect(posts).toBe(0);
  });

  test('SHOP_CLOSED on checkout explains, shows the phone, and disables submit after requote', async ({
    page,
  }) => {
    await mockShop(page);
    await seedCart(page);
    let quotes = 0;
    await page.route('**/api/orders/quote', (route) => {
      quotes++;
      return route.fulfill(fulfil(quotes === 1 ? okQuote : { ...okQuote, openNow: false }));
    });
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'closed (free text)', errorCode: 'SHOP_CLOSED' }, 400)),
    );

    await page.goto('/shops/test-shop/checkout');
    await fillAndSubmit(page);

    const box = page.getByTestId('checkout-fatal-error');
    await expect(box).toContainText('This restaurant is not taking orders right now.');
    await expect(box.getByRole('link', { name: /030 7654321/ })).toHaveAttribute('href', /^tel:/);
    await expect(page.getByText(ORDER_FAILED)).toHaveCount(0);
    await expect(submit(page)).toBeDisabled();
  });

  test('BELOW_MINIMUM on checkout shows the new minimum and disables submit after requote', async ({
    page,
  }) => {
    await mockShop(page);
    await seedCart(page);
    let quotes = 0;
    await page.route('**/api/orders/quote', (route) => {
      quotes++;
      return route.fulfill(
        fulfil(quotes === 1 ? okQuote : { ...okQuote, belowMinimum: true, minOrderAmountCents: 2000 }),
      );
    });
    await page.route('**/api/orders', (route) =>
      route.fulfill(
        fulfil({ error: 'below min (free text)', errorCode: 'BELOW_MINIMUM', minimumCents: 2000 }, 400),
      ),
    );

    await page.goto('/shops/test-shop/checkout');
    await fillAndSubmit(page);

    await expect(page.getByRole('alert').filter({ hasText: 'The minimum order is €20.00.' }).first()).toBeVisible();
    await expect(page.getByText(ORDER_FAILED)).toHaveCount(0);
    await expect(submit(page)).toBeDisabled();
  });
});
