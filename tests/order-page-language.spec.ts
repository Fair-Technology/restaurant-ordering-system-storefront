import { expect, test, type Route } from '@playwright/test';

const SLUG = 'test-shop';
const ORDER_ID = 'order-1';

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const order = {
  orderId: ORDER_ID,
  orderRef: 'A-100',
  shopSlug: SLUG,
  shopName: 'Test Shop',
  sellerPhone: null,
  timezone: 'Europe/Berlin',
  language: 'de',
  state: 'PLACED',
  displayState: 'PLACED',
  fulfilmentMode: 'collection',
  paymentStatus: 'paid',
  refundedCents: 0,
  documents: [],
  readyAt: null,
  items: [],
  subtotalCents: 0,
  currency: 'EUR',
  createdAt: '2026-01-01T12:00:00.000Z',
  canCancel: false,
  rejectionReason: null,
};

const legalPack = {
  slug: SLUG,
  shopName: 'Test Shop',
  language: 'de',
  impressum: null,
  terms: null,
  withdrawal: null,
  privacyNotice: null,
  seller: { legalName: 'Test Shop GmbH', phone: null },
  platform: { name: 'Hermes', salesSiteUrl: null },
};

// The browser is English; the order is German. After a reload the Redux store is empty, so
// only the order's own language can make the footer German.
test.use({ locale: 'en-US' });

test('order page footer follows the order language after a reload', async ({ page }) => {
  // Only the backend calls (fetch/XHR): the dev server also serves /src/api/*.ts modules.
  await page.route('**/api/**', (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback();
    const { pathname } = new URL(route.request().url());
    if (pathname.includes('/customer-orders/') && pathname.endsWith('/view')) return json(route, order);
    if (pathname.includes(`/shops/slug/${SLUG}/legal`)) return json(route, legalPack);
    if (pathname.endsWith(`/shops/slug/${SLUG}`)) return json(route, { slug: SLUG, name: 'Test Shop' });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  const url = `/shops/${SLUG}/orders/${ORDER_ID}?t=token`;
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Impressum' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Legal notice' })).toHaveCount(0);
});
