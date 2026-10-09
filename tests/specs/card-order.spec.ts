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

  test('going back from the card step keeps the details', async ({ page }) => {
    await mockBackend(page);
    await seedCart(page);
    await page.route('**/api/orders', (route) => route.fulfill(fulfil(CARD_RESULT)));
    await page.goto('/shops/test-shop/checkout');
    await fillDetails(page);
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

  test('the menu says collection only', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Collection · ready in about 20 min')).toBeVisible();
  });

  test('dine-in is never offered without a table', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Collection · ready in about 20 min')).toBeVisible();
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
    // English browser, German shop: the form first prefills "Germany", then the menu arrives in German
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
    await expect(page.getByRole('button', { name: 'Weiter zur Zahlung' })).toBeVisible();

    await fillDetails(page);
    await page.getByRole('button', { name: 'Weiter zur Zahlung' }).click();

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
    await fillDetails(page);
    await page.getByRole('button', { name: 'Weiter zur Zahlung' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toBeEnabled();
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

const COLLECTION_PILL = 'Collection · ready in about 20 min';

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
    await expect(page.getByText(COLLECTION_PILL)).toBeVisible();
  });

  test('with dine-in off a table link is ignored', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/shops/test-shop?t=7');
    await expect(page.getByText(COLLECTION_PILL)).toBeVisible();
    await expect(page.getByText('Table 7')).toHaveCount(0);
  });

  test('a table session expires after two hours', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await bindTable(page, '7', 7_260_000);
    await page.goto('/shops/test-shop');
    await expect(page.getByText(COLLECTION_PILL)).toBeVisible();
    await expect(page.getByText('Table 7 · Dine in')).toHaveCount(0);
  });

  test('not at the table switches back to collection', async ({ page }) => {
    await mockBackend(page, { modes: ['collection', 'dine_in'] });
    await page.goto('/shops/test-shop?t=7');
    await page.getByRole('button', { name: 'Not at this table? Order for collection instead' }).click();
    await expect(page.getByText('Table 7 · Dine in')).toHaveCount(0);
    await expect(page.getByText(COLLECTION_PILL)).toBeVisible();
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
      page.getByText('Online ordering is paused at the moment.', { exact: false }),
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
      page.getByText('Online-Bestellungen sind im Moment pausiert.', { exact: false }),
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
    expect(quotes[quotes.length - 1]).toMatchObject({ fulfilmentMode: 'delivery', postcode: '10115' });
    expect(placed).toMatchObject({
      fulfilmentMode: 'delivery',
      deliveryAddress: { street: 'Teststraße 1', postcode: '10115', city: 'Berlin' },
      expectedDeliveryFeeCents: 250,
    });
    expect((placed as unknown as Json).customerAddress).toBeUndefined();
    const calls = await fakeStripeCalls(page);
    expect(calls.createOptions?.defaultValues?.billingDetails?.address?.country).toBe('DE');
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
      await route.fulfill(fulfil(CARD_RESULT));
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
