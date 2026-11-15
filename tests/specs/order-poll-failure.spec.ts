import { test, expect } from '@playwright/test';

const order = {
  orderId: '22222222-2222-2222-2222-222222222222',
  orderRef: 'MP-1001',
  shopSlug: 'mapasta',
  shopName: 'Ma Pasta',
  sellerPhone: null,
  timezone: 'Europe/Berlin',
  language: 'en',
  state: 'PLACED',
  displayState: 'PLACED',
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
  canCancel: true,
  rejectionReason: null,
};

test('failed poll warns, hides the live pill, and recovers', async ({ page }) => {
  test.setTimeout(90_000);
  let calls = 0;
  let recovered = false;
  await page.route('**/api/shops/**', (route) => route.abort());
  await page.route('**/api/customer-orders/*/view', (route) => {
    calls += 1;
    if (calls === 1 || recovered) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) });
    }
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
  });

  await page.goto('/shops/mapasta/orders/22222222-2222-2222-2222-222222222222?t=tok');
  await expect(page.getByText('Spaghetti Pomodoro')).toBeVisible();
  await expect(page.getByText(/updates by itself/i)).toBeVisible();

  const alert = page.getByRole('alert').filter({ hasText: /can't refresh/i });
  await expect(alert).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText(/updates by itself/i)).toBeHidden();
  await expect(page.getByText('Spaghetti Pomodoro')).toBeVisible();

  recovered = true;
  await expect(alert).toBeHidden({ timeout: 25_000 });
  await expect(page.getByText(/updates by itself/i)).toBeVisible();
});
