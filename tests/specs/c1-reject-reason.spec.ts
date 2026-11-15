import { test, expect, type Page } from '@playwright/test';

const EN_UNAVAILABLE =
  'We had a technical problem completing your payment — it is not your card and not the restaurant. You have not been charged; the amount reserved on your card is released.';
const DE_UNAVAILABLE =
  'Beim Abschluss Ihrer Zahlung ist ein technisches Problem aufgetreten — es liegt nicht an Ihrer Karte und nicht am Restaurant. Es wurde nichts abgebucht; die reservierte Summe wird freigegeben.';
const EN_FAILED = 'The payment could not be completed when the restaurant accepted.';

const ORDER_URL = '/shops/test-shop/orders/o1?t=tok';
const EVIDENCE = 'docs/reports/evidence';

// Evidence screenshots are committed artifacts under docs/reports/evidence/ and are cited by
// docs/reports/2026-11-14-c1-verify.md. A plain run writes nothing there, so it leaves the working
// tree clean. To regenerate them: UPDATE_EVIDENCE=1 npx playwright test --project=chromium
const updateEvidence = process.env.UPDATE_EVIDENCE === '1';

async function captureEvidence(page: Page, file: string): Promise<void> {
  if (!updateEvidence) return;
  await page.screenshot({ path: `${EVIDENCE}/${file}`, fullPage: true });
}

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mock(page: Page, language: 'en' | 'de', rejectionReason: string) {
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
        state: 'REJECTED',
        displayState: 'REJECTED',
        rejectionReason,
        fulfilmentMode: 'collection',
        paymentStatus: 'canceled',
        refundedCents: 0,
        documents: [],
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
        canCancel: false,
      }),
    ),
  );
}

test.describe('C1 reject reason copy (EN)', () => {
  test.use({ locale: 'en-US' });

  test('payment_unavailable renders the new technical-problem copy', async ({ page }) => {
    await mock(page, 'en', 'payment_unavailable');
    await page.goto(ORDER_URL);
    await expect(page.getByText('Your order was declined', { exact: true })).toBeVisible();
    await expect(page.getByText(EN_UNAVAILABLE, { exact: true })).toBeVisible();
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain('rejectReason.payment_unavailable');
    await captureEvidence(page, 'c1-payment-unavailable-en.png');
  });

  test('payment_failed keeps the card-decline copy', async ({ page }) => {
    await mock(page, 'en', 'payment_failed');
    await page.goto(ORDER_URL);
    await expect(page.getByText(EN_FAILED, { exact: true })).toBeVisible();
    await expect(page.getByText(EN_UNAVAILABLE, { exact: true })).toHaveCount(0);
    await captureEvidence(page, 'c1-payment-failed-en.png');
  });
});

test.describe('C1 reject reason copy (DE)', () => {
  test.use({ locale: 'de-DE' });

  test('payment_unavailable renders the German copy', async ({ page }) => {
    await mock(page, 'de', 'payment_unavailable');
    await page.goto(ORDER_URL);
    await expect(page.getByText('Ihre Bestellung wurde abgelehnt', { exact: true })).toBeVisible();
    await expect(page.getByText(DE_UNAVAILABLE, { exact: true })).toBeVisible();
    await captureEvidence(page, 'c1-payment-unavailable-de.png');
  });
});
