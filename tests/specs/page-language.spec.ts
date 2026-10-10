import { test, expect, type Page } from '@playwright/test';
import { fakeStripe } from '../fixtures/fakeStripe';

type Json = Record<string, unknown>;

const baseProduct = {
  id: 'p1',
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

function catalog(language: string, languages: string[], name: string) {
  return {
    language,
    languages,
    categories: [
      {
        id: 'c1',
        name: 'Pasta',
        sortOrder: 1,
        products: [{ ...baseProduct, name, description: '' }],
      },
    ],
  };
}

const okQuote = {
  currency: 'EUR',
  fulfilmentMode: 'collection',
  lines: [
    {
      index: 0,
      productId: 'p1',
      name: 'Spaghetti Carbonara',
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
      productName: 'Spaghetti Carbonara',
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

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

/** Menu languages the mocked shop offers; the original (first) language is the fallback. */
async function mockShop(page: Page, menuLanguages: string[], names: Record<string, string>) {
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
          modes: ['collection'],
          prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
          delivery: null,
        },
        orderLimitReached: false,
        branding: null,
      }),
    ),
  );
  // Like the backend: an unoffered language falls back to the shop's original one
  await page.route('**/api/shops/shop-t/catalog**', (route) => {
    const asked = new URL(route.request().url()).searchParams.get('lang') ?? '';
    const language = menuLanguages.includes(asked) ? asked : menuLanguages[0];
    return route.fulfill(fulfil(catalog(language, menuLanguages, names[language])));
  });
  await page.route('**/api/shops/slug/test-shop/legal**', (route) =>
    route.fulfill(
      fulfil({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: menuLanguages[0],
        impressum: { lines: [{ label: 'Provider', value: 'Test Shop GmbH' }] },
        terms: { text: 'T'.repeat(60), revision: 1, updatedAt: 'x' },
        withdrawal: { text: 'W'.repeat(60), revision: 1, updatedAt: 'x' },
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    ),
  );
  await page.route('**/api/customer-orders/o1/view', (route) => route.fulfill(fulfil(PLACED_ORDER)));
}

async function seedCart(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mewmew_cart_v1:test-shop',
      JSON.stringify([{ key: 'p1::::', id: 'p1', name: 'Spaghetti Carbonara', price: 10.5, quantity: 1 }]),
    ),
  );
}

/** Moves to another page without reloading, so the diner's language choice (kept in memory) survives. */
async function goInApp(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

const GERMAN_ONLY = { de: 'Spaghetti Carbonara' };

test.describe('Page language', () => {
  test.use({ locale: 'de-DE' });

  test('a German-only shop offers DE and EN, with no hint text', async ({ page }) => {
    await mockShop(page, ['de'], GERMAN_ONLY);
    await page.goto('/shops/test-shop');

    const group = page.getByRole('group', { name: 'Menüsprache' });
    await expect(group.getByRole('button')).toHaveText(['DE', 'EN']);
    await expect(page.getByText(/only in German|nur auf Deutsch/i)).toHaveCount(0);
  });

  test('picking EN gives English page text and keeps the German dish names', async ({ page }) => {
    await mockShop(page, ['de'], GERMAN_ONLY);
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('heading', { name: 'Spaghetti Carbonara' })).toBeVisible();

    await page.getByRole('button', { name: 'EN', exact: true }).click();

    const group = page.getByRole('group', { name: 'Menu language' });
    await expect(group.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Menüsprache' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Spaghetti Carbonara' })).toBeVisible();
  });

  test('checkout and the order page stay English and the order carries language en', async ({ page }) => {
    await mockShop(page, ['de'], GERMAN_ONLY);
    await seedCart(page);
    const quotes: Json[] = [];
    await page.route('**/api/orders/quote', (route) => {
      quotes.push(route.request().postDataJSON() as Json);
      return route.fulfill(fulfil(okQuote));
    });
    let placed: Json | null = null;
    await page.route('**/api/orders', async (route) => {
      placed = route.request().postDataJSON() as Json;
      await route.fulfill(fulfil(CARD_RESULT));
    });

    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await goInApp(page, '/shops/test-shop/checkout');

    await page.getByPlaceholder('Your full name').fill('Test Diner');
    await page.getByPlaceholder('your@email.com').fill('diner@example.com');
    await page.getByPlaceholder('+1 (555) 000-0000').fill('0301234567');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
    expect(quotes.at(-1)?.language).toBe('en');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByTestId('fake-card')).toBeVisible();
    await page.getByRole('button', { name: 'Order with obligation to pay' }).click();

    await expect(page).toHaveURL(/\/shops\/test-shop\/orders\/o1\?t=tok$/);
    await expect(page.getByText('Order AB3-K7P')).toBeVisible();
    expect((placed as unknown as Json).language).toBe('en');
  });

  test('without a choice, a German browser gets a German page and order', async ({ page }) => {
    await mockShop(page, ['de'], GERMAN_ONLY);
    await seedCart(page);
    let quote: Json | null = null;
    await page.route('**/api/orders/quote', (route) => {
      quote = route.request().postDataJSON() as Json;
      return route.fulfill(fulfil(okQuote));
    });
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByRole('button', { name: 'Weiter zur Zahlung' })).toBeVisible();
    expect((quote as unknown as Json).language).toBe('de');
  });

  test.describe('French browser', () => {
    test.use({ locale: 'fr-FR' });

    test('page falls back to English and the menu to the shop original', async ({ page }) => {
      await mockShop(page, ['de'], GERMAN_ONLY);
      await page.goto('/shops/test-shop');
      await expect(page.getByRole('heading', { name: 'Spaghetti Carbonara' })).toBeVisible();
      const group = page.getByRole('group', { name: 'Menu language' });
      await expect(group.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('a third menu language shows, and choosing it gives that menu with English page text', async ({ page }) => {
    await mockShop(page, ['de', 'en', 'it'], {
      de: 'Spaghetti Carbonara',
      en: 'Spaghetti Carbonara EN',
      it: 'Spaghetti alla Carbonara',
    });
    await page.goto('/shops/test-shop');

    const german = page.getByRole('group', { name: 'Menüsprache' });
    await expect(german.getByRole('button')).toHaveText(['DE', 'EN', 'IT']);

    await german.getByRole('button', { name: 'IT', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Spaghetti alla Carbonara' })).toBeVisible();
    // The page text around it is English, not German or Italian
    const english = page.getByRole('group', { name: 'Menu language' });
    await expect(english.getByRole('button', { name: 'IT', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
