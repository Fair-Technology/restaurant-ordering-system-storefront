import { test, expect, type Page } from '@playwright/test';
import { fakeStripe, fakeStripeCalls } from '../fixtures/fakeStripe';

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
  paymentStatus: 'authorized',
  refundedCents: 0,
  documents: [] as unknown[],
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
  paymentMethods: ['card'],
  addressRequired: false,
  prepMinutes: 20,
};

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

interface MockOptions {
  language?: 'en' | 'de';
  modes?: string[];
  quote?: (requestBody: Json) => Json;
  order?: Json;
}

async function mockBackend(page: Page, opts: MockOptions = {}) {
  const language = opts.language ?? 'en';
  await fakeStripe(page);
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill(
      fulfil({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        currency: 'EUR',
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
  await page.route('**/api/orders', (route) => route.fulfill(fulfil(CARD_RESULT)));
  await page.route('**/api/customer-orders/o1/view', (route) =>
    route.fulfill(fulfil({ ...PLACED_ORDER, ...opts.order })),
  );
  await page.route('**/api/customer-orders/o1/cancel', (route) =>
    route.fulfill(
      fulfil({
        ...PLACED_ORDER,
        state: 'CANCELLED',
        displayState: 'CANCELLED',
        paymentStatus: 'canceled',
        canCancel: false,
      }),
    ),
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

async function fillAddress(page: Page, address: Record<string, string>) {
  for (const [label, value] of Object.entries(address)) {
    await page.getByLabel(label).fill(value);
  }
}

const ORDER_URL = '/shops/test-shop/orders/o1?t=tok';

test.describe('Card order', () => {
  test.use({ locale: 'en-US' });

  test('pays by card and lands on the order page', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);

    // The address is optional, but half an address is not accepted
    await page.getByLabel('Street and number').fill('Musterstraße 1');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('Please fill in the whole address or leave it empty.')).toBeVisible();
    expect(placed).toBeNull();
    await page.getByLabel('Street and number').fill('');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await page.getByRole('button', { name: 'Order with obligation to pay' }).click();

    await expect(page).toHaveURL(/\/shops\/test-shop\/orders\/o1\?t=tok$/);
    await expect(page.getByText('Order AB3-K7P')).toBeVisible();
    await expect(page.getByText('Waiting for Test Shop to confirm your order')).toBeVisible();

    const body = placed as unknown as Json;
    expect(body.paymentMethod).toBe('card');
    expect(body).not.toHaveProperty('customerAddress');
    expect(body.legalRevisions).toEqual({ terms: 1, withdrawal: 1 });
    expect((body.items as Json[])[0].expectedUnitPriceCents).toBe(1050);
    expect(String(body.idempotencyKey).length).toBeGreaterThanOrEqual(8);

    // Stripe was loaded for the restaurant's own account, not the platform's
    const calls = await fakeStripeCalls(page);
    expect(calls.init?.options.stripeAccount).toBe('acct_test');
    expect(calls.confirmParams?.return_url).toContain('/shops/test-shop/checkout');
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
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    await page.getByRole('button', { name: 'Update my basket' }).click();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('a closed restaurant cannot take the order', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, openNow: false }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('This restaurant is not taking orders right now.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('a restaurant without Stripe says why it cannot take orders', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, paymentMethods: [] }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('This restaurant cannot take online orders yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  test('the diner can cancel before the restaurant accepts', async ({ page }) => {
    await mockBackend(page);
    let cancelBody: Json | null = null;
    await page.route('**/api/customer-orders/o1/cancel', async (route) => {
      cancelBody = route.request().postDataJSON() as Json;
      await route.fulfill(
        fulfil({
          ...PLACED_ORDER,
          state: 'CANCELLED',
          displayState: 'CANCELLED',
          paymentStatus: 'canceled',
          canCancel: false,
        }),
      );
    });
    await page.goto(ORDER_URL);

    // The card is only reserved while the restaurant has not answered
    await expect(page.getByText('Reserved online')).toBeVisible();
    await expect(page.getByText(/The amount is reserved on your card\. You are only charged/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByText('Cancel this order?')).toBeVisible();
    expect(cancelBody).toBeNull();
    await page.getByRole('button', { name: 'Yes, cancel order' }).click();

    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    expect(cancelBody).toEqual({ token: 'tok' });
  });

  test('a German order opened fresh in an English browser shows German prices', async ({ page }) => {
    await mockBackend(page, { order: { language: 'de' } });
    await page.goto('/shops/test-shop/orders/o1?t=TT');

    await expect(page.getByText(/10,50\s€/).first()).toBeVisible();
    await expect(page.getByText('€10.50')).toHaveCount(0);
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

  test('the order page waits while the payment is confirmed', async ({ page }) => {
    await mockBackend(page);
    let calls = 0;
    await page.route('**/api/customer-orders/o1/view', async (route) => {
      calls += 1;
      if (calls <= 2) {
        await route.fulfill(fulfil({ error: 'Your payment is being confirmed' }, 404));
      } else {
        await route.fulfill(fulfil(PLACED_ORDER));
      }
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('Your payment is being confirmed…')).toBeVisible();
    await expect(page.getByText('We could not find this order')).toHaveCount(0);
    // The page asks again on its own (every 3 seconds) and shows the order once it exists
    await expect(page.getByText('Order AB3-K7P')).toBeVisible({ timeout: 10_000 });
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  test('a declined order says nothing was charged', async ({ page }) => {
    await mockBackend(page, {
      order: {
        state: 'REJECTED',
        displayState: 'REJECTED',
        paymentStatus: 'canceled',
        rejectionReason: 'too_busy',
        canCancel: false,
      },
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('Your order was declined')).toBeVisible();
    await expect(
      page.getByText('You have not been charged. The reservation on your card has been released.'),
    ).toBeVisible();
    await expect(page.getByText(/may still show as pending for a few days/)).toBeVisible();
    await expect(page.getByText(/The amount is reserved on your card/)).toHaveCount(0);
  });

  test('the diner downloads the invoice and the correction', async ({ page }) => {
    await mockBackend(page, {
      order: {
        state: 'ACCEPTED',
        displayState: 'ACCEPTED',
        paymentStatus: 'partially_refunded',
        refundedCents: 350,
        canCancel: false,
        readyAt: '2026-10-05T10:20:00.000Z',
        documents: [
          { id: 'o1', kind: 'invoice', number: 'R-2026-00001' },
          { id: 'o1-c1', kind: 'correction', number: 'R-2026-00002' },
        ],
      },
    });
    const bodies: Json[] = [];
    const file = (fileName: string) => ({
      fileName,
      contentType: 'application/pdf',
      contentBase64: Buffer.from('%PDF-1.4 test').toString('base64'),
    });
    await page.route('**/api/customer-orders/o1/documents/o1', async (route) => {
      bodies.push(route.request().postDataJSON() as Json);
      await route.fulfill(fulfil(file('Invoice-R-2026-00001.pdf')));
    });
    await page.route('**/api/customer-orders/o1/documents/o1-c1', async (route) => {
      bodies.push(route.request().postDataJSON() as Json);
      await route.fulfill(fulfil(file('Correction-invoice-R-2026-00002.pdf')));
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('€3.50 has been refunded to you.')).toBeVisible();

    const invoiceDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download invoice/ }).click();
    expect((await invoiceDownload).suggestedFilename()).toBe('Invoice-R-2026-00001.pdf');

    const correctionDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download correction invoice/ }).click();
    expect((await correctionDownload).suggestedFilename()).toBe('Correction-invoice-R-2026-00002.pdf');

    expect(bodies).toEqual([{ token: 'tok' }, { token: 'tok' }]);
  });

  test('an order over €250 asks for an address', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, subtotalCents: 25200, addressRequired: true }) });
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);

    await expect(page.getByText('Billing address (required for orders over €250)')).toBeVisible();

    // The four fields are required, so the browser itself stops an empty or partial address
    await page.getByLabel('Street and number').fill('Musterstraße 1');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    expect(placed).toBeNull();

    await fillAddress(page, { Postcode: '60311', City: 'Frankfurt am Main', Country: 'Germany' });
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();

    expect((placed as unknown as Json).customerAddress).toEqual({
      street: 'Musterstraße 1',
      postcode: '60311',
      city: 'Frankfurt am Main',
      country: 'Germany',
    });
  });
});

test.describe('Card order in German', () => {
  test.use({ locale: 'de-DE' });

  test('German pay button', async ({ page }) => {
    await mockBackend(page, { language: 'de' });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText(/Sie bezahlen jetzt online/)).toBeVisible();
    await fillDetails(page);
    await page.getByRole('button', { name: 'Weiter zur Zahlung' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toBeEnabled();
  });
});
