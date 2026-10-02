import { test, expect, type Page } from '@playwright/test';

type Json = Record<string, unknown>;

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

const CASH_RESULT = {
  kind: 'cash',
  orderId: 'o1',
  orderRef: 'AB3-K7P',
  accessToken: 'tok',
  subtotalCents: 1050,
  currency: 'EUR',
  state: 'PLACED',
  autoRejectAt: '2026-10-05T10:10:00.000Z',
};

const PLACED_ORDER = {
  orderId: 'o1',
  orderRef: 'AB3-K7P',
  shopSlug: 'test-shop',
  shopName: 'Test Shop',
  sellerPhone: '030 1234567',
  timezone: 'Europe/Berlin',
  language: 'en',
  state: 'PLACED',
  displayState: 'PLACED',
  fulfilmentMode: 'collection',
  paymentMethod: 'cash',
  paymentStatus: 'cash_due',
  readyAt: null,
  items: [
    {
      productName: 'Carbonara',
      quantity: 1,
      unitPriceCents: 1050,
      lineTotalCents: 1050,
      selectedVariantOptionName: null,
      selectedAddonOptionNames: [],
    },
  ],
  subtotalCents: 1050,
  currency: 'EUR',
  createdAt: '2026-10-05T10:00:00.000Z',
  canCancel: true,
  rejectionReason: null,
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
  paymentMethods: ['cash'],
  prepMinutes: 20,
};

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

interface MockOptions {
  language?: 'en' | 'de';
  modes?: string[];
  quote?: (requestBody: Json) => Json;
}

async function mockBackend(page: Page, opts: MockOptions = {}) {
  const language = opts.language ?? 'en';
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill(
      fulfil({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        currency: 'EUR',
        paymentPolicy: 'pay_in_person',
        fulfilment: {
          modes: opts.modes ?? ['collection'],
          prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
        },
        branding: null,
      }),
    ),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill(
      fulfil({
        language,
        languages: [language],
        categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, products: [baseProduct] }],
      }),
    ),
  );
  await page.route('**/api/shops/slug/test-shop/legal**', (route) =>
    route.fulfill(
      fulfil({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language,
        impressum: { lines: [{ label: 'Provider', value: 'Test Shop GmbH' }] },
        terms: { text: 'T'.repeat(60), revision: 1, updatedAt: 'x' },
        withdrawal: { text: 'W'.repeat(60), revision: 1, updatedAt: 'x' },
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    ),
  );
  await page.route('**/api/orders/quote', (route) => {
    const body = route.request().postDataJSON() as Json;
    return route.fulfill(fulfil(opts.quote ? opts.quote(body) : okQuote));
  });
  await page.route('**/api/orders', (route) => route.fulfill(fulfil(CASH_RESULT)));
  await page.route('**/api/customer-orders/o1/view', (route) => route.fulfill(fulfil(PLACED_ORDER)));
  await page.route('**/api/customer-orders/o1/cancel', (route) =>
    route.fulfill(fulfil({ ...PLACED_ORDER, state: 'CANCELLED', displayState: 'CANCELLED', canCancel: false })),
  );
}

async function seedCart(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mewmew_cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

async function fillDetails(page: Page) {
  await page.getByPlaceholder('Your full name').fill('Test Diner');
  await page.getByPlaceholder('your@email.com').fill('diner@example.com');
  await page.getByPlaceholder('+1 (555) 000-0000').fill('0301234567');
}

test.describe('Cash order', () => {
  test.use({ locale: 'en-US' });

  test('places a cash order and lands on the order page', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CASH_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Order with obligation to pay' }).click();

    await expect(page).toHaveURL(/\/shops\/test-shop\/orders\/o1\?t=tok$/);
    await expect(page.getByText('Order AB3-K7P')).toBeVisible();
    await expect(page.getByText('Waiting for Test Shop to confirm your order')).toBeVisible();

    const body = placed as unknown as Json;
    expect(body.paymentMethod).toBe('cash');
    expect(body.legalRevisions).toEqual({ terms: 1, withdrawal: 1 });
    expect((body.items as Json[])[0].expectedUnitPriceCents).toBe(1050);
    expect(String(body.idempotencyKey).length).toBeGreaterThanOrEqual(8);
  });

  test('a changed price needs one confirmation', async ({ page }) => {
    await mockBackend(page, {
      quote: (body) => {
        const expected = (body.items as Json[])[0].expectedUnitPriceCents;
        if (expected !== 1050) return okQuote;
        return {
          ...okQuote,
          lines: [{ ...okQuote.lines[0], status: 'price_changed', unitPriceCents: 1150, expectedUnitPriceCents: 1050 }],
        };
      },
    });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('Carbonara now costs €11.50 (was €10.50).')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order with obligation to pay' })).toBeDisabled();
    await page.getByRole('button', { name: 'Update my basket' }).click();
    await expect(page.getByRole('button', { name: 'Order with obligation to pay' })).toBeEnabled();
  });

  test('a closed restaurant cannot take the order', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, openNow: false }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('This restaurant is not taking orders right now.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order with obligation to pay' })).toBeDisabled();
  });

  test('the diner can cancel before the restaurant accepts', async ({ page }) => {
    await mockBackend(page);
    let cancelBody: Json | null = null;
    await page.route('**/api/customer-orders/o1/cancel', async (route) => {
      cancelBody = route.request().postDataJSON() as Json;
      await route.fulfill(
        fulfil({ ...PLACED_ORDER, state: 'CANCELLED', displayState: 'CANCELLED', canCancel: false }),
      );
    });
    page.on('dialog', (d) => d.accept());
    await page.goto('/shops/test-shop/orders/o1?t=tok');
    await page.getByRole('button', { name: 'Cancel order' }).click();

    await expect(page.getByText('Cancelled')).toBeVisible();
    expect(cancelBody).toEqual({ token: 'tok' });
  });

  test('the menu says collection only', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Collection · ready in about 20 min')).toBeVisible();
  });

  test('with two modes the diner picks one before the menu', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('How would you like your order?')).toBeVisible();
    await page.getByRole('button', { name: 'Eat in' }).click();
    await expect(page.getByRole('button', { name: 'Eat in' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Cash order in German', () => {
  test.use({ locale: 'de-DE' });

  test('German order button', async ({ page }) => {
    await mockBackend(page, { language: 'de' });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toBeVisible();
    await expect(page.getByText('Sie bezahlen bei der Abholung im Restaurant.')).toBeVisible();
  });
});
