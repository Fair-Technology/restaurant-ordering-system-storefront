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
  orderLimitReached?: boolean;
  delivery?: Json | null;
  products?: Json[];
  shop?: Json; // extra fields on the public shop
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
        countryCode: 'DE',
        timezone: 'Europe/Berlin',
        fulfilment: {
          modes: opts.modes ?? ['collection'],
          prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
          delivery: opts.delivery ?? null,
        },
        orderLimitReached: opts.orderLimitReached ?? false,
        branding: null,
        ...opts.shop,
      }),
    ),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill(
      fulfil({
        language,
        languages: [language],
        categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, products: opts.products ?? [baseProduct] }],
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

    // The address is optional (folded away), but half an address is not accepted
    await page.getByRole('button', { name: 'Add a billing address (optional)' }).click();
    await page.getByLabel('Street and number').fill('Musterstraße 1');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('Please fill in the whole address or leave it empty.')).toBeVisible();
    expect(placed).toBeNull();
    await page.getByLabel('Street and number').fill('');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByTestId('payment-totals-items')).toHaveText('€10.50');
    await expect(page.getByTestId('payment-totals-total')).toHaveText('€10.50');
    await expect(page.getByTestId('payment-totals-delivery')).toHaveCount(0);
    await expect(page.getByTestId('payment-totals-discount')).toHaveCount(0);
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
    // Stripe Link is off: no optional "save my details" box asking for email, phone and name
    expect(calls.createOptions?.wallets?.link).toBe('never');
    expect(calls.confirmParams?.return_url).toContain('/shops/test-shop/checkout');
  });

  test('going back from the card step keeps the details', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.route('**/api/orders', (route) => route.fulfill(fulfil(CARD_RESULT)));
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Add a billing address (optional)' }).click();
    await fillAddress(page, {
      'Street and number': 'Musterstraße 1',
      Postcode: '10115',
      City: 'Berlin',
    });
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();

    await page.getByRole('button', { name: /Back to/ }).click();

    await expect(page.getByPlaceholder('Your full name')).toHaveValue('Test Diner');
    await expect(page.getByPlaceholder('your@email.com')).toHaveValue('diner@example.com');
    await expect(page.getByPlaceholder('+1 (555) 000-0000')).toHaveValue('0301234567');
    await expect(page.getByLabel('Street and number')).toHaveValue('Musterstraße 1');
    await expect(page.getByLabel('Postcode')).toHaveValue('10115');
    await expect(page.getByLabel('City')).toHaveValue('Berlin');
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

  test('a collection-only menu shows no mode line', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    // one way to get the food: no mode line, no time estimate under the banner
    await expect(page.getByText('Collection', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/ready in about/)).toHaveCount(0);
  });

  test('dine-in is never offered without a table', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByText('How would you like your order?')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dine in' })).toHaveCount(0);
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

  test('a brief "not found" right after payment does not stop the order page', async ({ page }) => {
    await mockBackend(page);
    let calls = 0;
    await page.route('**/api/customer-orders/o1/view', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill(fulfil({ error: 'Your payment is being confirmed' }, 404));
      } else if (calls === 2) {
        // Stripe's confirmation landed between the server's two lookups
        await route.fulfill(fulfil({ error: 'Order not found' }, 404));
      } else {
        await route.fulfill(fulfil(PLACED_ORDER));
      }
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('Order AB3-K7P')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('We could not find this order')).toHaveCount(0);
  });

  test('a wrong link says the order cannot be found once the wait is over', async ({ page }) => {
    await page.clock.install();
    await mockBackend(page);
    await page.route('**/api/customer-orders/o1/view', (route) =>
      route.fulfill(fulfil({ error: 'Order not found' }, 404)),
    );
    await page.goto(ORDER_URL);

    await expect(page.getByText('We could not find this order')).toHaveCount(0);
    await page.clock.runFor(21_000);
    await expect(page.getByText('We could not find this order')).toBeVisible();
  });

  test('a slow confirmation asks the diner to keep the page open', async ({ page }) => {
    await page.clock.install();
    await mockBackend(page);
    await page.route('**/api/customer-orders/o1/view', (route) =>
      route.fulfill(fulfil({ error: 'Your payment is being confirmed' }, 404)),
    );
    await page.goto(ORDER_URL);

    await expect(page.getByText('Your payment is being confirmed…')).toBeVisible();
    await expect(page.getByText(/taking longer than usual/)).toHaveCount(0);
    await page.clock.runFor(60_000);
    await expect(page.getByText(/taking longer than usual/)).toHaveCount(0);
    await page.clock.runFor(61_000);
    await expect(page.getByText(/taking longer than usual/)).toBeVisible();
  });

  test('a confirmation that never comes says nothing was charged', async ({ page }) => {
    await page.clock.install();
    await mockBackend(page);
    let calls = 0;
    await page.route('**/api/customer-orders/o1/view', (route) => {
      calls += 1;
      return route.fulfill(
        calls <= 2
          ? fulfil({ error: 'Your payment is being confirmed' }, 404)
          : fulfil({ error: 'Order not found' }, 404),
      );
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('Your payment is being confirmed…')).toBeVisible();
    for (let i = 0; i < 8; i++) await page.clock.runFor(3_000);
    await expect(
      page.getByText('We could not confirm your order. You have not been charged', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('We could not find this order')).toHaveCount(0);
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

  test('an untouched address stays empty when the shop language loads late', async ({ page }) => {
    // English browser, German shop: the page is English from the start; the German menu arriving late
    // must not touch the address
    await mockBackend(page, { language: 'de' });
    await page.route('**/api/shops/shop-t/catalog**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill(
        fulfil({
          language: 'de',
          languages: ['de'],
          categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, products: [baseProduct] }],
        }),
      );
    });
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByPlaceholder('Your full name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();

    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect((placed as unknown as Json).customerAddress).toBeUndefined();
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
    // The details form is German too
    await page.getByPlaceholder('Vor- und Nachname').fill('Test Diner');
    await page.getByPlaceholder('name@beispiel.de').fill('diner@example.com');
    await page.getByPlaceholder('0170 1234567').fill('0301234567');
    await page.getByRole('button', { name: 'Weiter zur Zahlung' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toBeEnabled();
    const breakdown = page.getByTestId('payment-totals');
    await expect(breakdown).toContainText('Artikel');
    await expect(breakdown).toContainText('Summe');
    await expect(breakdown).toContainText('inkl. MwSt.');
    await expect(page.getByTestId('payment-totals-total')).toHaveText(/10,50\s€/);
  });
});

function bindTable(page: Page, label = '7', ageMs = 0) {
  return page.addInitScript(
    ([l, age]) =>
      sessionStorage.setItem(
        'table_session_v1:test-shop',
        JSON.stringify({ slug: 'test-shop', label: l, boundAt: Date.now() - age }),
      ),
    [label, ageMs] as const,
  );
}


test.describe('Table order', () => {
  test.use({ locale: 'en-US' });

  test('a table link opens the menu for that table', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop?t=7');
    await expect(page.getByText('Table 7 · Dine in')).toBeVisible();
    await expect(page).toHaveURL(/\/shops\/test-shop$/);
    await expect(page.getByText('How would you like your order?')).toHaveCount(0);
  });

  test('a table order is sent with its table', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await seedCart(page);
    const quotes: Json[] = [];
    let placed: Json | null = null;
    await page.route('**/api/orders/quote', async (route) => {
      quotes.push(route.request().postDataJSON() as Json);
      await route.fulfill(fulfil({ ...okQuote, fulfilmentMode: 'dine_in' }));
    });
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop?t=Terrasse%203');
    await expect(page.getByText('Table Terrasse 3 · Dine in')).toBeVisible();
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByText('Ordering for table Terrasse 3')).toBeVisible();
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();

    expect(quotes[quotes.length - 1].fulfilmentMode).toBe('dine_in');
    const body = placed as unknown as Json;
    expect(body.fulfilmentMode).toBe('dine_in');
    expect(body.table).toBe('Terrasse 3');
    expect(body.paymentMethod).toBe('card');
  });

  test('a badly formed table link shows the normal menu', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop?t=Bar%201%20Links%20hinten');
    await expect(
      page.getByText('This table QR code is not valid. Please ask a member of staff.'),
    ).toBeVisible();
    await expect(page.getByText('Carbonara').first()).toBeVisible();
  });

  test('with dine-in off a table link is ignored', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop?t=7');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByText('Table 7')).toHaveCount(0);
  });

  test('a table session expires after two hours', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await bindTable(page, '7', 7_260_000);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByText('Table 7 · Dine in')).toHaveCount(0);
  });

  test('not at the table switches back to collection', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop?t=7');
    await page.getByRole('button', { name: 'Not at this table? Order for collection instead' }).click();
    await expect(page.getByText('Table 7 · Dine in')).toHaveCount(0);
    await expect(page.getByText('Carbonara').first()).toBeVisible();
  });

  test('dine-in switched off mid-checkout forgets the table', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await bindTable(page);
    await seedCart(page);
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'This restaurant is not taking orders this way right now' }, 400)),
    );
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(
      page.getByText('This restaurant is not taking table orders right now. You can order for collection.'),
    ).toBeVisible();
    await expect(page.getByText('Ordering for table 7')).toHaveCount(0);
  });

  test('the diner order page shows the table', async ({ page }) => {
    await mockBackend(page, {
      order: {
        fulfilmentMode: 'dine_in',
        table: { label: '7' },
        state: 'ACCEPTED',
        displayState: 'ACCEPTED',
        paymentStatus: 'paid',
        canCancel: false,
        readyAt: '2026-10-05T10:20:00.000Z',
      },
    });
    await page.goto(ORDER_URL);
    await expect(page.getByText('Table 7')).toBeVisible();
    await expect(page.getByText('Confirmed — ready at 12:20')).toBeVisible();
    await expect(page.getByText(/ready for collection/)).toHaveCount(0);
  });
});

test.describe('Table order in German', () => {
  test.use({ locale: 'de-DE' });

  test('German table wording', async ({ page }) => {
    await mockBackend(page, { language: 'de', modes: ['collection', 'dine_in'] });
    await seedCart(page);
    await page.goto('/shops/test-shop?t=7');
    await expect(page.getByText('Tisch 7 · Vor Ort')).toBeVisible();
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByText('Bestellung für Tisch 7')).toBeVisible();
  });
});

test.describe('Ordering paused', () => {
  test.use({ locale: 'en-US' });

  test('the menu says ordering is paused when the order limit is reached', async ({ page }) => {
    await mockBackend(page, { orderLimitReached: true });
    await page.goto('/shops/test-shop');
    await expect(
      page.getByRole('alertdialog', { name: 'Online ordering is paused' }),
    ).toBeVisible();
  });

  test('checkout cannot continue while ordering is paused', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, orderLimitReached: true }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await expect(
      page.getByText('Online ordering is paused at the moment.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('a limit reached during checkout shows the paused message', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'This restaurant has paused online ordering for now' }, 400)),
    );
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(
      page.getByText('Online ordering is paused at the moment.', { exact: false }),
    ).toBeVisible();
  });
});

test.describe('Ordering paused in German', () => {
  test.use({ locale: 'de-DE' });

  test('the German menu says ordering is paused', async ({ page }) => {
    await mockBackend(page, { language: 'de', orderLimitReached: true });
    await page.goto('/shops/test-shop');
    await expect(
      page.getByRole('alertdialog', { name: 'Online-Bestellungen pausiert' }),
    ).toBeVisible();
  });
});

const ZONES = { zones: [{ postcode: '10115', feeCents: 250, minOrderCents: 1000 }] };
const DELIVERY_MODES = ['collection', 'delivery'];

function deliveryQuote(body: Json): Json {
  return body.postcode === '10115'
    ? {
        ...okQuote,
        fulfilmentMode: 'delivery',
        deliveryFeeCents: 250,
        totalCents: 1300,
        postcodeServed: true,
        minOrderAmountCents: 1000,
        prepMinutes: 45,
      }
    : { ...okQuote, fulfilmentMode: 'delivery', deliveryFeeCents: null, totalCents: 1050, postcodeServed: false };
}

function bindDelivery(page: Page, postcode = '10115') {
  return page.addInitScript(
    (p) =>
      sessionStorage.setItem(
        'delivery_session_v1:test-shop',
        JSON.stringify({ slug: 'test-shop', postcode: p, savedAt: Date.now() }),
      ),
    postcode,
  );
}

async function fillDeliveryAddress(page: Page) {
  await page.getByLabel('Delivery street and number', { exact: true }).fill('Teststraße 1');
  await page.getByLabel('Delivery town or city', { exact: true }).fill('Berlin');
}

test.describe('Delivery order', () => {
  test.use({ locale: 'en-US' });

  test('delivery asks for the postcode first', async ({ page }) => {
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Delivery' }).click();
    await page.getByLabel('Your postcode').fill('10999');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(
      page.getByText("We don't deliver to 10999. You can collect your order instead."),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Collect instead' }).click();
    await expect(page.getByRole('button', { name: 'Collection' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Delivery' }).click();
    await page.getByLabel('Your postcode').fill('10 115');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(
      page.getByText('Delivery to 10115 · fee €2.50 · minimum order €10.00 · about 45 min'),
    ).toBeVisible();
  });

  test('a dish that cannot be delivered is hidden for delivery', async ({ page }) => {
    await mockBackend(page, {
      modes: DELIVERY_MODES,
      delivery: ZONES,
      products: [baseProduct, { ...baseProduct, id: 'p2', name: 'Draught beer', unavailableModes: ['delivery'] }],
    });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Draught beer')).toBeVisible();
    await page.getByRole('button', { name: 'Delivery' }).click();
    await page.getByLabel('Your postcode').fill('10115');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Delivery to 10115')).toBeVisible();
    await expect(page.getByText('Draught beer')).toHaveCount(0);
    await expect(page.getByText('Carbonara')).toBeVisible();
  });

  test('a delivery order is sent with its address and fee', async ({ page }) => {
    await bindDelivery(page);
    await seedCart(page);
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES, quote: deliveryQuote });
    const quotes: Json[] = [];
    let placed: Json | null = null;
    await page.route('**/api/orders/quote', async (route) => {
      const body = route.request().postDataJSON() as Json;
      quotes.push(body);
      await route.fulfill(fulfil(deliveryQuote(body)));
    });
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil({ ...CARD_RESULT, totalCents: 1300 }));
    });
    await page.goto('/shops/test-shop/checkout');

    const totals = page.getByTestId('delivery-totals');
    await expect(totals).toContainText('€10.50');
    await expect(totals).toContainText('€2.50');
    await expect(totals).toContainText('€13.00');
    await expect(page.getByText('Postcode 10115 –')).toBeVisible();

    await fillDetails(page);
    await fillDeliveryAddress(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByTestId('payment-total')).toHaveText('€13.00');
    await expect(page.getByTestId('payment-totals-items')).toHaveText('€10.50');
    await expect(page.getByTestId('payment-totals-delivery')).toHaveText('€2.50');
    await expect(page.getByTestId('payment-totals-total')).toHaveText('€13.00');
    await expect(page.getByTestId('payment-totals-discount')).toHaveCount(0);
    await expect(
      page.getByTestId('payment-totals').locator('xpath=following-sibling::*[1]').getByRole('button', { name: /Order with obligation to pay/ }),
    ).toBeVisible();
    expect(quotes[quotes.length - 1]).toMatchObject({ fulfilmentMode: 'delivery', postcode: '10115' });
    expect(placed).toMatchObject({
      fulfilmentMode: 'delivery',
      deliveryAddress: { street: 'Teststraße 1', postcode: '10115', city: 'Berlin' },
      expectedDeliveryFeeCents: 250,
    });
    expect((placed as unknown as Json).customerAddress).toBeUndefined();
    const calls = await fakeStripeCalls(page);
    expect(calls.createOptions?.defaultValues?.billingDetails?.address?.country).toBe('DE');
    expect(calls.createOptions?.wallets?.link).toBe('never');
  });

  test('a postcode no longer served blocks checkout', async ({ page }) => {
    await bindDelivery(page, '10999');
    await seedCart(page);
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES, quote: deliveryQuote });
    await page.goto('/shops/test-shop/checkout');
    await expect(
      page.getByText(
        'The restaurant no longer delivers to this postcode. Choose collection or another postcode on the menu.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('a changed fee asks for another look', async ({ page }) => {
    await bindDelivery(page);
    await seedCart(page);
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES, quote: deliveryQuote });
    await page.route('**/api/orders', (route) =>
      route.fulfill(
        fulfil({ error: 'The delivery fee has changed. Please check your order and try again.' }, 409),
      ),
    );
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await fillDeliveryAddress(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('The delivery fee has changed. Please check the new total.')).toBeVisible();
  });

  test('the diner order page shows delivery', async ({ page }) => {
    await mockBackend(page, {
      order: {
        fulfilmentMode: 'delivery',
        state: 'OUT_FOR_DELIVERY',
        displayState: 'OUT_FOR_DELIVERY',
        paymentStatus: 'paid',
        deliveryAddress: { street: 'Teststraße 1', postcode: '10115', city: 'Berlin' },
        deliveryFeeCents: 250,
        totalCents: 1300,
      },
    });
    await page.goto(ORDER_URL);
    await expect(page.getByText('On its way to you')).toBeVisible();
    await expect(page.getByText('Delivery to: Teststraße 1, 10115 Berlin')).toBeVisible();
    await expect(page.getByText('Delivery fee')).toBeVisible();
    await expect(page.getByText('€13.00')).toBeVisible();
  });

  async function continueToDeliveryPayment(page: Page, result: Json) {
    await bindDelivery(page);
    await seedCart(page);
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES, quote: deliveryQuote });
    await page.route('**/api/orders', (r) => r.fulfill(fulfil(result)));
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await fillDeliveryAddress(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
  }

  test('figures that do not add up show only the server total above the button', async ({ page }) => {
    await continueToDeliveryPayment(page, { ...CARD_RESULT, totalCents: 1400 });
    await expect(page.getByTestId('payment-totals-total')).toHaveText('€14.00');
    await expect(page.getByTestId('payment-totals-items')).toHaveCount(0);
    await expect(page.getByTestId('payment-totals-delivery')).toHaveCount(0);
    await expect(page.getByTestId('payment-total')).toHaveText('€14.00');
  });

  test('on a phone the payment step lists every dish and the costs without unfolding', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await continueToDeliveryPayment(page, { ...CARD_RESULT, totalCents: 1300 });
    await expect(page.getByTestId('payment-recap').getByText('1× Carbonara')).toBeVisible();
    await expect(page.getByRole('button', { name: /Show order/ })).toHaveCount(0);
    await expect(page.getByTestId('payment-recap').locator('[aria-expanded]')).toHaveCount(0);
    await page.getByTestId('payment-totals').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('payment-totals-delivery')).toBeVisible();
    await expect(page.getByTestId('payment-totals-delivery')).toHaveText('€2.50');
    await expect(page.getByTestId('payment-totals-total')).toHaveText('€13.00');
    await expect(
      page.getByTestId('payment-totals').locator('xpath=following-sibling::*[1]').getByRole('button', { name: /Order with obligation to pay/ }),
    ).toBeVisible();
  });
});

test.describe('Delivery order in German', () => {
  test.use({ locale: 'de-DE' });

  test('German delivery wording', async ({ page }) => {
    await mockBackend(page, { language: 'de', modes: DELIVERY_MODES, delivery: ZONES });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Lieferung' }).click();
    await page.getByLabel('Ihre Postleitzahl').fill('10115');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(
      page.getByText(/Lieferung nach 10115 · Liefergebühr 2,50\s€ · Mindestbestellwert 10,00\s€ · ca\. 45 Min\./),
    ).toBeVisible();
  });
});

const SLOTS = ['2026-10-10T16:00:00.000Z', '2026-10-10T16:15:00.000Z', '2026-10-11T10:00:00.000Z'];

function laterQuote(openNow: boolean) {
  return (body: Json): Json => ({
    ...okQuote,
    openNow,
    slots: SLOTS,
    scheduledFor: (body.scheduledFor as string | undefined) ?? null,
    slotAvailable: body.scheduledFor ? SLOTS.includes(body.scheduledFor as string) : null,
  });
}

test.describe('Order for later', () => {
  test.use({ locale: 'en-US' });

  test('a closed restaurant can take an order for later', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(false) });
    await seedCart(page);
    const quotes: Json[] = [];
    let placed: Json | null = null;
    await page.route('**/api/orders/quote', async (route) => {
      const body = route.request().postDataJSON() as Json;
      quotes.push(body);
      await route.fulfill(fulfil(laterQuote(false)(body)));
    });
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('The restaurant is closed right now. You can order for later.')).toBeVisible();
    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeDisabled();
    await expect(page.getByLabel('Later')).toBeChecked();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    await expect(page.getByLabel('Day')).toHaveValue('2026-10-10');
    await expect(page.getByLabel('Day')).toContainText('Sat 10 Oct');

    await page.getByLabel('Time').selectOption('2026-10-10T16:15:00.000Z');
    await expect(page.getByLabel('Time')).toContainText('18:15');
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();

    expect(placed).toMatchObject({ scheduledFor: '2026-10-10T16:15:00.000Z', fulfilmentMode: 'collection' });
    expect(quotes[quotes.length - 1]).toMatchObject({ scheduledFor: '2026-10-10T16:15:00.000Z' });
  });

  test('picking another day shows its times and leaves the time unpicked', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(false) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await page.getByLabel('Day').selectOption('2026-10-11');
    await expect(page.getByLabel('Day')).toHaveValue('2026-10-11');
    await expect(page.getByLabel('Time')).toHaveValue('');
    await page.getByLabel('Time').selectOption('2026-10-11T10:00:00.000Z');
    await expect(page.getByLabel('Time')).toHaveValue('2026-10-11T10:00:00.000Z');
  });

  test('an open restaurant orders as soon as possible unless later is picked', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(true) });
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeChecked();
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect(placed).not.toBeNull();
    expect('scheduledFor' in (placed as unknown as Json)).toBe(false);

    await page.goto('/shops/test-shop/checkout');
    await page.getByLabel('Later').click();
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    await page.getByLabel('Time').selectOption('2026-10-10T16:00:00.000Z');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('changing the day clears the chosen time', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(true) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await page.getByLabel('Later').click();
    await fillDetails(page);
    await page.getByLabel('Time').selectOption('2026-10-10T16:00:00.000Z');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();

    const days = await page.getByLabel('Day').locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    await page.getByLabel('Day').selectOption(days[1]);
    await expect(page.getByLabel('Day')).toHaveValue(days[1]);
    await expect(page.getByLabel('Time')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('a time taken meanwhile asks for another', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(false) });
    await seedCart(page);
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'This time is no longer available. Please choose another.' }, 409)),
    );
    await page.goto('/shops/test-shop/checkout');

    await page.getByLabel('Time').selectOption('2026-10-10T16:15:00.000Z');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByText('This time is no longer available. Please choose another.')).toBeVisible();
    await expect(page.getByLabel('Time')).toHaveValue('');
  });

  test('without times from the server nothing changes', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, openNow: false }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByText('This restaurant is not taking orders right now.')).toBeVisible();
    await expect(page.getByTestId('when')).toHaveCount(0);
  });

  test('going back from the card step and re-submitting names the earlier checkout', async ({ page }) => {
    await mockBackend(page, { quote: laterQuote(false) });
    await seedCart(page);
    const bodies: Json[] = [];
    await page.route('**/api/orders', async (route) => {
      bodies.push(route.request().postDataJSON() as Json);
      await route.fulfill(
        bodies.length === 2
          ? fulfil({ error: 'This time is no longer available. Please choose another.' }, 409)
          : fulfil(CARD_RESULT),
      );
    });
    await page.goto('/shops/test-shop/checkout');

    await page.getByLabel('Time').selectOption('2026-10-10T16:15:00.000Z');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    await page.getByRole('button', { name: /Back to/ }).click();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByLabel('Time')).toHaveValue('');
    await page.getByLabel('Time').selectOption('2026-10-10T16:15:00.000Z');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();

    expect(bodies.length).toBe(3);
    expect('replacesOrderId' in bodies[0]).toBe(false);
    expect(bodies[1]).toMatchObject({ replacesOrderId: 'o1', replacesAccessToken: 'tok', idempotencyKey: bodies[0].idempotencyKey });
    expect(bodies[2]).toMatchObject({ replacesOrderId: 'o1', replacesAccessToken: 'tok' });
    expect(bodies[2].idempotencyKey).not.toBe(bodies[0].idempotencyKey);
  });

  test('the order page shows the booked time', async ({ page }) => {
    await mockBackend(page, { order: { scheduledFor: '2026-10-10T16:00:00.000Z' } });
    await page.goto(ORDER_URL);

    await expect(page.getByText('For: Saturday, 10 October, 18:00')).toBeVisible();
    await expect(page.getByText('Booked — Test Shop confirms it shortly before.')).toBeVisible();
  });
});

test.describe('Order for later in German', () => {
  test.use({ locale: 'de-DE' });

  test('German wording for later', async ({ page }) => {
    await mockBackend(page, { language: 'de', quote: laterQuote(false) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(
      page.getByText('Das Restaurant hat gerade geschlossen. Sie können für später bestellen.'),
    ).toBeVisible();
    await expect(page.getByLabel('Später')).toBeChecked();
    await expect(page.getByLabel('Tag')).toContainText(/Sa\.?,? 10\. Okt/);
  });
});

function codeQuote(extra: Json = {}) {
  return (body: Json): Json => {
    const code = body.discountCode as string | undefined;
    const ok = code === 'WELCOME10';
    return {
      ...okQuote,
      acceptsCodes: true,
      loyalty: null,
      discountMinSubtotalCents: null,
      discount: ok ? { kind: 'code', code: 'WELCOME10', cents: 105 } : null,
      discountProblem: code && !ok ? 'unknown' : null,
      totalCents: ok ? 945 : 1050,
      taxCents: ok ? 62 : 69,
      ...extra,
    };
  };
}

test.describe('Discount codes', () => {
  test.use({ locale: 'en-US' });

  test('no code box unless the restaurant takes codes', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    await expect(page.getByTestId('discount')).toHaveCount(0);
  });

  test('a valid code lowers the total and is sent with the order', async ({ page }) => {
    await mockBackend(page, { quote: codeQuote() });
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil({ ...CARD_RESULT, totalCents: 945 }));
    });
    await page.goto('/shops/test-shop/checkout');

    await page.getByText('Have a discount code?').click();
    await page.getByLabel('Discount code').fill('welcome10');
    await page.getByRole('button', { name: 'Apply' }).click();

    const totals = page.getByTestId('order-totals');
    await expect(totals).toContainText('Discount (WELCOME10)');
    await expect(totals).toContainText('-€1.05');
    await expect(totals).toContainText('€9.45');

    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByTestId('payment-totals-items')).toHaveText('€10.50');
    await expect(page.getByTestId('payment-totals')).toContainText('Discount (WELCOME10)');
    await expect(page.getByTestId('payment-totals-discount')).toHaveText('-€1.05');
    await expect(page.getByTestId('payment-totals-total')).toHaveText('€9.45');
    await expect(page.getByTestId('payment-total')).toHaveText('€9.45');
    await expect(page.getByTestId('payment-totals-delivery')).toHaveCount(0);
    expect(placed).toMatchObject({ discountCode: 'WELCOME10', expectedDiscountCents: 105 });
  });

  test('an unknown code says so and blocks ordering until removed', async ({ page }) => {
    await mockBackend(page, { quote: codeQuote() });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await page.getByText('Have a discount code?').click();
    await page.getByLabel('Discount code').fill('NOPE1');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('This code is not valid.')).toBeVisible();

    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    await page.getByTestId('discount').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('a code the diner already used asks them to remove it', async ({ page }) => {
    await mockBackend(page, { quote: codeQuote() });
    await seedCart(page);
    await page.route('**/api/orders', (route) =>
      route.fulfill(fulfil({ error: 'You have already used this code.' }, 409)),
    );
    await page.goto('/shops/test-shop/checkout');

    await page.getByText('Have a discount code?').click();
    await page.getByLabel('Discount code').fill('WELCOME10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('order-totals')).toContainText('€9.45');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByText('You have already used this code.')).toBeVisible();
    await expect(page.getByLabel('Discount code')).toHaveValue('');
  });

  test('the loyalty offer can be ticked and is sent', async ({ page }) => {
    await mockBackend(page, { quote: codeQuote({ loyalty: { everyOrders: 5, rewardCents: 500 } }) });
    await seedCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');

    const tick = page.getByLabel('Email me a voucher worth €5.00 after every 5th order at Test Shop.');
    await expect(tick).not.toBeChecked();
    await tick.check();
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect(placed).toMatchObject({ loyaltyOptIn: true });

    placed = null;
    await page.goto('/shops/test-shop/checkout');
    await expect(tick).not.toBeChecked();
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect(placed).not.toBeNull();
    expect('loyaltyOptIn' in (placed as unknown as Json)).toBe(false);
  });

  test('a changed discount re-asks the server', async ({ page }) => {
    await mockBackend(page, { quote: codeQuote() });
    await seedCart(page);
    let quotes = 0;
    await page.route('**/api/orders/quote', async (route) => {
      quotes += 1;
      await route.fulfill(fulfil(codeQuote()(route.request().postDataJSON() as Json)));
    });
    await page.route('**/api/orders', (route) =>
      route.fulfill(
        fulfil({ error: 'Your discount has changed. Please check your order and try again.' }, 409),
      ),
    );
    await page.goto('/shops/test-shop/checkout');

    await page.getByText('Have a discount code?').click();
    await page.getByLabel('Discount code').fill('WELCOME10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('order-totals')).toContainText('€9.45');
    await fillDetails(page);
    const before = quotes;
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByText('Your discount has changed. Please check the total and try again.')).toBeVisible();
    await expect.poll(() => quotes).toBeGreaterThan(before);
  });

  test('the order page shows the discount', async ({ page }) => {
    await mockBackend(page, {
      order: { discount: { kind: 'code', code: 'WELCOME10', cents: 105 }, totalCents: 945 },
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('Discount (WELCOME10)')).toBeVisible();
  });
});

test.describe('Discount codes in German', () => {
  test.use({ locale: 'de-DE' });

  test('German wording for codes', async ({ page }) => {
    await mockBackend(page, { language: 'de', quote: codeQuote() });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await page.getByText('Rabattcode?').click();
    await page.getByLabel('Rabattcode').fill('NOPE1');
    await page.getByRole('button', { name: 'Einlösen' }).click();
    await expect(page.getByText('Dieser Code ist ungültig.')).toBeVisible();
  });
});

const COLA = { ...baseProduct, id: 'p2', name: 'Cola', price: 350, allergens: [] as unknown[] };
const FANTA = { ...baseProduct, id: 'p5', name: 'Fanta', price: 350, allergens: [] as unknown[] };
const COMBO = {
  ...baseProduct,
  id: 'm1',
  name: 'Pasta Menu',
  price: 1200,
  allergens: [{ id: 'gluten', label: 'Gluten' }],
  combo: {
    groups: [
      { id: 'g-main', name: 'Main', productIds: ['p1'] },
      { id: 'g-drink', name: 'Drink', productIds: ['p2', 'p5', 'p404'] },
    ],
  },
};
const MENU = [baseProduct, COLA, FANTA, COMBO];
const COMBO_CHOICES = [
  { groupId: 'g-main', productId: 'p1' },
  { groupId: 'g-drink', productId: 'p2' },
];
const comboQuote = () => ({
  ...okQuote,
  lines: [
    {
      index: 0,
      productId: 'm1',
      name: 'Pasta Menu',
      quantity: 1,
      status: 'ok',
      unitPriceCents: 1200,
      expectedUnitPriceCents: 1200,
      lineTotalCents: 1200,
    },
  ],
  subtotalCents: 1200,
  taxCents: 107,
  totalCents: 1200,
});
async function seedComboCart(page: Page) {
  await page.addInitScript(
    (choices) =>
      localStorage.setItem(
        'mewmew_cart_v1:test-shop',
        JSON.stringify([
          {
            key: 'm1::::::g-main=p1//;g-drink=p2//',
            id: 'm1',
            name: 'Pasta Menu',
            price: 12,
            quantity: 1,
            comboChoices: choices,
            detail: 'Carbonara · Cola',
          },
        ]),
      ),
    COMBO_CHOICES,
  );
}

test.describe('Combos', () => {
  test.use({ locale: 'en-US' });

  test('a combo shows on the menu with its badge', async ({ page }) => {
    await mockBackend(page, { products: MENU });
    await page.goto('/shops/test-shop');

    await expect(page.getByTestId('combo-badge')).toHaveCount(1);
    await expect(page.getByTestId('combo-badge')).toHaveText('Combo');
  });

  test('the picker needs one dish per group and adds the combo', async ({ page }) => {
    await mockBackend(page, { products: MENU });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'View details for Pasta Menu' }).click();

    // Carbonara, Cola and Fanta; p404 is not offered
    await expect(page.getByRole('radio')).toHaveCount(3);
    await expect(page.getByRole('radio', { name: 'Carbonara' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Add to order' })).toBeDisabled();
    await expect(page.getByText('Choose one dish in every group.')).toBeVisible();

    await page.getByRole('radio', { name: 'Cola' }).check();
    await expect(page.getByRole('button', { name: 'Add to order' })).toBeEnabled();
    await expect(page.getByText('Total €12.00')).toBeVisible();

    await page.getByRole('button', { name: 'Add to order' }).click();
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByText('Carbonara · Cola')).toBeVisible();
  });

  test('a combo whose choice has nothing left is hidden', async ({ page }) => {
    await mockBackend(page, {
      products: [baseProduct, { ...COLA, isAvailable: false }, { ...FANTA, isAvailable: false }, COMBO],
    });
    await page.goto('/shops/test-shop');

    await expect(page.getByRole('button', { name: 'View details for Carbonara' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View details for Pasta Menu' })).toHaveCount(0);
  });

  test('the combo is sent with its choices', async ({ page }) => {
    await mockBackend(page, { products: MENU, quote: comboQuote });
    await seedComboCart(page);
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect((placed as unknown as Json).items).toEqual([
      { productId: 'm1', quantity: 1, expectedUnitPriceCents: 1200, comboChoices: COMBO_CHOICES },
    ]);
  });

  test('the order page lists the dishes of a combo', async ({ page }) => {
    await mockBackend(page, {
      order: {
        items: [
          {
            productName: 'Pasta Menu: Carbonara',
            quantity: 1,
            unitPriceCents: 900,
            lineTotalCents: 900,
            selectedVariantOptionName: null,
            selectedAddonOptionNames: [],
          },
          {
            productName: 'Pasta Menu: Cola',
            quantity: 1,
            unitPriceCents: 300,
            lineTotalCents: 300,
            selectedVariantOptionName: null,
            selectedAddonOptionNames: [],
          },
        ],
        subtotalCents: 1200,
      },
    });
    await page.goto(ORDER_URL);

    await expect(page.getByText('1 × Pasta Menu: Cola')).toBeVisible();
  });
});

test.describe('Combos in German', () => {
  test.use({ locale: 'de-DE' });

  test('German wording for combos', async ({ page }) => {
    await mockBackend(page, { language: 'de', products: MENU });
    await page.goto('/shops/test-shop');

    await expect(page.getByTestId('combo-badge')).toHaveText('Menü');
    await page.getByRole('button', { name: /Pasta Menu/ }).first().click();
    await expect(page.getByRole('button', { name: 'Zur Bestellung' })).toBeVisible();
  });
});

test.describe('Shop info footer', () => {
  test.use({ locale: 'en-US' });
  const week = (open: string, close: string) =>
    Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ open, close }]]));
  const ADDRESS = { street: 'Gartenstraße 31', postcode: '60596', city: 'Frankfurt am Main', country: 'Deutschland' };

  test('shows address, grouped hours, phone and a route link, with no map loaded', async ({ page }) => {
    const google: string[] = [];
    page.on('request', (r) => {
      if (/google\./.test(r.url())) google.push(r.url());
    });
    await mockBackend(page, {
      shop: {
        address: ADDRESS,
        openingHours: { ...week('11:30', '21:00'), sun: [{ open: '12:00', close: '20:00' }], tue: [] },
        phone: '069 / 2028 4438',
      },
    });
    await page.goto('/shops/test-shop');
    const info = page.getByTestId('shop-info');
    await expect(info.getByText('Gartenstraße 31')).toBeVisible();
    await expect(info.getByText('60596 Frankfurt am Main')).toBeVisible();
    await expect(info.getByText('Mon: 11:30 – 21:00')).toBeVisible();
    await expect(info.getByText('Tue: Closed')).toBeVisible();
    await expect(info.getByText('Wed – Sat: 11:30 – 21:00')).toBeVisible();
    await expect(info.getByText('Sun: 12:00 – 20:00')).toBeVisible();
    await expect(info.getByRole('link', { name: '069 / 2028 4438' })).toHaveAttribute('href', 'tel:06920284438');
    const route = info.getByRole('link', { name: 'Get directions' });
    await expect(route).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent('Gartenstraße 31, 60596 Frankfurt am Main, Deutschland'),
    );
    await expect(route).toHaveAttribute('target', '_blank');
    expect(google).toEqual([]);
  });

  test('round-the-clock every day is one line; no phone means no phone line', async ({ page }) => {
    await mockBackend(page, { shop: { address: ADDRESS, openingHours: week('00:00', '00:00'), phone: null } });
    await page.goto('/shops/test-shop');
    const info = page.getByTestId('shop-info');
    await expect(info.getByText('Daily: Open 24 hours')).toBeVisible();
    await expect(info.getByText('Phone')).toHaveCount(0);
  });

  test('delivery with its own hours gets its own lines', async ({ page }) => {
    await mockBackend(page, {
      modes: ['collection', 'delivery'],
      delivery: {
        zones: [{ postcode: '10115', feeCents: 250, minOrderCents: 1500 }],
        hours: week('17:00', '21:00'),
      },
      shop: { address: ADDRESS, openingHours: week('11:30', '21:00') },
    });
    await page.goto('/shops/test-shop');
    const info = page.getByTestId('shop-info');
    await expect(info.getByText('Daily: 11:30 – 21:00')).toBeVisible();
    await expect(info.getByText('Delivery', { exact: true })).toBeVisible();
    await expect(info.getByText('Daily: 17:00 – 21:00')).toBeVisible();
  });

  test.describe('German browser', () => {
    test.use({ locale: 'de-DE' });

    test('German wording', async ({ page }) => {
      await mockBackend(page, {
        language: 'de',
        shop: { address: ADDRESS, openingHours: { ...week('11:30', '21:00'), sun: [] }, phone: '069 1234' },
      });
      await page.goto('/shops/test-shop');
      const info = page.getByTestId('shop-info');
      await expect(info.getByText('Öffnungszeiten')).toBeVisible();
      await expect(info.getByText('Mo – Sa: 11:30 – 21:00')).toBeVisible();
      await expect(info.getByText('So: Ruhetag')).toBeVisible();
      await expect(info.getByRole('link', { name: 'Route planen' })).toBeVisible();
    });
  });

  test('no address, hours or phone means no info block', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByTestId('shop-info')).toHaveCount(0);
  });
});

test.describe('Cart in the top bar', () => {
  test.use({ locale: 'en-US' });

  test('lists the dishes, steps the count and turns − into a bin at one', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart' }).click();

    const cart = page.getByRole('dialog', { name: 'Your order' });
    await expect(cart.getByText('Carbonara')).toBeVisible();
    await expect(cart.getByText('Collection · ready in about 20 min')).toBeVisible();
    await cart.getByRole('button', { name: 'One more Carbonara' }).click();
    await expect(cart.getByText('2 items')).toBeVisible();
    await expect(cart.getByText('€10.50 each')).toBeVisible();
    await cart.getByRole('button', { name: 'One less Carbonara' }).click();
    await cart.getByRole('button', { name: 'Remove Carbonara' }).click();
    await expect(cart.getByText('Your cart is empty')).toBeVisible();
  });

  test('emptying the cart asks once', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart' }).click();
    const cart = page.getByRole('dialog', { name: 'Your order' });

    await cart.getByRole('button', { name: 'Empty cart' }).click();
    await cart.getByRole('button', { name: 'Keep' }).click();
    await expect(cart.getByText('Carbonara')).toBeVisible();
    await cart.getByRole('button', { name: 'Empty cart' }).click();
    await cart.getByRole('button', { name: 'Yes, empty it' }).click();
    await expect(cart.getByText('Your cart is empty')).toBeVisible();
  });

  test('checkout goes to the checkout page', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart' }).click();
    await page.getByRole('dialog', { name: 'Your order' }).getByRole('button', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/\/shops\/test-shop\/checkout$/);
  });

  test('on delivery it shows how far the order is from the minimum', async ({ page }) => {
    await mockBackend(page, { modes: DELIVERY_MODES, delivery: ZONES, quote: deliveryQuote });
    await bindDelivery(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        'mewmew_cart_v1:test-shop',
        JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Carbonara', price: 7.5, quantity: 1 }]),
      ),
    );
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart' }).click();
    const cart = page.getByRole('dialog', { name: 'Your order' });

    await expect(cart.getByText('Delivery to 10115 · about 45 min')).toBeVisible();
    await expect(cart.getByText('€2.50 to go until the minimum order for delivery (€10.00)')).toBeVisible();
    await cart.getByRole('button', { name: 'One more Carbonara' }).click();
    await expect(cart.getByText('The delivery fee of €2.50 is added at checkout.')).toBeVisible();
  });

  test('on a phone the cart is a bottom sheet that fits the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBackend(page);
    await seedCart(page);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart', exact: true }).click();

    const box = await page.getByRole('dialog', { name: 'Your order' }).boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(390);
    expect(Math.round(box!.y + box!.height)).toBe(844);
  });
});

test.describe('Cart in German', () => {
  test.use({ locale: 'de-DE' });

  test('German wording', async ({ page }) => {
    await mockBackend(page, { language: 'de' });
    await seedCart(page);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Warenkorb' }).click();
    const cart = page.getByRole('dialog', { name: 'Ihre Bestellung' });
    await expect(cart.getByText('Abholung · fertig in ca. 20 Min.')).toBeVisible();
    await expect(cart.getByRole('button', { name: 'Zur Kasse' })).toBeVisible();
    await expect(cart.getByText('Zwischensumme')).toBeVisible();
  });
});

test.describe('Combo picker', () => {
  test.use({ locale: 'en-US' });

  test('pressing add while a group is open points at it, then adds once complete', async ({ page }) => {
    await mockBackend(page, { products: MENU });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'View details for Pasta Menu' }).click();

    const add = page.getByRole('button', { name: /Add to order/ });
    await expect(add).toContainText('1 still open');
    await expect(page.getByText('1 of 2 chosen').first()).toBeAttached();
    await add.click({ force: true }); // aria-disabled: muted but still pressable
    await expect(page.getByRole('dialog')).toBeVisible(); // nothing added, still open

    await page.getByRole('radio', { name: 'Fanta' }).check();
    await expect(page.getByText('Your combo is complete.')).toBeVisible();
    await add.click();
    await expect(page.getByRole('button', { name: 'Cart' })).toContainText('1');
  });
});

test.describe('Closed or paused popup', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/Berlin' });
  const week = (open: string, close: string) =>
    Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ open, close }]]));

  test('paused: menu stays, popup with the phone number, OK closes it, back on every reload', async ({ page }) => {
    await mockBackend(page, { orderLimitReached: true, shop: { phone: '069 1234' } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup).toBeVisible();
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(popup.getByRole('link', { name: '069 1234' })).toHaveAttribute('href', 'tel:0691234');
    await popup.getByRole('button', { name: 'OK' }).click();
    await expect(popup).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('alertdialog', { name: 'Online ordering is paused' })).toBeVisible();
    await expect(page.getByText('Carbonara').first()).toBeVisible();
  });

  test('paused by the owner: the popup shows the owner message', async ({ page }) => {
    await mockBackend(page, { shop: { ordersPaused: true, ordersPausedMessage: 'Back on Monday!' } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup.getByText('Back on Monday!')).toBeVisible();
    await expect(page.getByText('Carbonara').first()).toBeVisible();
  });

  test('paused by the owner without a message: the standard text', async ({ page }) => {
    await mockBackend(page, { shop: { ordersPaused: true } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup.getByText("We can't take orders right now. Please try again later.")).toBeVisible();
  });

  test('a 30-minute pause says when ordering is back', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
    await mockBackend(page, { shop: { ordersPaused: true, ordersPausedUntil: '2026-10-17T12:30:00.000Z' } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup.getByText("We can't take orders right now. Please try again later.")).toBeVisible();
    await expect(popup.getByText('We take orders again from 14:30.')).toBeVisible();
  });

  test('a pause ending tomorrow shows no time', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T20:00:00Z'));
    await mockBackend(page, { shop: { ordersPaused: true, ordersPausedUntil: '2026-10-18T02:00:00.000Z' } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup.getByText("We can't take orders right now. Please try again later.")).toBeVisible();
    await expect(popup.getByText('We take orders again', { exact: false })).toHaveCount(0);
  });

  test('offline: no menu, popup cannot be closed', async ({ page }) => {
    await mockBackend(page, { shop: { isOffline: true, isPaused: true } });
    await page.route('**/api/shops/shop-t/catalog**', (route) => route.fulfill(fulfil({ error: 'offline' }, 403)));
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'This restaurant is offline' });
    await expect(popup).toBeVisible();
    await expect(popup.getByText("It isn't taking orders online at the moment.")).toBeVisible();
    await expect(popup.getByRole('button')).toHaveCount(0);
    await expect(page.getByText('Carbonara')).toHaveCount(0);
    await expect(page.getByTestId('menu-loading')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(popup).toBeVisible();
  });

  test('checkout: 409 ORDERS_PAUSED shows the server message', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/orders/quote', (route) =>
      route.fulfill(fulfil({ error: 'Back at 6 pm', code: 'ORDERS_PAUSED' }, 409)),
    );
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByText('Back at 6 pm')).toBeVisible();
  });

  test('closed: says when the shop opens again', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-12T08:00:00+02:00')); // Monday 08:00
    await mockBackend(page, { shop: { openingHours: week('11:30', '21:00') } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Closed right now' });
    await expect(popup.getByText('We open again today at 11:30.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
  });

  test('closed after hours: opens again tomorrow', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-12T22:30:00+02:00')); // Monday 22:30
    await mockBackend(page, { shop: { openingHours: { ...week('11:30', '21:00'), tue: [] } } });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('We open again on Wednesday at 11:30.')).toBeVisible();
  });

  test('open: no popup', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-12T12:00:00+02:00'));
    await mockBackend(page, { shop: { openingHours: week('11:30', '21:00') } });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test.describe('German', () => {
    test.use({ locale: 'de-DE' });
    test('German wording', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-12T08:00:00+02:00'));
      await mockBackend(page, { language: 'de', shop: { openingHours: week('11:30', '21:00') } });
      await page.goto('/shops/test-shop');
      const popup = page.getByRole('alertdialog', { name: 'Gerade geschlossen' });
      await expect(popup.getByText('Wir öffnen heute wieder um 11:30 Uhr.')).toBeVisible();
      await expect(popup.getByRole('button', { name: 'OK' })).toBeFocused();
    });
  });
});

test.describe('Stripe loading', () => {
  test.use({ locale: 'en-US' });

  test('the menu, legal pages and step 1 never load Stripe; the payment step does', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    const stripeRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().startsWith('https://js.stripe.com')) stripeRequests.push(r.url());
    });
    const scriptTags = () => page.evaluate(() => document.querySelectorAll('script[src^="https://js.stripe.com"]').length);

    await page.goto('/shops/test-shop');
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await scriptTags()).toBe(0);

    await page.goto('/shops/test-shop/legal/terms');
    await page.waitForLoadState('networkidle');
    expect(await scriptTags()).toBe(0);

    await page.goto('/legal/sub-processors');
    await page.waitForLoadState('networkidle');
    expect(await scriptTags()).toBe(0);

    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await scriptTags()).toBe(0);
    expect(stripeRequests).toEqual([]);

    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('fake-card')).toBeVisible();
    expect(await scriptTags()).toBe(1);
    expect(stripeRequests.length).toBeGreaterThan(0);
    expect(stripeRequests[0]).not.toContain('advancedFraudSignals=false');
    expect((await fakeStripeCalls(page)).init?.options.stripeAccount).toBe('acct_test');
  });
});

test.describe('Dishes served later', () => {
  test.use({ locale: 'en-US' });

  test('a dish served later turns off as soon as possible', async ({ page }) => {
    await mockBackend(page, {
      quote: (b) => ({ ...laterQuote(true)(b), servedNow: false, timeLimited: [{ index: 0, servedNow: false, servedLater: true }] }),
    });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeDisabled();
    await expect(page.getByLabel('Later')).toBeChecked();
    await expect(page.getByText('Some dishes in your basket are only served later. Please choose a time.')).toBeVisible();
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    await page.getByLabel('Time').selectOption('2026-10-10T16:00:00.000Z');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('a dish not on offer at any time is named', async ({ page }) => {
    await mockBackend(page, {
      quote: () => ({ ...okQuote, slots: [], servedNow: false, timeLimited: [{ index: 0, servedNow: false, servedLater: false }] }),
    });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('no-time-fits')).toHaveText(
      'Carbonara: not on offer at any time you can order for. Please remove it to continue.',
    );
    await expect(page.getByText('This restaurant is not taking orders right now.')).toHaveCount(0);
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('dishes served at different times are named together', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'mewmew_cart_v1:test-shop',
        JSON.stringify([
          { key: 'p1::::', id: 'p1', name: 'Carbonara', price: 10.5, quantity: 1 },
          { key: 'p2::::', id: 'p2', name: 'Cola', price: 3.5, quantity: 1 },
        ]),
      ),
    );
    await mockBackend(page, {
      quote: () => ({
        ...okQuote,
        lines: [
          okQuote.lines[0],
          { ...okQuote.lines[0], index: 1, productId: 'p2', name: 'Cola', unitPriceCents: 350, expectedUnitPriceCents: 350, lineTotalCents: 350 },
        ],
        slots: [],
        servedNow: false,
        timeLimited: [
          { index: 0, servedNow: true, servedLater: true },
          { index: 1, servedNow: false, servedLater: true },
        ],
      }),
    });
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('no-time-fits')).toHaveText(
      'These dishes are served at different times. Remove one to continue.',
    );
  });
});

const LATER_MENU = (language: 'en' | 'de') => ({
  language,
  languages: [language],
  categories: [
    { id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [{ ...baseProduct, availableNow: true }] },
    {
      id: 'c2', name: 'Lunch', sortOrder: 2, availableNow: false,
      schedule: { daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:30', endTime: '14:30' },
      products: [{ ...baseProduct, id: 'p7', name: 'Lunch Lasagne', availableNow: false }],
    },
    {
      id: 'c3', name: 'Friday Grill', sortOrder: 3, availableNow: false,
      schedule: { daysOfWeek: [5], startTime: '17:00', endTime: '21:00' },
      products: [{ ...baseProduct, id: 'p8', name: 'Grill Plate', availableNow: false }],
    },
    {
      id: 'c4', name: 'Breakfast', sortOrder: 4, availableNow: false,
      schedule: { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '07:00', endTime: '10:30' },
      products: [{ ...baseProduct, id: 'p6', name: 'Omelette', availableNow: false }],
    },
  ],
});
const mockLaterMenu = (page: Page, language: 'en' | 'de' = 'en') =>
  page.route('**/api/shops/shop-t/catalog**', (route) => route.fulfill(fulfil(LATER_MENU(language))));
const pills = (page: Page) => page.getByRole('navigation', { name: 'Categories' });

test.describe('Other times', () => {
  test.use({ locale: 'en-US' });

  test('categories served at other times wait behind one pill', async ({ page }) => {
    await mockBackend(page);
    await mockLaterMenu(page);
    await page.goto('/shops/test-shop');

    await expect(pills(page).getByRole('button', { name: /^Pasta/ })).toBeVisible();
    await expect(pills(page).getByRole('button', { name: /^Lunch/ })).toHaveCount(0);
    await expect(page.getByText('Lunch Lasagne')).toHaveCount(0);
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    const list = page.getByTestId('other-times');
    for (const t of ['Lunch', 'Mon–Fri 11:30–14:30', 'Friday Grill', 'Fridays 17:00–21:00', 'Breakfast', 'Daily 07:00–10:30']) {
      await expect(list).toContainText(t);
    }
  });

  test('picking one shows its dishes marked with their times, and they can be added', async ({ page }) => {
    await mockBackend(page);
    await mockLaterMenu(page);
    await page.goto('/shops/test-shop');

    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.getByTestId('other-times').getByRole('button', { name: /Lunch/ }).click();
    await expect(page.getByTestId('other-times')).toHaveCount(0);
    await expect(page.getByText('Lunch Lasagne')).toBeVisible();
    await expect(page.getByTestId('not-now')).toHaveText('Available Mon–Fri 11:30–14:30');
    await expect(page.getByTestId('category-note')).toHaveText('Available Mon–Fri 11:30–14:30');
    await page.getByRole('button', { name: 'Add Lunch Lasagne' }).click();
    await page.getByRole('button', { name: /Add to order/ }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('mewmew_cart_v1:test-shop') ?? ''))
      .toContain('"p7"');
  });

  test('Escape closes the list', async ({ page }) => {
    await mockBackend(page);
    await mockLaterMenu(page);
    await page.goto('/shops/test-shop');

    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await expect(page.getByTestId('other-times')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('other-times')).toHaveCount(0);
  });

  test('no extra pill when every category is on now', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop');

    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Other times' })).toHaveCount(0);
  });
});

test.describe('Other times in German', () => {
  test.use({ locale: 'de-DE' });

  test('German wording', async ({ page }) => {
    await mockBackend(page, { language: 'de' });
    await mockLaterMenu(page, 'de');
    await page.goto('/shops/test-shop');

    await pills(page).getByRole('button', { name: 'Andere Zeiten' }).click();
    const list = page.getByTestId('other-times');
    for (const t of ['Mo–Fr 11:30–14:30', 'Freitags 17:00–21:00', 'Täglich 07:00–10:30']) {
      await expect(list).toContainText(t);
    }
    await list.getByRole('button', { name: /Lunch/ }).click();
    await expect(page.getByTestId('not-now')).toHaveText('Erhältlich Mo–Fr 11:30–14:30');
  });
});

test.describe('Other times: more cases', () => {
  test.use({ locale: 'en-US' });

  test('the list holds only the categories that are closed right now', async ({ page }) => {
    await mockBackend(page);
    await mockLaterMenu(page);
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    const list = page.getByTestId('other-times');
    await expect(list.getByRole('button')).toHaveCount(3);
    await expect(list).not.toContainText('Pasta');
    // nothing opened yet: no closed dish and no note on the menu
    await expect(page.getByTestId('not-now')).toHaveCount(0);
    await expect(page.getByTestId('category-note')).toHaveCount(0);
  });

  test('weekend and multi-day windows are worded in English', async ({ page }) => {
    const menu = (language: 'en' | 'de') => ({
      language, languages: [language],
      categories: [
        { id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [baseProduct] },
        { id: 'c2', name: 'Brunch', sortOrder: 2, availableNow: false, schedule: { daysOfWeek: [0, 6], startTime: '10:00', endTime: '14:00' }, products: [{ ...baseProduct, id: 'p7', name: 'Brunch Bowl', availableNow: false }] },
        { id: 'c3', name: 'Specials', sortOrder: 3, availableNow: false, schedule: { daysOfWeek: [5, 1, 3], startTime: '17:00', endTime: '21:00' }, products: [{ ...baseProduct, id: 'p8', name: 'Special Plate', availableNow: false }] },
      ],
    });
    await mockBackend(page);
    await page.route('**/api/shops/shop-t/catalog**', (route) => route.fulfill(fulfil(menu('en'))));
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await expect(page.getByTestId('other-times')).toContainText('Weekends 10:00–14:00');
    await expect(page.getByTestId('other-times')).toContainText('Mon, Wed, Fri 17:00–21:00');
  });

  test('a dish in two closed categories names both times on its badge', async ({ page }) => {
    await mockBackend(page);
    const shared = { ...baseProduct, id: 'p7', name: 'Panna Cotta', availableNow: false };
    await page.route('**/api/shops/shop-t/catalog**', (route) =>
      route.fulfill(fulfil({
        language: 'en', languages: ['en'],
        categories: [
          { id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [{ ...baseProduct, availableNow: true }] },
          { id: 'c2', name: 'Dessert', sortOrder: 2, availableNow: false, schedule: { daysOfWeek: [5], startTime: '17:00', endTime: '21:00' }, products: [shared] },
          { id: 'c3', name: 'Kids', sortOrder: 3, availableNow: false, schedule: { daysOfWeek: [6], startTime: '11:30', endTime: '14:30' }, products: [shared] },
        ],
      })),
    );
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.getByTestId('other-times').getByRole('button', { name: /Dessert/ }).click();
    await expect(page.getByTestId('not-now')).toHaveText('Available Fridays 17:00–21:00 · Saturdays 11:30–14:30');
  });

  test('a dish in both a closed and an open category shows no badge', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/shops/shop-t/catalog**', (route) =>
      route.fulfill(fulfil({
        language: 'en', languages: ['en'],
        categories: [
          { id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [{ ...baseProduct, availableNow: true }] },
          { id: 'c2', name: 'Lunch', sortOrder: 2, availableNow: false, schedule: { daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:30', endTime: '14:30' },
            products: [{ ...baseProduct, availableNow: true }, { ...baseProduct, id: 'p7', name: 'Lunch Lasagne', availableNow: false }] },
        ],
      })),
    );
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.getByTestId('other-times').getByRole('button', { name: /Lunch/ }).click();
    await expect(page.getByText('Lunch Lasagne')).toBeVisible();
    // only the dish that is not on now carries a badge; Carbonara (served now) has none
    await expect(page.getByTestId('not-now')).toHaveCount(1);
    await expect(page.getByTestId('not-now')).toHaveText('Available Mon–Fri 11:30–14:30');
  });

  test('a click outside closes the list, and a second pick replaces the first section', async ({ page }) => {
    await mockBackend(page);
    await mockLaterMenu(page);
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.mouse.click(5, 400);
    await expect(page.getByTestId('other-times')).toHaveCount(0);

    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.getByTestId('other-times').getByRole('button', { name: /Lunch/ }).click();
    await pills(page).getByRole('button', { name: 'Other times' }).click();
    await page.getByTestId('other-times').getByRole('button', { name: /Breakfast/ }).click();
    await expect(page.getByText('Omelette')).toBeVisible();
    await expect(page.getByText('Lunch Lasagne')).toHaveCount(0);
  });

  test('before opening time only the Other times pill is shown', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/shops/shop-t/catalog**', (route) =>
      route.fulfill(fulfil({
        language: 'en', languages: ['en'],
        categories: [
          { id: 'c2', name: 'Lunch', sortOrder: 1, availableNow: false, schedule: { daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:30', endTime: '14:30' },
            products: [{ ...baseProduct, id: 'p7', name: 'Lunch Lasagne', availableNow: false }] },
        ],
      })),
    );
    await page.goto('/shops/test-shop');
    await expect(pills(page).getByRole('button', { name: 'Other times' })).toBeVisible();
    await expect(pills(page).getByRole('button')).toHaveCount(1);
  });
});

test.describe('Dishes served later: more cases', () => {
  test.use({ locale: 'en-US' });

  test('an older backend without servedNow behaves as before', async ({ page }) => {
    // okQuote has no servedNow / timeLimited, as an older backend would answer
    await mockBackend(page, { quote: laterQuote(true) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeEnabled();
    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeChecked();
    await expect(page.getByText('Some dishes in your basket are only served later. Please choose a time.')).toHaveCount(0);
    await expect(page.getByTestId('no-time-fits')).toHaveCount(0);
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('an older backend that is closed still says closed', async ({ page }) => {
    await mockBackend(page, { quote: () => ({ ...okQuote, openNow: false, slots: [] }) });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByText('This restaurant is not taking orders right now.')).toBeVisible();
    await expect(page.getByTestId('no-time-fits')).toHaveCount(0);
  });

  test('a table order with a dish served later cannot be placed and names the dish', async ({ page }) => {
    await bindTable(page);
    await mockBackend(page, {
      modes: ['collection', 'dine_in'],
      quote: () => ({ ...okQuote, fulfilmentMode: 'dine_in', slots: [], servedNow: false, timeLimited: [{ index: 0, servedNow: false, servedLater: true }] }),
    });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByTestId('no-time-fits')).toBeVisible();
    await fillDetails(page);
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('a dish served later while the restaurant is closed still offers later times', async ({ page }) => {
    await mockBackend(page, {
      quote: (b) => ({ ...laterQuote(false)(b), servedNow: false, timeLimited: [{ index: 0, servedNow: false, servedLater: true }] }),
    });
    await seedCart(page);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByLabel('As soon as possible (about 20 min)')).toBeDisabled();
    await expect(page.getByTestId('no-time-fits')).toHaveCount(0);
    await expect(page.getByText('The restaurant is closed right now. You can order for later.')).toBeVisible();
  });
});

test.describe('Other times in German: more cases', () => {
  test.use({ locale: 'de-DE' });

  test('weekend wording in German', async ({ page }) => {
    await mockBackend(page, { language: 'de' });
    await page.route('**/api/shops/shop-t/catalog**', (route) =>
      route.fulfill(fulfil({
        language: 'de', languages: ['de'],
        categories: [
          { id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [baseProduct] },
          { id: 'c2', name: 'Brunch', sortOrder: 2, availableNow: false, schedule: { daysOfWeek: [0, 6], startTime: '10:00', endTime: '14:00' }, products: [{ ...baseProduct, id: 'p7', name: 'Brunch Bowl', availableNow: false }] },
          { id: 'c3', name: 'Specials', sortOrder: 3, availableNow: false, schedule: { daysOfWeek: [5, 1, 3], startTime: '17:00', endTime: '21:00' }, products: [{ ...baseProduct, id: 'p8', name: 'Special Plate', availableNow: false }] },
        ],
      })),
    );
    await page.goto('/shops/test-shop');
    await pills(page).getByRole('button', { name: 'Andere Zeiten' }).click();
    await expect(page.getByTestId('other-times')).toContainText('Am Wochenende 10:00–14:00');
    await expect(page.getByTestId('other-times')).toContainText('Mo, Mi, Fr 17:00–21:00');
  });
});

const FRIDAY = { daysOfWeek: [5], startTime: '17:00', endTime: '21:00' };
const SATURDAY = { daysOfWeek: [6], startTime: '11:30', endTime: '14:30' };
const dish = (id: string, name: string) => ({ ...baseProduct, id, name });

async function seedDishes(page: Page, dishes: { id: string; name: string }[]) {
  await page.addInitScript((items) =>
    localStorage.setItem(
      'mewmew_cart_v1:test-shop',
      JSON.stringify(items.map((d) => ({ key: `${d.id}::::`, id: d.id, name: d.name, price: 5, quantity: 1 }))),
    ), dishes);
}

async function mockTimedCatalog(page: Page, language: 'en' | 'de', categories: Json[]) {
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill(fulfil({ language, languages: [language], categories })),
  );
}

const limitedQuote = (limited: { index: number; servedNow: boolean; servedLater: boolean }[], names: string[], noFit = false) => () => ({
  ...okQuote,
  lines: names.map((name, i) => ({ ...okQuote.lines[0], index: i, productId: `d${i + 1}`, name })),
  ...(noFit ? { slots: [], servedNow: false } : {}),
  timeLimited: limited,
});

test.describe('When a basket dish is served', () => {
  test.use({ locale: 'en-US' });
  const dessert = { id: 'c1', name: 'Dessert', sortOrder: 1, availableNow: false, schedule: FRIDAY, products: [dish('d1', 'Panna Cotta')] };
  const kids = { id: 'c2', name: 'Kids', sortOrder: 2, availableNow: false, schedule: SATURDAY, products: [dish('d2', 'Basis Salat')] };
  const times = (page: Page) => page.getByTestId('dish-time');

  test('a Friday-only dish says when it is served', async ({ page }) => {
    await mockBackend(page, { quote: limitedQuote([{ index: 0, servedNow: false, servedLater: true }], ['Panna Cotta']) });
    await mockTimedCatalog(page, 'en', [dessert]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }]);
    await page.goto('/shops/test-shop/checkout');
    await expect(times(page)).toHaveText('Only Fridays 17:00–21:00');
    await expect(times(page)).not.toHaveAttribute('data-clash', 'true');
  });

  test('the wording is German in a German page', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'de-DE' });
    const page = await context.newPage();
    await mockBackend(page, { language: 'de', quote: limitedQuote([{ index: 0, servedNow: false, servedLater: true }], ['Panna Cotta']) });
    await mockTimedCatalog(page, 'de', [dessert]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }]);
    await page.goto('/shops/test-shop/checkout');
    await expect(times(page)).toHaveText('Nur freitags 17:00–21:00');
    await context.close();
  });

  test('a dish served any time has no line', async ({ page }) => {
    await mockBackend(page);
    await mockTimedCatalog(page, 'en', [{ id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [dish('d1', 'Carbonara')] }]);
    await seedDishes(page, [{ id: 'd1', name: 'Carbonara' }]);
    const catalog = page.waitForResponse('**/api/shops/shop-t/catalog**');
    await page.goto('/shops/test-shop/checkout');
    await catalog;
    await expect(page.getByText('Carbonara').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    await expect(times(page)).toHaveCount(0);
  });

  test('a dish in an open and a closed category has no line', async ({ page }) => {
    await mockBackend(page, { quote: limitedQuote([{ index: 0, servedNow: true, servedLater: true }], ['Panna Cotta']) });
    await mockTimedCatalog(page, 'en', [
      { id: 'c0', name: 'Pasta', sortOrder: 0, availableNow: true, schedule: null, products: [dish('d1', 'Panna Cotta')] },
      dessert,
    ]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }]);
    const catalog = page.waitForResponse('**/api/shops/shop-t/catalog**');
    await page.goto('/shops/test-shop/checkout');
    await catalog;
    await expect(page.getByText('Panna Cotta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    await expect(times(page)).toHaveCount(0);
  });

  test('a dish in two timed categories lists both times', async ({ page }) => {
    await mockBackend(page, { quote: limitedQuote([{ index: 0, servedNow: false, servedLater: true }], ['Panna Cotta']) });
    await mockTimedCatalog(page, 'en', [dessert, { ...kids, products: [dish('d1', 'Panna Cotta')] }]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }]);
    await page.goto('/shops/test-shop/checkout');
    await expect(times(page)).toHaveText('Only Fridays 17:00–21:00 · Saturdays 11:30–14:30');
  });

  test('when no time fits, the clashing lines turn red and the banner is short', async ({ page }) => {
    await mockBackend(page, {
      quote: limitedQuote(
        [{ index: 0, servedNow: false, servedLater: true }, { index: 1, servedNow: false, servedLater: true }],
        ['Panna Cotta', 'Basis Salat'],
        true,
      ),
    });
    await mockTimedCatalog(page, 'en', [dessert, kids]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }, { id: 'd2', name: 'Basis Salat' }]);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByTestId('no-time-fits')).toHaveText('These dishes are served at different times. Remove one to continue.');
    await expect(times(page)).toHaveText(['Only Fridays 17:00–21:00', 'Only Saturdays 11:30–14:30']);
    await expect(times(page).first()).toHaveAttribute('data-clash', 'true');
    await expect(times(page).first()).toHaveCSS('color', 'rgb(138, 31, 18)');
    await expect(times(page).last()).toHaveAttribute('data-clash', 'true');
  });

  test('the basket on the menu page shows the line too', async ({ page }) => {
    await mockBackend(page);
    await mockTimedCatalog(page, 'en', [dessert]);
    await seedDishes(page, [{ id: 'd1', name: 'Panna Cotta' }]);
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.getByRole('dialog', { name: 'Your order' }).getByTestId('dish-time')).toHaveText('Only Fridays 17:00–21:00');
  });
});

test.describe('Paused popup for a visitor in another time zone', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/New_York' });

  test("the resume time is the restaurant's, not the visitor's", async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
    await mockBackend(page, { shop: { ordersPaused: true, ordersPausedUntil: '2026-10-17T12:30:00.000Z' } });
    await page.goto('/shops/test-shop');
    const popup = page.getByRole('alertdialog', { name: 'Online ordering is paused' });
    await expect(popup.getByText('We take orders again from 14:30.')).toBeVisible();
  });
});
