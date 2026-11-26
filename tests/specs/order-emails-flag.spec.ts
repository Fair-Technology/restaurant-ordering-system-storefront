import { test, expect } from '@playwright/test';

const baseOrder = {
  orderId: '33333333-3333-3333-3333-333333333333',
  orderRef: 'MP-1002',
  shopSlug: 'mapasta',
  shopName: 'Ma Pasta',
  sellerPhone: null,
  timezone: 'Europe/Berlin',
  language: 'en',
  state: 'ACCEPTED',
  displayState: 'ACCEPTED',
  fulfilmentMode: 'collection',
  scheduledFor: null,
  paymentStatus: 'authorized',
  refundedCents: 0,
  documents: [],
  readyAt: null,
  items: [
    {
      productName: 'Spaghetti Pomodoro',
      quantity: 1,
      unitPriceCents: 1200,
      lineTotalCents: 1200,
      selectedVariantOptionName: null,
      selectedAddonOptionNames: [],
    },
  ],
  subtotalCents: 1200,
  totalCents: 1200,
  currency: 'EUR',
  createdAt: new Date().toISOString(),
  canCancel: false,
  rejectionReason: null,
};

async function open(page: import('@playwright/test').Page, overrides: Record<string, unknown>) {
  await page.route('**/api/shops/**', (route) => route.abort());
  await page.route('**/api/customer-orders/*/view', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseOrder, ...overrides }),
    }),
  );
  await page.goto('/shops/mapasta/orders/33333333-3333-3333-3333-333333333333?t=tok');
  await expect(page.getByText('Spaghetti Pomodoro')).toBeVisible();
}

test('shows "we emailed you a confirmation" when emailsEnabled is true', async ({ page }) => {
  await open(page, { emailsEnabled: true });
  await expect(page.getByText('We have emailed you a confirmation.')).toBeVisible();
});

test('hides "we emailed you a confirmation" when emailsEnabled is false', async ({ page }) => {
  await open(page, { emailsEnabled: false });
  await expect(page.getByText('We have emailed you a confirmation.')).toHaveCount(0);
});

test('PLACED subtitle drops the email sentence when emailsEnabled is false', async ({ page }) => {
  await open(page, { state: 'PLACED', displayState: 'PLACED', canCancel: true, emailsEnabled: false });
  await expect(page.getByText('You can cancel until the restaurant confirms.')).toBeVisible();
  await expect(page.getByText(/We have emailed you a copy/)).toHaveCount(0);
});
