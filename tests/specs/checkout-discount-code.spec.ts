import { test, expect, type Page } from '@playwright/test';

/**
 * Checkout discount code: Enter in the code box applies it, and continuing
 * with a typed-but-unapplied code is blocked with a message instead of
 * silently placing the order without the discount.
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

const NOT_APPLIED = 'Please apply your discount code first.';

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
      'cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

const submit = (page: Page) => page.locator('button[form="checkout-details"]');

type Json = Record<string, unknown>;

function codeQuote(body: Json): Json {
  const code = body.discountCode as string | undefined;
  const ok = code === 'TESTX';
  return {
    ...okQuote,
    acceptsCodes: true,
    loyalty: null,
    discountMinSubtotalCents: null,
    discount: ok ? { kind: 'code', code: 'TESTX', cents: 200 } : null,
    discountProblem: code && !ok ? 'unknown' : null,
    totalCents: ok ? 850 : 1050,
  };
}

/** Mocks the quote (recording every request body) and place-order (recording POSTs). */
async function setup(page: Page) {
  await mockShop(page);
  await seedCart(page);
  const quoteBodies: Json[] = [];
  const orderPosts: Json[] = [];
  await page.route('**/api/orders/quote', (route) => {
    const body = route.request().postDataJSON() as Json;
    quoteBodies.push(body);
    return route.fulfill(fulfil(codeQuote(body)));
  });
  await page.route('**/api/orders', (route) => {
    orderPosts.push(route.request().postDataJSON() as Json);
    return route.fulfill(fulfil({ error: 'should not be reached' }, 500));
  });
  return { quoteBodies, orderPosts };
}

async function fillDetails(page: Page) {
  await page.getByPlaceholder('Your full name').fill('Test Diner');
  await page.getByPlaceholder('your@email.com').fill('diner@example.com');
  await page.getByPlaceholder('+1 (555) 000-0000').fill('0301234567');
}

async function openCodeBox(page: Page) {
  await page.getByText('Have a discount code?').click();
  return page.getByLabel('Discount code');
}

test.describe('Checkout discount code', () => {
  test.use({ locale: 'en-US' });

  test('Enter applies a valid code', async ({ page }) => {
    const { quoteBodies } = await setup(page);
    await page.goto('/shops/test-shop/checkout');

    const input = await openCodeBox(page);
    await input.fill('testx');
    const requested = page.waitForRequest(
      (r) => r.url().includes('/api/orders/quote') && r.postDataJSON()?.discountCode === 'TESTX',
    );
    await input.press('Enter');
    await requested;

    const discount = page.getByTestId('discount');
    await expect(discount.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(discount.getByRole('button', { name: 'Apply' })).toHaveCount(0);
    await expect(page.getByTestId('order-totals')).toContainText('Discount (TESTX)');
    await expect(page.getByTestId('order-totals')).toContainText('-€2.00');
    expect(quoteBodies.some((b) => b.discountCode === 'TESTX')).toBe(true);
  });

  test('Enter on a wrong code shows "This code is not valid."', async ({ page }) => {
    await setup(page);
    await page.goto('/shops/test-shop/checkout');

    const input = await openCodeBox(page);
    await input.fill('WRONG');
    await input.press('Enter');

    await expect(page.getByText('This code is not valid.')).toBeVisible();
    await expect(page.getByTestId('discount').getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('Enter on an empty box does nothing', async ({ page }) => {
    const { quoteBodies } = await setup(page);
    await page.goto('/shops/test-shop/checkout');

    const input = await openCodeBox(page);
    await expect(submit(page)).toBeEnabled();
    const before = quoteBodies.length;
    await input.press('Enter');

    await expect(page.getByTestId('discount').getByRole('button', { name: 'Apply' })).toBeVisible();
    expect(quoteBodies.length).toBe(before);
    expect(quoteBodies.every((b) => b.discountCode === undefined)).toBe(true);
  });

  test('continuing with a typed but unapplied code is blocked', async ({ page }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');

    const input = await openCodeBox(page);
    await input.fill('TESTX');
    await fillDetails(page);
    await submit(page).click();

    await expect(page.getByRole('alert').filter({ hasText: NOT_APPLIED })).toBeVisible();
    expect(orderPosts).toHaveLength(0);
    await expect(page.getByTestId('fake-card')).toHaveCount(0);
  });

  test('control: the Apply button still applies a code', async ({ page }) => {
    await setup(page);
    await page.goto('/shops/test-shop/checkout');

    const input = await openCodeBox(page);
    await input.fill('TESTX');
    await page.getByTestId('discount').getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByTestId('order-totals')).toContainText('Discount (TESTX)');
    await expect(page.getByTestId('discount').getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('control: an applied code, or an open empty box, is not blocked by the guard', async ({
    page,
  }) => {
    const { orderPosts } = await setup(page);
    await page.goto('/shops/test-shop/checkout');

    // Open but empty: the guard must stay quiet and the order goes out.
    await openCodeBox(page);
    await fillDetails(page);
    await submit(page).click();
    await expect.poll(() => orderPosts.length).toBe(1);
    await expect(page.getByText(NOT_APPLIED)).toHaveCount(0);

    // Applied: same.
    await page.getByLabel('Discount code').fill('TESTX');
    await page.getByTestId('discount').getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('order-totals')).toContainText('Discount (TESTX)');
    await submit(page).click();
    await expect.poll(() => orderPosts.length).toBe(2);
    await expect(page.getByText(NOT_APPLIED)).toHaveCount(0);
    expect(orderPosts[1]).toMatchObject({ discountCode: 'TESTX', expectedDiscountCents: 200 });
  });
});
