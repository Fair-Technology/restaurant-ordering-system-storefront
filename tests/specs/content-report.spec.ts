import { test, expect, type Page, type Route } from '@playwright/test';

async function mockShop(page: Page) {
  await page.route('**/api/shops/slug/test-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', branding: null }),
    });
  });
  await page.route('**/api/shops/shop-t/catalog**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ language: 'en', languages: ['en'], categories: [] }),
    });
  });
}

async function mockLegal(page: Page) {
  await page.route('**/api/shops/slug/test-shop/legal**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: 'en',
        impressum: null,
        terms: null,
        withdrawal: null,
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    });
  });
}

/** Capture the request body the page posts, and let the handler build the response. */
async function mockSubmit(page: Page, handler: (body: Record<string, unknown>) => { status: number; body: unknown }) {
  const captured: { body: Record<string, unknown> | null } = { body: null };
  await page.route('**/api/shops/shop-t/content-reports', async (route: Route) => {
    captured.body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    const { status, body } = handler(captured.body);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return captured;
}

test.use({ locale: 'en-US' });

test.describe('Content report', () => {
  test('the shop page shows the report link and it opens the form', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop');

    const link = page.getByRole('link', { name: 'Report illegal content' }).first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/shops\/test-shop\/report$/);
    await expect(page.getByRole('heading', { name: 'Report illegal content' })).toBeVisible();
  });

  test('an anonymous report shows the receipt id', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    const request = await mockSubmit(page, () => ({
      status: 200,
      body: { reportId: 'rep-123', status: 'received', receivedAt: '2026-11-15T10:00:00.000Z' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByTestId('report-reason').fill('This listing sells stolen goods.');
    await page.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByTestId('report-id')).toHaveText('rep-123');
    await expect(page.getByTestId('report-receipt')).toBeVisible();
    expect(request.body).not.toBeNull();
    expect(request.body).not.toHaveProperty('reporterName');
    expect(request.body).not.toHaveProperty('reporterEmail');
  });

  test('an INVALID_INPUT message is rendered against its field', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await mockSubmit(page, () => ({
      status: 400,
      body: { error: 'reason is required and must be a non-empty string' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByTestId('error-reason')).toHaveText('reason is required and must be a non-empty string');
  });

  test('a non-field API error is rendered, not swallowed', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await mockSubmit(page, () => ({
      status: 400,
      body: { error: 'Request body must be a JSON object' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByTestId('report-reason').fill('Something is wrong here.');
    await page.getByRole('button', { name: 'Send report' }).click();

    const alert = page.getByTestId('report-error');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Request body must be a JSON object');
  });
});
