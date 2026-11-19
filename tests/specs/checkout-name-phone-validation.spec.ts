import { test, expect, type Page } from '@playwright/test';
import { fakeStripe } from '../fixtures/fakeStripe';

/**
 * Checkout details step: a blank name and a missing/invalid phone number are caught with
 * inline messages before any order is created. Every API call is mocked.
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

const CARD_RESULT = {
  kind: 'card',
  sessionId: 'sess1',
  orderId: 'o1',
  accessToken: 'tok',
  clientSecret: 'pi_test_secret_abc',
  subtotalCents: 1050,
  currency: 'EUR',
  stripeConnectAccountId: 'acct_test',
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

const NAME_REQUIRED = 'Please enter your name.';
const PHONE_REQUIRED = 'Please enter your phone number.';
const PHONE_INVALID =
  'Please enter a valid phone number (digits, spaces, and + - ( ) . only, 6 to 15 digits).';

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function setup(page: Page) {
  await fakeStripe(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'mewmew_cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
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
  await page.route('**/api/orders/quote', (route) => route.fulfill(fulfil(okQuote)));
  const orderPosts: unknown[] = [];
  await page.route('**/api/orders', (route) => {
    orderPosts.push(route.request().postDataJSON());
    return route.fulfill(fulfil(CARD_RESULT));
  });
  return { orderPosts };
}

async function fill(page: Page, name: string, phone: string) {
  await page.getByPlaceholder('Your full name').fill(name);
  await page.getByPlaceholder('your@email.com').fill('diner@example.com');
  await page.getByPlaceholder('+1 (555) 000-0000').fill(phone);
}

const submit = (page: Page) => page.getByRole('button', { name: 'Continue to payment' });

test.describe('Checkout name and phone validation', () => {
  test.use({ locale: 'en-US' });

  test('a whitespace-only name shows the inline name error and creates no order', async ({ page }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');
    await fill(page, '   ', '+49 170 1234567');
    await submit(page).click();

    await expect(page.getByRole('alert').filter({ hasText: NAME_REQUIRED })).toBeVisible();
    await expect(page.getByPlaceholder('Your full name')).toBeFocused();
    await expect(page.getByPlaceholder('Your full name')).toHaveAttribute('aria-invalid', 'true');
    expect(orderPosts).toHaveLength(0);
    await expect(page.getByTestId('fake-card')).toHaveCount(0);

    // The message goes away as soon as the diner starts typing
    await page.getByPlaceholder('Your full name').fill('J');
    await expect(page.getByText(NAME_REQUIRED)).toHaveCount(0);
  });

  test('a phone of "abc" shows the invalid-phone error and creates no order', async ({ page }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');
    await fill(page, 'Jane Diner', 'abc');
    await submit(page).click();

    await expect(page.getByRole('alert').filter({ hasText: PHONE_INVALID })).toBeVisible();
    await expect(page.getByPlaceholder('+1 (555) 000-0000')).toBeFocused();
    expect(orderPosts).toHaveLength(0);
    await expect(page.getByTestId('fake-card')).toHaveCount(0);
  });

  test('an empty phone shows the required-phone error and creates no order', async ({ page }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');
    await fill(page, 'Jane Diner', '');
    await submit(page).click();

    await expect(page.getByRole('alert').filter({ hasText: PHONE_REQUIRED })).toBeVisible();
    await expect(page.getByPlaceholder('+1 (555) 000-0000')).toBeFocused();
    expect(orderPosts).toHaveLength(0);
    await expect(page.getByTestId('fake-card')).toHaveCount(0);
  });

  test('control: a valid name and phone show no errors and the flow proceeds', async ({ page }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');
    await fill(page, 'Jane Diner', '+49 170 1234567');
    await submit(page).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect(orderPosts).toHaveLength(1);
    await expect(page.getByText(NAME_REQUIRED)).toHaveCount(0);
    await expect(page.getByText(PHONE_REQUIRED)).toHaveCount(0);
    await expect(page.getByText(PHONE_INVALID)).toHaveCount(0);
  });
});
