import { test, expect, type Page } from '@playwright/test';

const EN_HELD =
  'We cannot complete your payment right now because of a technical problem on our side — it is not your card and not the restaurant. Your card is only on hold and nothing has been charged. You don’t need to do anything: if the payment still cannot be completed, your order is declined automatically and the hold is released.';
const DE_HELD =
  'Wir können Ihre Zahlung derzeit wegen eines technischen Problems auf unserer Seite nicht abschließen — es liegt nicht an Ihrer Karte und nicht am Restaurant. Ihre Karte ist nur reserviert; es wurde nichts abgebucht. Sie müssen nichts tun: Kann die Zahlung weiterhin nicht abgeschlossen werden, wird Ihre Bestellung automatisch abgelehnt und die Reservierung freigegeben.';
const EN_RESERVE_PROMISE =
  'The amount is reserved on your card. You are only charged when the restaurant accepts — if it declines or you cancel, the reservation is released.';

const ORDER_URL = '/shops/test-shop/orders/o1?t=tok';
const EVIDENCE = 'docs/reports/evidence';

// Evidence screenshots are committed artifacts under docs/reports/evidence/. A plain run writes
// nothing there, so it leaves the working tree clean. To regenerate them:
// UPDATE_EVIDENCE=1 npx playwright test tests/specs/order-payment-held.spec.ts --project=chromium
const updateEvidence = process.env.UPDATE_EVIDENCE === '1';

async function captureEvidence(page: Page, file: string): Promise<void> {
  if (!updateEvidence) return;
  await page.screenshot({ path: `${EVIDENCE}/${file}`, fullPage: true });
}

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mock(page: Page, language: 'en' | 'de', paymentHeld: boolean) {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill(
      fulfil({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        currency: 'EUR',
        countryCode: 'DE',
        timezone: 'Europe/Berlin',
        branding: null,
        fulfilment: {
          modes: ['collection'],
          prepMinutes: { collection: 20, delivery: 45, dine_in: 20 },
          delivery: null,
        },
      }),
    ),
  );
  await page.route('**/api/customer-orders/o1/view', (route) =>
    route.fulfill(
      fulfil({
        orderId: 'o1',
        orderRef: 'AB3-K7P',
        shopSlug: 'test-shop',
        shopName: 'Test Shop',
        timezone: 'Europe/Berlin',
        language,
        state: 'PLACED',
        displayState: 'PLACED',
        rejectionReason: null,
        fulfilmentMode: 'collection',
        paymentStatus: 'authorized',
        refundedCents: 0,
        documents: [],
        readyAt: null,
        scheduledFor: null,
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
        paymentHeld,
      }),
    ),
  );
}

test.describe('Payment held notice (EN)', () => {
  test.use({ locale: 'en-US' });

  test('a held order shows the technical-problem notice', async ({ page }) => {
    await mock(page, 'en', true);
    await page.goto(ORDER_URL);
    await expect(page.getByText(EN_HELD, { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: EN_HELD })).toBeVisible();
    await captureEvidence(page, 'order-payment-held-en.png');
  });

  test('an order that is not held shows the ordinary page', async ({ page }) => {
    await mock(page, 'en', false);
    await page.goto(ORDER_URL);
    await expect(page.getByText(EN_RESERVE_PROMISE, { exact: true })).toBeVisible();
    await expect(page.getByText(EN_HELD, { exact: true })).toHaveCount(0);
  });
});

test.describe('Payment held notice (DE)', () => {
  test.use({ locale: 'de-DE' });

  test('a held order shows the German notice', async ({ page }) => {
    await mock(page, 'de', true);
    await page.goto(ORDER_URL);
    await expect(page.getByText(DE_HELD, { exact: true })).toBeVisible();
    await captureEvidence(page, 'order-payment-held-de.png');
  });
});
