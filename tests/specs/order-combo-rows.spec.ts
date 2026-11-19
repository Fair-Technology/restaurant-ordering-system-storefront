import { expect, test } from '@playwright/test';

const order = {
  orderId: '33333333-3333-3333-3333-333333333333',
  orderRef: 'MP-2001',
  shopSlug: 'mapasta',
  shopName: 'Test Shop',
  sellerPhone: null,
  timezone: 'Europe/Berlin',
  language: 'en',
  state: 'PLACED',
  displayState: 'PLACED',
  fulfilmentMode: 'collection',
  paymentStatus: 'paid',
  refundedCents: 0,
  documents: [],
  readyAt: null,
  items: [
    {
      productName: 'Pomodoro English',
      quantity: 1,
      unitPriceCents: 1043,
      lineTotalCents: 1043,
      selectedVariantOptionName: 'Spaghetti',
      selectedAddonOptionNames: [],
      combo: { line: 1, productId: 'deal', name: 'Lunch deal' },
    },
    {
      productName: 'Fanta',
      quantity: 1,
      unitPriceCents: 447,
      lineTotalCents: 447,
      selectedVariantOptionName: null,
      selectedAddonOptionNames: [],
      combo: { line: 1, productId: 'deal', name: 'Lunch deal' },
    },
  ],
  subtotalCents: 1490,
  currency: 'EUR',
  createdAt: '2026-01-01T12:00:00.000Z',
  canCancel: false,
  rejectionReason: null,
};

test('order page shows a combo as one row with its components underneath', async ({ page }) => {
  await page.route('**/api/customer-orders/*/view', (route) =>
    ['fetch', 'xhr'].includes(route.request().resourceType())
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) })
      : route.fallback(),
  );
  await page.goto(`/shops/mapasta/orders/${order.orderId}?t=tok`);
  const rows = page.locator('section ul > li');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Lunch deal');
  await expect(rows.first()).toContainText('€14.90');
  await expect(rows.first()).toContainText('Pomodoro English (Spaghetti)');
  await expect(rows.first()).toContainText('Fanta');
  await expect(rows.first()).not.toContainText('10.43');
});
